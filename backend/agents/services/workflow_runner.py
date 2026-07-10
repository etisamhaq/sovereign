"""
Deterministic YAML-defined workflow runner.

A workflow is a list of *steps*. Each step calls a registered agent tool with
template-rendered arguments. Steps can reference each other's outputs via
``{{ steps.<id>.output.<path> }}`` placeholders evaluated against a state
dict that grows as the workflow executes.

The runner is deterministic on purpose: workflows are how power users compose
reliable pipelines without paying the cost (latency, non-determinism) of the
full planner. The agent itself can also call workflows by name as a tool.

Example YAML:

    slug: blog_from_research
    name: Research → Blog Post
    description: Research a topic, then turn the brief into a long-form blog post.
    inputs:
      topic: { type: string, required: true }
      audience: { type: string, default: "general" }
    steps:
      - id: research
        tool: research_topic
        args: { topic: "{{ inputs.topic }}", depth: standard }
      - id: outline
        tool: generate_outline
        args: { topic: "{{ inputs.topic }}", outline_type: blog_post }
      - id: post
        tool: generate_blog_post
        args:
          topic: "{{ inputs.topic }}"
          target_audience: "{{ inputs.audience }}"
    output: post
"""

from __future__ import annotations

import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional

import yaml
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..models import Workflow, WorkflowRun
from ..registry import AgentTool, ToolContext, registry

logger = logging.getLogger(__name__)

WORKFLOWS_DIR = Path(__file__).resolve().parent.parent / 'workflows'

# Matches `{{ ... }}` placeholders in YAML strings.
_TEMPLATE_PATTERN = re.compile(r'\{\{\s*(.+?)\s*\}\}')


# ─── YAML loading ────────────────────────────────────────────────────────


def _validate_spec(spec: Dict[str, Any]) -> None:
    """Light-weight validation. Heavy validation is deferred to first run."""
    required = {'slug', 'name', 'steps'}
    missing = required - spec.keys()
    if missing:
        raise ValueError(f'Workflow spec missing required keys: {missing}')
    if not isinstance(spec.get('steps'), list) or not spec['steps']:
        raise ValueError('Workflow `steps` must be a non-empty list')
    for i, step in enumerate(spec['steps']):
        if 'id' not in step or 'tool' not in step:
            raise ValueError(f'Step #{i} missing `id` or `tool`')


def load_workflow_yaml(path: Path) -> Dict[str, Any]:
    with path.open('r', encoding='utf-8') as fh:
        spec = yaml.safe_load(fh)
    if not isinstance(spec, dict):
        raise ValueError(f'Workflow YAML must be a mapping: {path}')
    _validate_spec(spec)
    return spec


