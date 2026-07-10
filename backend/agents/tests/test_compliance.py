"""Tests for the compliance-audit capability.

These are network-free: the LLM router is replaced with a stub that returns a
canned findings array, so we can assert on parsing, normalization, risk scoring
and report rendering deterministically.
"""

from __future__ import annotations

import json

import pytest

from agents import compliance
from agents.llm import LLMResponse
from agents.registry import registry


class _StubRouter:
    def __init__(self, content: str, *, provider='fireworks', model='stub-model'):
        self._content = content
        self._provider = provider
        self._model = model
        self.calls = []

    def chat(self, **kwargs):
        self.calls.append(kwargs)
        return LLMResponse(content=self._content, provider=self._provider, model=self._model)


# A canned model response: covers some rules, omits others, includes one bad
# severity and one bad status to exercise normalization.
_CANNED = json.dumps([
    {"rule_id": "gdpr-lawful-basis", "status": "compliant", "severity": "high",
     "evidence": "Section 2 cites legitimate interests.", "issue": "", "recommendation": ""},
    {"rule_id": "gdpr-breach-notification", "status": "non_compliant", "severity": "critical",
     "evidence": "Not found in document", "issue": "No 72-hour breach process.",
     "recommendation": "Add a breach-notification procedure."},
    {"rule_id": "gdpr-consent", "status": "partial", "severity": "not-a-real-severity",
     "evidence": "Consent mentioned but withdrawal absent.", "issue": "No withdrawal mechanism.",
     "recommendation": "Describe how to withdraw consent."},
    {"rule_id": "gdpr-data-subject-rights", "status": "weird-status", "severity": "high",
     "evidence": "", "issue": "", "recommendation": ""},
])


@pytest.fixture
def stub_router(monkeypatch):
    router = _StubRouter(_CANNED)
    monkeypatch.setattr(compliance, 'get_router', lambda: router)
    return router


# ─── ruleset loading ──────────────────────────────────────────────────────

def test_list_frameworks_includes_core_packs():
    frameworks = {f['framework'] for f in compliance.list_frameworks()}
    assert {'gdpr', 'hipaa', 'soc2'} <= frameworks


def test_load_ruleset_unknown_raises():
    with pytest.raises(ValueError):
        compliance.load_ruleset('not-a-framework')


def test_each_rule_has_required_fields():
    for fw in ('gdpr', 'hipaa', 'soc2'):
        for rule in compliance.load_ruleset(fw)['rules']:
            assert {'id', 'title', 'requirement', 'severity'} <= rule.keys()
            assert rule['severity'] in compliance.VALID_SEVERITY


# ─── JSON extraction ──────────────────────────────────────────────────────

def test_extract_json_array_handles_fences_and_prose():
    text = 'Here is the result:\n```json\n[{"rule_id": "x"}]\n```\nDone.'
    assert compliance._extract_json_array(text) == [{'rule_id': 'x'}]


def test_extract_json_array_handles_bare_array():
    assert compliance._extract_json_array('[{"a": 1}]') == [{'a': 1}]


# ─── audit + normalization ────────────────────────────────────────────────

def test_run_audit_returns_one_finding_per_rule(stub_router):
    ruleset = compliance.load_ruleset('gdpr')
    result = compliance.run_audit('Some privacy policy text.', framework='gdpr')
    assert len(result['findings']) == len(ruleset['rules'])
    assert result['provider_used'] == 'fireworks'
    # Order matches the ruleset.
    assert [f['rule_id'] for f in result['findings']] == [r['id'] for r in ruleset['rules']]


def test_run_audit_normalizes_bad_values(stub_router):
    result = compliance.run_audit('text', framework='gdpr')
    by_id = {f['rule_id']: f for f in result['findings']}
    # Invalid severity falls back to the rule's defined severity.
    assert by_id['gdpr-consent']['severity'] in compliance.VALID_SEVERITY
    # Invalid status falls back to 'not_addressed'.
    assert by_id['gdpr-data-subject-rights']['status'] == 'not_addressed'
    # A rule the model omitted entirely is also 'not_addressed'.
    assert by_id['gdpr-dpo-contact']['status'] == 'not_addressed'


def test_run_audit_requires_document(stub_router):
    with pytest.raises(ValueError):
        compliance.run_audit('   ', framework='gdpr')


def test_summary_risk_score_in_range(stub_router):
    result = compliance.run_audit('text', framework='gdpr')
    summary = result['summary']
    assert 0 <= summary['risk_score'] <= 100
    assert summary['risk_level'] in {'Critical', 'High', 'Medium', 'Low', 'Minimal'}
    assert summary['total_rules'] == len(result['findings'])
    # The critical non-compliant breach rule must register as an issue.
    assert summary['issues'] >= 1


# ─── report rendering ─────────────────────────────────────────────────────

