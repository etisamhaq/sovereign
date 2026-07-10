"""
Compliance & document-audit capability for Sovereign.

The flagship use case: a regulated team uploads a contract or policy and the
agent audits it against a regulatory framework (GDPR, HIPAA, SOC 2), returning a
cited, severity-ranked risk report. Inference runs through the multi-provider
router (:mod:`agents.llm`), so the *same* audit can run privately on the
customer's own AMD Instinct GPUs (``provider='amd'``) or on a fast managed
endpoint (``provider='fireworks'``). That toggle is the whole product story:
confidential documents never have to leave your own hardware.

Two registry tools compose into the ``compliance_audit`` workflow:

    audit_document_compliance(document_text, framework, provider) -> audit dict
    compliance_report(audit, document_name)                       -> markdown

The audit *shape* is deterministic (always the same JSON structure and always
one finding per rule) even though the individual judgments come from an LLM.
"""

from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from .llm import LLMError, LLMRouter, get_router
from .registry import register_tool

logger = logging.getLogger(__name__)

RULESETS_DIR = Path(__file__).resolve().parent / 'rulesets'

#: Documents longer than this are truncated before being sent to the model.
MAX_DOC_CHARS = 16_000

#: Relative weight of each severity band when computing the overall risk score.
SEVERITY_WEIGHTS = {'critical': 10, 'high': 6, 'medium': 3, 'low': 1}

#: How much "risk" each compliance status contributes (0 = no risk).
STATUS_RISK = {
    'compliant': 0.0,
    'partial': 0.5,
    'not_addressed': 0.7,
    'non_compliant': 1.0,
}

VALID_STATUS = set(STATUS_RISK)
VALID_SEVERITY = set(SEVERITY_WEIGHTS)

# Statuses that represent an actual gap worth reporting.
ISSUE_STATUSES = {'non_compliant', 'partial', 'not_addressed'}


# ─── Ruleset loading ───────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _load_all_rulesets() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    if RULESETS_DIR.exists():
        for path in sorted(RULESETS_DIR.glob('*.json')):
            try:
                data = json.loads(path.read_text(encoding='utf-8'))
                out[data['framework'].lower()] = data
            except Exception as exc:  # noqa: BLE001
                logger.warning('Skipping invalid ruleset %s: %s', path, exc)
    return out


def list_frameworks() -> List[Dict[str, Any]]:
    """Metadata for every available framework (for the builder/UI)."""
    return [
        {
            'framework': key,
            'name': rs.get('name', key),
            'description': rs.get('description', ''),
            'num_rules': len(rs.get('rules', [])),
        }
        for key, rs in _load_all_rulesets().items()
    ]


def load_ruleset(framework: str) -> Dict[str, Any]:
    rs = _load_all_rulesets().get((framework or '').lower())
    if rs is None:
        available = ', '.join(sorted(_load_all_rulesets().keys())) or 'none'
        raise ValueError(
            f'Unknown compliance framework: {framework!r}. Available: {available}'
        )
    return rs


# ─── LLM plumbing ────────────────────────────────────────────────────────


def _router_for(provider: Optional[str]) -> LLMRouter:
    """Return a router that prefers ``provider`` but still falls back.

    ``provider='amd'`` routes inference onto the customer's own AMD Instinct
    GPUs; anything else uses the configured default chain.
    """
    if provider:
        chain: List[str] = []
        for name in [provider, 'fireworks', 'groq', 'amd']:
            if name and name not in chain:
                chain.append(name)
        return LLMRouter(chain=chain)
    return get_router()


def _extract_json_array(text: str) -> Any:
    """Best-effort parse of a JSON array from a model response.

    Tolerates ```json fences and leading/trailing prose, which reasoning
    models sometimes emit around the payload.
    """
    if not text:
        raise ValueError('empty model response')
    # Strip Markdown code fences.
    fenced = re.search(r'```(?:json)?\s*(.+?)```', text, re.DOTALL)
    candidate = fenced.group(1).strip() if fenced else text.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost [...] span.
    start, end = candidate.find('['), candidate.rfind(']')
    if start != -1 and end != -1 and end > start:
        return json.loads(candidate[start:end + 1])
    raise ValueError('no JSON array found in model response')


_SYSTEM_PROMPT = (
    'You are a meticulous compliance auditor. You assess a DOCUMENT against a '
    'list of RULES from a regulatory framework. For each rule decide whether the '
    'document satisfies it, then cite the evidence.\n\n'
    'Respond with ONLY a JSON array — no prose, no Markdown. Each element:\n'
    '{\n'
    '  "rule_id": "<the rule id, verbatim>",\n'
    '  "status": "compliant" | "partial" | "non_compliant" | "not_addressed",\n'
    '  "severity": "critical" | "high" | "medium" | "low",\n'
    '  "evidence": "<short quote or location from the document, or \'Not found in document\'>",\n'
    '  "issue": "<what is missing or wrong; empty string if compliant>",\n'
    '  "recommendation": "<concrete fix; empty string if compliant>"\n'
    '}\n\n'
    'Use "not_addressed" when the document is simply silent on the rule. Use '
    '"partial" when it is mentioned but incomplete. Base every judgment strictly '
    'on the document text provided — do not invent content.'
)


