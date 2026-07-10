"""Tests for the YAML-driven workflow runner."""

from __future__ import annotations

from pathlib import Path

import pytest

from agents.models import Workflow, WorkflowRun
from agents.registry import AgentTool, registry
from agents.services.workflow_runner import (
    WorkflowRunner,
    _render_value,
    _resolve_path,
    discover_builtin_workflows,
    load_workflow_yaml,
)

pytestmark = pytest.mark.django_db


def test_resolve_path_handles_lists_and_missing():
    state = {'inputs': {'topic': 'space'}, 'steps': {'a': {'output': ['x', 'y']}}}
    assert _resolve_path(state, 'inputs.topic') == 'space'
    assert _resolve_path(state, 'steps.a.output.1') == 'y'
    assert _resolve_path(state, 'no.such.path') == ''


def test_render_value_preserves_full_template_type():
    state = {'inputs': {'count': 7}}
    assert _render_value('{{ inputs.count }}', state) == 7
    assert _render_value('Topic is {{ inputs.count }}!', state) == 'Topic is 7!'


def test_workflow_runner_executes_steps_in_order():
    registry.register(AgentTool(
        name='upper_tool', description='upper',
        parameters={'type': 'object', 'properties': {'text': {'type': 'string'}}},
        handler=lambda text: text.upper(),
    ))
    registry.register(AgentTool(
        name='reverse_tool', description='reverse',
        parameters={'type': 'object', 'properties': {'text': {'type': 'string'}}},
        handler=lambda text: text[::-1],
    ))

    spec = {
        'slug': 'upper_then_reverse',
        'name': 'Upper → Reverse',
        'inputs': {'text': {'type': 'string', 'required': True}},
        'steps': [
            {'id': 'up', 'tool': 'upper_tool', 'args': {'text': '{{ inputs.text }}'}},
            {'id': 'rev', 'tool': 'reverse_tool', 'args': {'text': '{{ steps.up.output }}'}},
        ],
        'output': 'rev',
    }
    wf = Workflow.objects.create(slug='upper_then_reverse', name='X', spec=spec, is_builtin=True)

    from django.contrib.auth import get_user_model
    user = get_user_model().objects.create_user(email='c@example.com', password='pw12345!')

    runner = WorkflowRunner()
    events = list(runner.run(workflow=wf, user=user, inputs={'text': 'hello'}))

    types = [e['type'] for e in events]
    assert types[0] == 'start'
    assert types.count('step_start') == 2
    assert types.count('step_end') == 2
    assert events[-1]['type'] == 'done'
    assert events[-1]['data']['status'] == 'completed'
    assert events[-1]['data']['output'] == 'OLLEH'

    run = WorkflowRun.objects.get(workflow=wf)
    assert run.status == 'completed'
    assert run.outputs['final'] == 'OLLEH'


def test_workflow_runner_rejects_unknown_tool(user=None):
    spec = {
        'slug': 'broken',
        'name': 'broken',
        'steps': [{'id': 'a', 'tool': 'nope', 'args': {}}],
    }
    wf = Workflow.objects.create(slug='broken', name='X', spec=spec, is_builtin=True)
    from django.contrib.auth import get_user_model
    u = get_user_model().objects.create_user(email='d@example.com', password='pw12345!')
    events = list(WorkflowRunner().run(workflow=wf, user=u, inputs={}))
    assert events[-1]['data']['status'] == 'failed'


def test_builtin_workflow_yaml_files_load():
    workflows = discover_builtin_workflows()
    assert len(workflows) >= 3
    slugs = {w['slug'] for w in workflows}
    assert {'blog_from_research', 'social_amplification', 'study_pack'} <= slugs
    for spec in workflows:
        for step in spec['steps']:
            assert 'id' in step and 'tool' in step