def test_render_report_contains_key_sections(stub_router):
    result = compliance.run_audit('text', framework='gdpr')
    md = compliance.render_report(result, document_name='Acme DPA')
    assert '# Compliance Audit — Acme DPA' in md
    assert 'Overall risk:' in md
    assert 'Findings' in md
    assert '72-hour breach notification'.lower() in md.lower() or 'breach' in md.lower()


def test_render_report_amd_provider_shows_privacy_line():
    audit = {
        'framework': 'gdpr', 'framework_name': 'GDPR', 'provider_used': 'amd',
        'model_used': 'llama-3.1-8b', 'summary': {'risk_score': 0, 'risk_level': 'Minimal',
        'issues': 0, 'total_rules': 0, 'status_counts': {}}, 'findings': [],
    }
    md = compliance.render_report(audit)
    assert 'AMD Instinct GPUs (private)' in md


# ─── registry wiring ──────────────────────────────────────────────────────

def test_compliance_tools_registered():
    # Importing agents.compliance (done at top) registers the tools.
    for name in ('audit_document_compliance', 'compliance_report', 'list_compliance_frameworks'):
        assert registry.get(name) is not None


# ─── workflow integration (YAML → runner → report) ─────────────────────────

@pytest.mark.django_db
def test_compliance_audit_workflow_end_to_end(monkeypatch):
    """The shipped compliance_audit.yaml chains audit -> report correctly."""
    from pathlib import Path

    from django.contrib.auth import get_user_model

    from agents.models import Workflow, WorkflowRun
    from agents.services.workflow_runner import WorkflowRunner, load_workflow_yaml

    monkeypatch.setattr(compliance, 'get_router', lambda: _StubRouter(_CANNED))

    spec_path = Path(compliance.__file__).resolve().parent / 'workflows' / 'compliance_audit.yaml'
    spec = load_workflow_yaml(spec_path)
    wf = Workflow.objects.create(slug=spec['slug'], name=spec['name'], spec=spec, is_builtin=True)

    user = get_user_model().objects.create_user(email='audit@example.com', password='pw12345!')
    events = list(WorkflowRunner().run(
        workflow=wf, user=user,
        inputs={'document_text': 'Acme privacy policy text.', 'framework': 'gdpr',
                'document_name': 'Acme Policy'},
    ))

    assert events[-1]['data']['status'] == 'completed'
    report = events[-1]['data']['output']
    assert isinstance(report, str)
    assert '# Compliance Audit — Acme Policy' in report
    assert 'Framework:' in report

    run = WorkflowRun.objects.get(workflow=wf)
    assert run.status == 'completed'
    # The intermediate audit step produced the structured dict the report consumed.
    assert run.outputs['state']['steps']['audit']['output']['framework'] == 'gdpr'


# ─── REST API ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_compliance_api_audit_and_frameworks(monkeypatch):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from agents import compliance_views

    monkeypatch.setattr(compliance, 'get_router', lambda: _StubRouter(_CANNED))

    user = get_user_model().objects.create_user(email='api@example.com', password='pw12345!')
    client = APIClient()
    client.force_authenticate(user=user)

    # frameworks list
    res = client.get('/api/agents/compliance/frameworks/')
    assert res.status_code == 200
    frameworks = {f['framework'] for f in res.json()['frameworks']}
    assert {'gdpr', 'hipaa', 'soc2'} <= frameworks

    # audit
    res = client.post('/api/agents/compliance/audit/', {
        'document_text': 'Acme privacy policy text.',
        'framework': 'gdpr',
        'provider': 'fireworks',
        'document_name': 'Acme Policy',
    }, format='json')
    assert res.status_code == 200, res.content
    body = res.json()
    assert body['framework'] == 'gdpr'
    assert body['provider_used'] == 'fireworks'
    assert len(body['findings']) == len(compliance.load_ruleset('gdpr')['rules'])
    assert '# Compliance Audit — Acme Policy' in body['report_markdown']


@pytest.mark.django_db
def test_compliance_api_rejects_bad_input(monkeypatch):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    monkeypatch.setattr(compliance, 'get_router', lambda: _StubRouter(_CANNED))
    user = get_user_model().objects.create_user(email='api2@example.com', password='pw12345!')
    client = APIClient()
    client.force_authenticate(user=user)

    # empty document -> 400
    assert client.post('/api/agents/compliance/audit/',
                       {'document_text': '   '}, format='json').status_code == 400
    # bad provider -> 400
    assert client.post('/api/agents/compliance/audit/',
                       {'document_text': 'x', 'provider': 'hackercloud'}, format='json').status_code == 400
    # unknown framework -> 400
    assert client.post('/api/agents/compliance/audit/',
                       {'document_text': 'x', 'framework': 'nope'}, format='json').status_code == 400


def test_compliance_api_requires_auth():
    from rest_framework.test import APIClient
    assert APIClient().get('/api/agents/compliance/frameworks/').status_code in (401, 403)