def discover_builtin_workflows() -> List[Dict[str, Any]]:
    out = []
    if not WORKFLOWS_DIR.exists():
        return out
    for path in sorted(WORKFLOWS_DIR.glob('*.yaml')):
        try:
            spec = load_workflow_yaml(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning('Skipping invalid workflow %s: %s', path, exc)
            continue
        out.append(spec)
    return out


def sync_builtin_workflows() -> int:
    """Upsert built-in workflows from disk. Idempotent.

    Called manually (`manage.py shell`) or from the workflows API on demand.
    """
    count = 0
    for spec in discover_builtin_workflows():
        Workflow.objects.update_or_create(
            slug=spec['slug'],
            defaults={
                'name': spec.get('name', spec['slug']),
                'description': spec.get('description', ''),
                'spec': spec,
                'is_builtin': True,
                'is_active': spec.get('is_active', True),
                'is_premium': bool(spec.get('is_premium', False)),
            },
        )
        count += 1
    return count


# ─── Template evaluation ─────────────────────────────────────────────────


def _resolve_path(state: Dict[str, Any], path: str) -> Any:
    """Resolve dotted paths against the state dict.

    Supports list indexing (``foo.0.bar``).
    """
    cur: Any = state
    for part in path.split('.'):
        if part == '':
            continue
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return ''
        else:
            return getattr(cur, part, '')
        if cur is None:
            return ''
    return cur


def _render_value(value: Any, state: Dict[str, Any]) -> Any:
    if isinstance(value, str):
        def replace(match: re.Match) -> str:
            resolved = _resolve_path(state, match.group(1))
            if isinstance(resolved, (dict, list)):
                import json as _json
                return _json.dumps(resolved, default=str, ensure_ascii=False)
            return '' if resolved is None else str(resolved)

        # If the entire value is a single placeholder, preserve the raw type.
        m = _TEMPLATE_PATTERN.fullmatch(value.strip())
        if m:
            return _resolve_path(state, m.group(1))
        return _TEMPLATE_PATTERN.sub(replace, value)
    if isinstance(value, list):
        return [_render_value(v, state) for v in value]
    if isinstance(value, dict):
        return {k: _render_value(v, state) for k, v in value.items()}
    return value


# ─── Execution ───────────────────────────────────────────────────────────


def _coerce_inputs(spec: Dict[str, Any], inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Apply defaults + required checks for declared inputs."""
    declared = spec.get('inputs') or {}
    out: Dict[str, Any] = {}
    for name, schema in declared.items():
        if name in inputs:
            out[name] = inputs[name]
        elif 'default' in schema:
            out[name] = schema['default']
        elif schema.get('required'):
            raise ValueError(f'Missing required input: {name}')
        else:
            out[name] = None
    # Allow undeclared inputs to flow through (hand-off from agent tool calls).
    for name, value in inputs.items():
        out.setdefault(name, value)
    return out


class WorkflowRunner:
    """Execute a workflow + emit progress events."""

    def __init__(self, *, registry_obj=None) -> None:
        self.registry = registry_obj or registry

    def run(
        self, *, workflow: Workflow, user, inputs: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        spec = workflow.spec or {}
        inputs = _coerce_inputs(spec, inputs or {})
        steps = spec.get('steps') or []

        with transaction.atomic():
            run = WorkflowRun.objects.create(
                workflow=workflow, user=user, inputs=inputs, status='running',
            )

        yield {'type': 'start', 'data': {
            'run_id': str(run.id),
            'workflow': workflow.slug,
            'total_steps': len(steps),
        }}

        state: Dict[str, Any] = {'inputs': inputs, 'steps': {}}
        try:
            for index, step in enumerate(steps, start=1):
                step_id = step['id']
                tool_name = step['tool']
                tool: Optional[AgentTool] = self.registry.get(tool_name)
                if tool is None:
                    raise ValueError(f'Workflow references unknown tool: {tool_name}')
                if tool.is_premium and not (getattr(user, 'is_pro', False) or getattr(user, 'is_staff', False)):
                    raise PermissionError(f'Tool {tool_name} requires Pro subscription')

                args = _render_value(step.get('args', {}), state)
                yield {'type': 'step_start', 'data': {
                    'index': index, 'id': step_id, 'tool': tool_name, 'args': args,
                }}
                run.current_step = step_id
                run.progress = int((index - 1) / max(len(steps), 1) * 100)
                run.save(update_fields=['current_step', 'progress'])

                t0 = time.monotonic()
                ctx = ToolContext(user=user, run_id=str(run.id))
                try:
                    output = tool.handler(**(args if isinstance(args, dict) else {}), **({'ctx': ctx} if 'ctx' in tool.handler.__code__.co_varnames else {}))
                except TypeError:
                    # Handler may not accept the ctx kwarg or extra args; retry
                    # without ctx. This keeps simple tools simple.
                    output = tool.handler(**(args if isinstance(args, dict) else {}))
                duration_ms = int((time.monotonic() - t0) * 1000)

                state['steps'][step_id] = {'output': output, 'duration_ms': duration_ms}
                yield {'type': 'step_end', 'data': {
                    'index': index, 'id': step_id, 'tool': tool_name,
                    'output': output, 'duration_ms': duration_ms,
                }}

            output_path = spec.get('output') or (steps[-1]['id'] if steps else None)
            final_output: Any = None
            if output_path:
                final_output = _resolve_path(state, f'steps.{output_path}.output')
            run.outputs = {'final': final_output, 'state': state}
            run.progress = 100
            run.status = 'completed'
            run.finished_at = timezone.now()
            run.save()
            yield {'type': 'done', 'data': {
                'status': 'completed', 'run_id': str(run.id), 'output': final_output,
            }}
        except Exception as exc:  # noqa: BLE001
            logger.exception('Workflow %s failed: %s', workflow.slug, exc)
            run.status = 'failed'
            run.error_message = str(exc)
            run.finished_at = timezone.now()
            run.save()
            yield {'type': 'error', 'data': {'message': str(exc)}}
            yield {'type': 'done', 'data': {'status': 'failed', 'run_id': str(run.id)}}