def _build_user_prompt(document_text: str, ruleset: Dict[str, Any]) -> str:
    rules_block = '\n'.join(
        f'- id: {r["id"]}\n  title: {r["title"]}\n  requirement: {r["requirement"]}'
        for r in ruleset['rules']
    )
    doc = document_text[:MAX_DOC_CHARS]
    truncated = '\n\n[...document truncated for length...]' if len(document_text) > MAX_DOC_CHARS else ''
    return (
        f'FRAMEWORK: {ruleset.get("name", ruleset["framework"])}\n\n'
        f'RULES:\n{rules_block}\n\n'
        f'DOCUMENT:\n"""\n{doc}{truncated}\n"""\n\n'
        f'Return one JSON object per rule, in the same order as the rules above.'
    )


def _normalize_findings(
    raw: Any, ruleset: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Merge model output with rule metadata; guarantee one finding per rule."""
    by_id: Dict[str, Dict[str, Any]] = {}
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and item.get('rule_id'):
                by_id[str(item['rule_id'])] = item

    findings: List[Dict[str, Any]] = []
    for rule in ruleset['rules']:
        model_item = by_id.get(rule['id'], {})
        status = str(model_item.get('status', 'not_addressed')).lower().strip()
        if status not in VALID_STATUS:
            status = 'not_addressed'
        # Severity only matters for gaps; anchor it to the rule's defined band
        # unless the model proposes a valid one for an actual issue.
        severity = str(model_item.get('severity', '')).lower().strip()
        if severity not in VALID_SEVERITY:
            severity = rule.get('severity', 'medium')
        findings.append({
            'rule_id': rule['id'],
            'title': rule['title'],
            'requirement': rule['requirement'],
            'reference': rule.get('reference', ''),
            'status': status,
            'severity': severity,
            'evidence': str(model_item.get('evidence', '') or '').strip(),
            'issue': str(model_item.get('issue', '') or '').strip(),
            'recommendation': str(model_item.get('recommendation', '') or '').strip(),
        })
    return findings


def _summarize(findings: List[Dict[str, Any]], ruleset: Dict[str, Any]) -> Dict[str, Any]:
    status_counts = {s: 0 for s in VALID_STATUS}
    severity_counts = {s: 0 for s in VALID_SEVERITY}
    actual = 0.0
    possible = 0.0
    for f in findings:
        status_counts[f['status']] += 1
        # Weight by the rule's defined severity for a stable, deterministic score.
        rule_severity = next(
            (r.get('severity', 'medium') for r in ruleset['rules'] if r['id'] == f['rule_id']),
            'medium',
        )
        weight = SEVERITY_WEIGHTS.get(rule_severity, 3)
        possible += weight
        actual += STATUS_RISK[f['status']] * weight
        if f['status'] in ISSUE_STATUSES:
            severity_counts[f['severity']] += 1

    risk_score = int(round(100 * actual / possible)) if possible else 0
    if risk_score >= 70:
        risk_level = 'Critical'
    elif risk_score >= 45:
        risk_level = 'High'
    elif risk_score >= 20:
        risk_level = 'Medium'
    elif risk_score > 0:
        risk_level = 'Low'
    else:
        risk_level = 'Minimal'

    return {
        'total_rules': len(findings),
        'issues': sum(1 for f in findings if f['status'] in ISSUE_STATUSES),
        'status_counts': status_counts,
        'severity_counts': severity_counts,
        'risk_score': risk_score,
        'risk_level': risk_level,
    }


# ─── Public audit entrypoint ─────────────────────────────────────────────


def run_audit(
    document_text: str,
    framework: str = 'gdpr',
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """Audit ``document_text`` against ``framework``; return a structured result.

    Importable directly (e.g. from API views) as well as via the registered
    tool below.
    """
    if not (document_text or '').strip():
        raise ValueError('document_text is required')
    ruleset = load_ruleset(framework)
    router = _router_for(provider)

    messages = [
        {'role': 'system', 'content': _SYSTEM_PROMPT},
        {'role': 'user', 'content': _build_user_prompt(document_text, ruleset)},
    ]
    response = router.chat(
        messages=messages,
        tools=None,
        tool_choice='auto',
        model=None,
        temperature=0.0,
        max_tokens=3000,
    )
    try:
        raw = _extract_json_array(response.content)
    except ValueError as exc:
        raise LLMError(f'Could not parse audit response: {exc}') from exc

    findings = _normalize_findings(raw, ruleset)
    summary = _summarize(findings, ruleset)
    return {
        'framework': ruleset['framework'],
        'framework_name': ruleset.get('name', ruleset['framework']),
        'provider_used': response.provider,
        'model_used': response.model,
        'summary': summary,
        'findings': findings,
    }


# ─── Markdown report ─────────────────────────────────────────────────────


_STATUS_LABEL = {
    'compliant': '✅ Compliant',
    'partial': '⚠️ Partial',
    'not_addressed': '⬜ Not addressed',
    'non_compliant': '❌ Non-compliant',
}
_SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']


def render_report(audit: Dict[str, Any], document_name: str = 'Document') -> str:
    """Render a cited, severity-ranked Markdown risk report from an audit dict."""
    summary = audit.get('summary', {})
    findings = audit.get('findings', [])
    lines: List[str] = []

    lines.append(f'# Compliance Audit — {document_name}')
    lines.append('')
    lines.append(f'**Framework:** {audit.get("framework_name", audit.get("framework", "?"))}')
    lines.append(
        f'**Overall risk:** {summary.get("risk_level", "?")} '
        f'({summary.get("risk_score", 0)}/100)'
    )
    lines.append(
        f'**Result:** {summary.get("issues", 0)} of {summary.get("total_rules", 0)} '
        f'checks raised a gap.'
    )
    # The sovereignty line — where inference actually ran.
    prov = audit.get('provider_used', '')
    if prov:
        where = 'your own AMD Instinct GPUs (private)' if prov == 'amd' else f'{prov}'
        lines.append(f'**Audited on:** {where} · model `{audit.get("model_used", "?")}`')
    lines.append('')

    sc = summary.get('status_counts', {})
    lines.append('| Status | Count |')
    lines.append('| --- | --- |')
    for status in ['non_compliant', 'partial', 'not_addressed', 'compliant']:
        lines.append(f'| {_STATUS_LABEL[status]} | {sc.get(status, 0)} |')
    lines.append('')

    issues = [f for f in findings if f['status'] in ISSUE_STATUSES]
    if issues:
        lines.append('## Findings')
        lines.append('')
        issues.sort(key=lambda f: _SEVERITY_ORDER.index(f['severity'])
                    if f['severity'] in _SEVERITY_ORDER else 99)
        for f in issues:
            lines.append(f'### {_STATUS_LABEL[f["status"]]} — {f["title"]}  `[{f["severity"].upper()}]`')
            if f.get('reference'):
                lines.append(f'*Reference:* {f["reference"]}')
            lines.append('')
            lines.append(f'- **Requirement:** {f["requirement"]}')
            lines.append(f'- **Evidence:** {f.get("evidence") or "Not found in document"}')
            if f.get('issue'):
                lines.append(f'- **Issue:** {f["issue"]}')
            if f.get('recommendation'):
                lines.append(f'- **Recommendation:** {f["recommendation"]}')
            lines.append('')

    compliant = [f for f in findings if f['status'] == 'compliant']
    if compliant:
        lines.append('## Satisfied checks')
        lines.append('')
        for f in compliant:
            lines.append(f'- ✅ {f["title"]}')
        lines.append('')

    return '\n'.join(lines).strip() + '\n'


# ─── Registry tools (composed by the compliance_audit workflow) ─────────────


@register_tool(
    name='list_compliance_frameworks',
    description='List the regulatory frameworks available for a compliance audit (e.g. GDPR, HIPAA, SOC 2).',
    parameters={'type': 'object', 'properties': {}},
    category='compliance',
)
def list_compliance_frameworks_tool() -> List[Dict[str, Any]]:
    return list_frameworks()


@register_tool(
    name='audit_document_compliance',
    description=(
        'Audit a document (contract, policy, privacy notice) against a regulatory '
        'framework and return structured, cited findings with a risk score. Use for '
        'compliance review of legal/governance text.'
    ),
    parameters={
        'type': 'object',
        'properties': {
            'document_text': {'type': 'string', 'description': 'Full text of the document to audit.'},
            'framework': {
                'type': 'string',
                'enum': ['gdpr', 'hipaa', 'soc2'],
                'default': 'gdpr',
                'description': 'Regulatory framework to audit against.',
            },
            'provider': {
                'type': 'string',
                'description': "LLM provider override. Use 'amd' to run privately on AMD Instinct GPUs, "
                               "'fireworks' for the fast managed path. Empty = configured default.",
                'default': '',
            },
        },
        'required': ['document_text'],
    },
    category='compliance',
    timeout_s=180,
)
def audit_document_compliance(
    document_text: str,
    framework: str = 'gdpr',
    provider: str = '',
) -> Dict[str, Any]:
    return run_audit(document_text, framework=framework, provider=provider or None)


@register_tool(
    name='compliance_report',
    description='Render a Markdown risk report from the structured output of audit_document_compliance.',
    parameters={
        'type': 'object',
        'properties': {
            'audit': {'type': 'object', 'description': 'The audit object returned by audit_document_compliance.'},
            'document_name': {'type': 'string', 'default': 'Document'},
        },
        'required': ['audit'],
    },
    category='compliance',
)
def compliance_report(audit: Dict[str, Any], document_name: str = 'Document') -> str:
    return render_report(audit, document_name=document_name)
