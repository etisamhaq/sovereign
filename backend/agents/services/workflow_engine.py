import json
import time
from datetime import datetime
from typing import Any, Dict, List

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from agents.models import (
    AgentWorkflowRun,
    AgentWorkflowStepRun,
    AgentWorkflowApproval,
    AgentRunMetric,
    AgentExternalAction,
    AgentConnectorAccount,
    AgentTemplateMemoryPolicy,
)
from agents.services.crypto import TokenCipher
from agents.services.connectors import ensure_connector_token_health
from agents.services.memory_retrieval import retrieve_ranked_memories


class WorkflowEngine:
    """LangGraph-backed workflow executor for Sovereign agents."""

    def __init__(self, run: AgentWorkflowRun):
        self.run = run
        self.template = run.template
        self.execution_started_monotonic: float | None = None
        self.max_steps_per_run = int(getattr(settings, 'AGENT_MAX_STEPS_PER_RUN', 25))
        self.default_timeout_seconds = int(getattr(settings, 'AGENT_DEFAULT_TIMEOUT_SECONDS', 90))

    def execute(self) -> Dict[str, Any]:
        start = time.time()
        self.execution_started_monotonic = time.monotonic()
        self._mark_run_running()

        steps = self.template.definition_json.get('steps', [])
        state: Dict[str, Any] = {
            'run_id': str(self.run.id),
            'input': self.run.input_payload_json,
            'context': self.run.run_context_json or {},
            'outputs': {},
            'errors': [],
        }

        self._inject_memory_retrieval_context(state)

        try:
            self._validate_steps(steps)

            if steps:
                state = self._execute_with_langgraph(steps, state)

            has_approval_wait = AgentWorkflowStepRun.objects.filter(
                run=self.run,
                status='awaiting_approval'
            ).exists()

            if has_approval_wait:
                self._mark_run_waiting_approval(state, start)
            elif state.get('errors'):
                self._mark_run_failed(state, start)
            else:
                self._mark_run_succeeded(state, start)

        except Exception as exc:
            state['errors'].append(str(exc))
            self._mark_run_failed(state, start)

        self._upsert_metrics(state)
        return state

    def _execute_with_langgraph(self, steps: List[Dict[str, Any]], initial_state: Dict[str, Any]) -> Dict[str, Any]:
        try:
            from langgraph.graph import StateGraph, END
        except Exception:
            return self._execute_sequentially(steps, initial_state)

        graph = StateGraph(dict)

        for step in steps:
            step_key = step['key']

            def _node(state: Dict[str, Any], step=step):
                return self._execute_step(step, state)

            graph.add_node(step_key, _node)

        for i, step in enumerate(steps):
            current_key = step['key']
            if i == len(steps) - 1:
                graph.add_edge(current_key, END)
            else:
                graph.add_edge(current_key, steps[i + 1]['key'])

        graph.set_entry_point(steps[0]['key'])
        app = graph.compile()
        return app.invoke(initial_state)

    def _execute_sequentially(self, steps: List[Dict[str, Any]], state: Dict[str, Any]) -> Dict[str, Any]:
        current = state
        for step in steps:
            current = self._execute_step(step, current)
            if current.get('errors'):
                break
            if AgentWorkflowStepRun.objects.filter(run=self.run, step_key=step['key'], status='awaiting_approval').exists():
                break
        return current

    @transaction.atomic
    def _execute_step(self, step: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        self._ensure_not_timed_out()

        # Fresh DB status check so manual cancellation is respected mid-run.
        self.run.refresh_from_db(fields=['status'])
        if self.run.status == 'cancelled':
            state.setdefault('errors', []).append('Run was cancelled.')
            return state

        step_key = step['key']
        step_type = step.get('type', 'transform')
        requires_approval = bool(step.get('requires_approval', False))

        step_run, _ = AgentWorkflowStepRun.objects.get_or_create(
            run=self.run,
            step_key=step_key,
            defaults={
                'step_type': step_type,
                'status': 'queued',
                'input_json': {},
            },
        )

        # Reuse already successful step results for resumptions/retries.
        if step_run.status == 'succeeded':
            state['outputs'][step_key] = step_run.output_json
            return state

        # If already approved then continue with execution
        if step_run.status == 'awaiting_approval':
            approval = AgentWorkflowApproval.objects.filter(step_run=step_run, status='approved').first()
            if not approval:
                return state

        input_payload = self._resolve_step_input(step, state)
        step_run.input_json = input_payload
        step_run.status = 'running'
        step_run.started_at = timezone.now()
        step_run.save(update_fields=['input_json', 'status', 'started_at'])

        t0 = time.time()
        try:
            output = self._dispatch_step(step, input_payload, state)
            latency = int((time.time() - t0) * 1000)
            step_run.output_json = output
            step_run.latency_ms = latency
            step_run.finished_at = timezone.now()

            if requires_approval and not AgentWorkflowApproval.objects.filter(step_run=step_run, status='approved').exists():
                step_run.status = 'awaiting_approval'
                step_run.save(update_fields=['output_json', 'latency_ms', 'finished_at', 'status'])
                AgentWorkflowApproval.objects.get_or_create(
                    run=self.run,
                    step_run=step_run,
                    defaults={
                        'requested_by': self.run.created_by,
                        'status': 'pending',
                    }
                )
                self.run.status = 'waiting_approval'
                self.run.save(update_fields=['status'])
                return state

            step_run.status = 'succeeded'
            step_run.save(update_fields=['output_json', 'latency_ms', 'finished_at', 'status'])
            state['outputs'][step_key] = output
            return state

        except Exception as exc:
            step_run.status = 'failed'
            step_run.error_message = str(exc)
            step_run.finished_at = timezone.now()
            step_run.retry_count += 1
            step_run.save(update_fields=['status', 'error_message', 'finished_at', 'retry_count'])
            state.setdefault('errors', []).append(f"{step_key}: {exc}")
            return state

    def _resolve_step_input(self, step: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        source = step.get('input_from')
        if not source:
            return {
                **state.get('input', {}),
                **step.get('config', {}),
            }

        if source == 'previous_output':
            outputs = state.get('outputs', {})
            if not outputs:
                return step.get('config', {})
            last_key = list(outputs.keys())[-1]
            prev = outputs[last_key]
            if isinstance(prev, dict):
                return {**prev, **step.get('config', {})}
            return {'value': prev, **step.get('config', {})}

        if source.startswith('step:'):
            key = source.replace('step:', '', 1)
            payload = state.get('outputs', {}).get(key, {})
            if isinstance(payload, dict):
                return {**payload, **step.get('config', {})}
            return {'value': payload, **step.get('config', {})}

        if source.startswith('merge:'):
            keys = [k.strip() for k in source.replace('merge:', '', 1).split(',') if k.strip()]
            merged: Dict[str, Any] = {}
            outputs = state.get('outputs', {})
            for key in keys:
                val = outputs.get(key, {})
                if isinstance(val, dict):
                    merged.update(val)
                else:
                    merged[key] = val
            merged.update(step.get('config', {}))
            return merged

        return step.get('config', {})

    def _dispatch_step(self, step: Dict[str, Any], payload: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        step_type = step.get('type')
        action = step.get('action')

        if step_type == 'tool':
            return self._execute_tool_action(action, payload)

        if step_type == 'llm':
            return self._execute_llm_action(payload, state)

        if step_type == 'api_call':
            return self._execute_connector_action(action, payload, step)

        if step_type == 'transform':
            return self._execute_transform_action(action, payload, state)

        if step_type == 'approval':
            return {'status': 'approval_checkpoint'}

        return {'status': 'noop'}

    def _execute_tool_action(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        from agents.services.tool_registry import execute_tool
        return execute_tool(action, payload)

    def _execute_llm_action(self, payload: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        prompt = payload.get('prompt') or payload.get('context')
        if not prompt:
            return {'text': ''}

        memory_context = (state.get('context') or {}).get('retrieved_memory_items') or []
        if memory_context:
            memory_lines = '\n'.join([
                f"- {item.get('memory_type')}::{item.get('key')} => {json.dumps(item.get('value_json', {}))[:400]}"
                for item in memory_context[:8]
            ])
            prompt = f"{prompt}\n\nUse these memory constraints/context:\n{memory_lines}"

        config = payload.get('config') or {}
        system_prompt = config.get('system_prompt', 'You are a helpful AI assistant.')
        temperature = float(config.get('temperature', 0.7))
        max_tokens = int(config.get('max_tokens', 2000))

        from tools.ai_service import AIService
        ai = AIService()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        generated = ai._generate_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            use_cache=False,
        )
        return {'llm_output': generated}

    def _execute_connector_action(self, action: str, payload: Dict[str, Any], step: Dict[str, Any]) -> Dict[str, Any]:
        provider = step.get('provider', 'custom_api')
        connector = AgentConnectorAccount.objects.filter(
            user=self.run.created_by,
            provider=provider,
            status='connected',
        ).first()

        if not connector:
            raise ValueError(f'No connected account for provider: {provider}')

        token_bundle = {}
        if connector.encrypted_tokens_json:
            decrypted = TokenCipher.decrypt(connector.encrypted_tokens_json)
            if decrypted:
                try:
                    token_bundle = json.loads(decrypted)
                except json.JSONDecodeError:
                    token_bundle = {}

            token_bundle = self._ensure_connector_token_health(connector, token_bundle)

        if action == 'custom_webhook_post':
            import httpx
            if not connector.base_url:
                raise ValueError('Connector base_url is required for custom webhook posting')

            request_json = {
                'payload': payload,
                'run_id': str(self.run.id),
                'step_key': step.get('key', ''),
            }
            headers = {'Content-Type': 'application/json'}
            access_token = token_bundle.get('access_token')
            if access_token:
                headers['Authorization'] = f'Bearer {access_token}'

            resp = httpx.post(connector.base_url, json=request_json, headers=headers, timeout=20)
            status = 'succeeded' if resp.status_code < 400 else 'failed'
            action_record, _ = AgentExternalAction.objects.update_or_create(
                idempotency_key=f"{self.run.id}:{step['key']}:{action}",
                defaults={
                    'run': self.run,
                    'step_run': AgentWorkflowStepRun.objects.get(run=self.run, step_key=step['key']),
                    'provider': provider,
                    'action_type': action,
                    'request_json': request_json,
                    'response_json': {'status_code': resp.status_code, 'body': resp.text[:2000]},
                    'status': status,
                    'error_message': '' if status == 'succeeded' else resp.text[:500],
                }
            )
            return {'external_action_id': str(action_record.id), 'status_code': resp.status_code}

        raise ValueError(f'Unsupported connector action: {action}')

    def _ensure_connector_token_health(self, connector: AgentConnectorAccount, token_bundle: Dict[str, Any]) -> Dict[str, Any]:
        return ensure_connector_token_health(
            connector,
            token_bundle,
            raise_on_error=True,
        )

    def _execute_transform_action(self, action: str, payload: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        if action == 'detect_stale_deals':
            deals = payload.get('deals', [])
            stale_days = int(payload.get('stale_days', 7))
            stale = []
            now = timezone.now().date()
            for d in deals:
                last_contact = d.get('last_contact_date')
                if not last_contact:
                    stale.append(d)
                    continue
                try:
                    last_date = datetime.fromisoformat(last_contact).date()
                    if (now - last_date).days >= stale_days:
                        stale.append(d)
                except Exception:
                    stale.append(d)
            return {'stale_deals': stale, 'count': len(stale)}

        if action == 'prepare_followup_payloads':
            stale = payload.get('stale_deals', [])
            prepared = []
            for deal in stale:
                prepared.append({
                    'recipient': deal.get('contact_name') or deal.get('company') or 'Customer',
                    'context': f"Deal '{deal.get('deal_name', 'Unknown')}' is stale. Last stage: {deal.get('stage', 'N/A')}.",
                })
            return {'followups': prepared, 'count': len(prepared)}

        if action == 'json_extract':
            keys = payload.get('config', {}).get('keys', [])
            if not keys and 'keys' in payload:
                keys = payload['keys']
            if isinstance(keys, str):
                keys = [k.strip() for k in keys.split(',')]
            extracted = {}
            for k in keys:
                parts = k.split('.')
                val = payload
                for part in parts:
                    if isinstance(val, dict):
                        val = val.get(part)
                    else:
                        val = None
                        break
                extracted[k.replace('.', '_')] = val
            return extracted

        if action == 'template_render':
            template_str = payload.get('config', {}).get('template', '') or payload.get('template', '')
            if not template_str:
                return payload
            try:
                from jinja2 import Template
                tmpl = Template(template_str)
                rendered = tmpl.render(**payload)
                return {'rendered': rendered}
            except ImportError:
                result = template_str
                for k, v in payload.items():
                    result = result.replace('{{' + k + '}}', str(v) if v is not None else '')
                return {'rendered': result}
            except Exception as e:
                return {'rendered': template_str, 'error': str(e)}

        return payload

    def _mark_run_running(self):
        self.run.status = 'running'
        if not self.run.started_at:
            self.run.started_at = timezone.now()
        self.run.error_summary = ''
        self.run.save(update_fields=['status', 'started_at', 'error_summary'])

    def _inject_memory_retrieval_context(self, state: Dict[str, Any]):
        policy_map = {
            p.key: p.value_json
            for p in AgentTemplateMemoryPolicy.objects.filter(template=self.template, is_active=True)
        }

        policy_limit = (policy_map.get('memory_retrieval_limit') or {}).get('value')
        max_items = int((self.run.input_payload_json or {}).get('memory_retrieval_limit', policy_limit or 8) or 8)
        max_items = max(1, min(max_items, 50))

        include_workspace_memory = bool((policy_map.get('include_workspace_memory') or {}).get('value', False))
        semantic_weight = float((policy_map.get('memory_semantic_weight') or {}).get('value', 0.8) or 0.8)
        lexical_weight = float((policy_map.get('memory_lexical_weight') or {}).get('value', 0.2) or 0.2)
        workspace_id = self.template.workspace_id if include_workspace_memory else None

        memory_items = retrieve_ranked_memories(
            user_id=self.run.created_by_id,
            input_payload=self.run.input_payload_json or {},
            limit=max_items,
            include_workspace_memory=include_workspace_memory,
            workspace_id=workspace_id,
            semantic_weight=semantic_weight,
            lexical_weight=lexical_weight,
        )

        state.setdefault('context', {})['retrieved_memory_items'] = memory_items
        state['context']['retrieved_memory_count'] = len(memory_items)
        state['context']['memory_retrieval_strategy'] = 'vector_semantic_ranked'

        run_context = self.run.run_context_json or {}
        run_context['retrieved_memory_count'] = len(memory_items)
        run_context['retrieved_memory_keys'] = [f"{m['memory_type']}:{m['key']}" for m in memory_items[:20]]
        run_context['retrieved_memory_scores'] = [m.get('score', 0.0) for m in memory_items[:20]]
        run_context['memory_retrieval_strategy'] = 'vector_semantic_ranked'
        run_context['memory_policy'] = {
            'limit': max_items,
            'include_workspace_memory': include_workspace_memory,
            'semantic_weight': semantic_weight,
            'lexical_weight': lexical_weight,
        }
        self.run.run_context_json = run_context
        self.run.save(update_fields=['run_context_json', 'updated_at'])

    def _validate_steps(self, steps: List[Dict[str, Any]]):
        if len(steps) > self.max_steps_per_run:
            raise ValueError(
                f"Workflow template has {len(steps)} steps, exceeding AGENT_MAX_STEPS_PER_RUN={self.max_steps_per_run}."
            )

        seen = set()
        for step in steps:
            key = step.get('key')
            if not key:
                raise ValueError('Each workflow step must include a non-empty key.')
            if key in seen:
                raise ValueError(f"Duplicate workflow step key detected: {key}")
            seen.add(key)

    def _ensure_not_timed_out(self):
        if self.execution_started_monotonic is None:
            return

        timeout_seconds = self.default_timeout_seconds
        timeout_override = (self.run.input_payload_json or {}).get('timeout_seconds')
        if isinstance(timeout_override, int) and timeout_override > 0:
            timeout_seconds = min(timeout_override, self.default_timeout_seconds)

        elapsed = time.monotonic() - self.execution_started_monotonic
        if elapsed > timeout_seconds:
            raise TimeoutError(
                f"Run exceeded timeout ({timeout_seconds}s). Elapsed={elapsed:.2f}s"
            )

    def _mark_run_waiting_approval(self, state: Dict[str, Any], start: float):
        duration_ms = int((time.time() - start) * 1000)
        self.run.status = 'waiting_approval'
        self.run.output_payload_json = state.get('outputs', {})
        self.run.duration_ms = duration_ms
        self.run.save(update_fields=['status', 'output_payload_json', 'duration_ms'])

    def _mark_run_succeeded(self, state: Dict[str, Any], start: float):
        finished = timezone.now()
        duration_ms = int((time.time() - start) * 1000)
        self.run.status = 'succeeded'
        self.run.finished_at = finished
        self.run.duration_ms = duration_ms
        self.run.output_payload_json = state.get('outputs', {})
        self.run.error_summary = ''
        self.run.save(update_fields=['status', 'finished_at', 'duration_ms', 'output_payload_json', 'error_summary'])

    def _mark_run_failed(self, state: Dict[str, Any], start: float):
        finished = timezone.now()
        duration_ms = int((time.time() - start) * 1000)
        self.run.status = 'failed'
        self.run.finished_at = finished
        self.run.duration_ms = duration_ms
        self.run.output_payload_json = state.get('outputs', {})
        self.run.error_summary = '\n'.join(state.get('errors', []))[:3000]
        self.run.save(update_fields=['status', 'finished_at', 'duration_ms', 'output_payload_json', 'error_summary'])

    def _upsert_metrics(self, state: Dict[str, Any]):
        step_qs = self.run.step_runs.all()
        total_tokens = sum(s.tokens_input + s.tokens_output for s in step_qs)
        steps_total = step_qs.count()
        steps_failed = step_qs.filter(status='failed').count()
        steps_retried = step_qs.filter(retry_count__gt=0).count()

        AgentRunMetric.objects.update_or_create(
            run=self.run,
            defaults={
                'total_tokens': total_tokens,
                'estimated_cost_usd': round(total_tokens * 0.000002, 6),
                'steps_total': steps_total,
                'steps_failed': steps_failed,
                'steps_retried': steps_retried,
                'roi_proxy_json': {
                    'run_status': self.run.status,
                    'generated_outputs': len(state.get('outputs', {})),
                },
            },
        )

        self._maybe_record_usage_meter()

    def _maybe_record_usage_meter(self):
        if self.run.status not in ('succeeded', 'failed', 'cancelled'):
            return

        context = self.run.run_context_json or {}
        if context.get('usage_metered'):
            return

        try:
            from payments.models import UsageQuota
        except Exception:
            return

        quota, _ = UsageQuota.objects.get_or_create(user=self.run.created_by)
        quota.use_credit()

        context['usage_metered'] = True
        context['usage_metered_at'] = timezone.now().isoformat()
        self.run.run_context_json = context
        self.run.save(update_fields=['run_context_json', 'updated_at'])

    @classmethod
    def resume_after_approval(cls, run: AgentWorkflowRun) -> Dict[str, Any]:
        # Reset pending approval step(s) to queued for rerun
        pending_steps = run.step_runs.filter(status='awaiting_approval')
        if pending_steps.exists():
            pending_steps.update(status='queued')

        engine = cls(run)
        return engine.execute()

    @staticmethod
    def ensure_default_templates(user=None):
        from agents.models import AgentWorkflowTemplate

        templates = [
            {
                'name': 'Content Repurposing Agent',
                'slug': 'content-repurposing-agent',
                'description': 'Process source content, extract insights, and generate cross-platform assets.',
                'template_type': 'content_repurpose',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'process_source',
                            'type': 'tool',
                            'action': 'content_repurposer_process',
                            'input_from': None,
                            'config': {},
                        },
                        {
                            'key': 'generate_content',
                            'type': 'tool',
                            'action': 'content_repurposer_generate',
                            'input_from': 'step:process_source',
                            'config': {
                                'platforms': ['linkedin', 'twitter', 'newsletter']
                            },
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {
                    'platforms': ['linkedin', 'twitter', 'newsletter']
                },
            },
            {
                'name': 'Revenue Ops Follow-up Agent',
                'slug': 'revenue-ops-followup-agent',
                'description': 'Detect stale deals, prepare followups, draft email copy, and push to external endpoint.',
                'template_type': 'revenue_ops',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'detect_stale_deals',
                            'type': 'transform',
                            'action': 'detect_stale_deals',
                            'input_from': None,
                            'config': {'stale_days': 7},
                        },
                        {
                            'key': 'prepare_followups',
                            'type': 'transform',
                            'action': 'prepare_followup_payloads',
                            'input_from': 'step:detect_stale_deals',
                            'config': {},
                        },
                        {
                            'key': 'draft_followup',
                            'type': 'tool',
                            'action': 'draft_followup_email',
                            'input_from': 'step:prepare_followups',
                            'config': {},
                            'requires_approval': True,
                        },
                        {
                            'key': 'send_to_webhook',
                            'type': 'api_call',
                            'provider': 'custom_api',
                            'action': 'custom_webhook_post',
                            'input_from': 'step:draft_followup',
                            'config': {},
                        },
                    ]
                },
                'default_config_json': {
                    'stale_days': 7
                },
            },
            {
                'name': 'SEO Execution Agent',
                'slug': 'seo-execution-agent',
                'description': 'Generate SEO content plan and platform-ready social amplification.',
                'template_type': 'seo_execution',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'seo_ideation',
                            'type': 'llm',
                            'action': 'llm_generate',
                            'input_from': None,
                            'config': {},
                        },
                        {
                            'key': 'approve_plan',
                            'type': 'approval',
                            'action': 'approval_checkpoint',
                            'input_from': 'step:seo_ideation',
                            'config': {},
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {},
            },
            {
                'name': 'Blog Content Pipeline',
                'slug': 'blog-content-pipeline',
                'description': 'Generate a complete blog post with SEO metadata and social promotion posts from a topic.',
                'template_type': 'content_pipeline',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'research_keywords',
                            'type': 'tool',
                            'action': 'extract_keywords',
                            'input_from': None,
                            'config': {'max_keywords': 10},
                        },
                        {
                            'key': 'write_blog',
                            'type': 'tool',
                            'action': 'generate_blog_post',
                            'input_from': 'step:research_keywords',
                            'config': {'tone': 'informative', 'length': 'long'},
                        },
                        {
                            'key': 'create_meta',
                            'type': 'tool',
                            'action': 'generate_meta_description',
                            'input_from': 'step:write_blog',
                            'config': {'tone': 'professional'},
                        },
                        {
                            'key': 'create_social',
                            'type': 'tool',
                            'action': 'generate_social_posts',
                            'input_from': 'step:write_blog',
                            'config': {'platforms': ['linkedin', 'twitter'], 'include_hashtags': True},
                        },
                        {
                            'key': 'review',
                            'type': 'approval',
                            'action': 'approval_checkpoint',
                            'input_from': 'step:create_social',
                            'config': {},
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {'tone': 'informative', 'length': 'long'},
            },
            {
                'name': 'Lead Outreach Agent',
                'slug': 'lead-outreach-agent',
                'description': 'Research a company or person via URL, summarize findings, and draft a personalized outreach email.',
                'template_type': 'sales_outreach',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'fetch_info',
                            'type': 'tool',
                            'action': 'http_request',
                            'input_from': None,
                            'config': {'method': 'GET'},
                        },
                        {
                            'key': 'summarize_lead',
                            'type': 'tool',
                            'action': 'ai_summarize',
                            'input_from': 'step:fetch_info',
                            'config': {'max_length': 400},
                        },
                        {
                            'key': 'draft_outreach',
                            'type': 'tool',
                            'action': 'generate_email',
                            'input_from': 'step:summarize_lead',
                            'config': {'email_type': 'cold-outreach', 'tone': 'professional'},
                        },
                        {
                            'key': 'review_email',
                            'type': 'approval',
                            'action': 'approval_checkpoint',
                            'input_from': 'step:draft_outreach',
                            'config': {},
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {'email_type': 'cold-outreach'},
            },
            {
                'name': 'Document Analyzer Agent',
                'slug': 'document-analyzer-agent',
                'description': 'Analyze documents to extract insights, generate an executive summary, outline, and quality check.',
                'template_type': 'document_analysis',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'analyze',
                            'type': 'tool',
                            'action': 'analyze_document',
                            'input_from': None,
                            'config': {'analysis_type': 'comprehensive'},
                        },
                        {
                            'key': 'summarize',
                            'type': 'tool',
                            'action': 'ai_summarize',
                            'input_from': 'step:analyze',
                            'config': {'max_length': 500},
                        },
                        {
                            'key': 'create_outline',
                            'type': 'tool',
                            'action': 'generate_outline',
                            'input_from': 'step:analyze',
                            'config': {'outline_type': 'report'},
                        },
                        {
                            'key': 'grammar_check',
                            'type': 'tool',
                            'action': 'check_grammar',
                            'input_from': 'step:summarize',
                            'config': {},
                        },
                    ]
                },
                'default_config_json': {'analysis_type': 'comprehensive'},
            },
            {
                'name': 'Ad Campaign Creator',
                'slug': 'ad-campaign-creator',
                'description': 'Generate advertising copy for multiple platforms with supporting social posts and keyword suggestions.',
                'template_type': 'ad_campaign',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'generate_ads',
                            'type': 'tool',
                            'action': 'generate_ad_copy',
                            'input_from': None,
                            'config': {'platform': 'google', 'num_variations': 3},
                        },
                        {
                            'key': 'create_social',
                            'type': 'tool',
                            'action': 'generate_social_posts',
                            'input_from': 'step:generate_ads',
                            'config': {'platforms': ['facebook', 'linkedin', 'twitter']},
                        },
                        {
                            'key': 'extract_keywords',
                            'type': 'tool',
                            'action': 'extract_keywords',
                            'input_from': 'step:generate_ads',
                            'config': {'max_keywords': 15},
                        },
                        {
                            'key': 'approve_campaign',
                            'type': 'approval',
                            'action': 'approval_checkpoint',
                            'input_from': 'step:extract_keywords',
                            'config': {},
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {'platform': 'google', 'num_variations': 3},
            },
            {
                'name': 'Email Sequence Agent',
                'slug': 'email-sequence-agent',
                'description': 'Generate a complete multi-email outreach or nurture sequence with intro, follow-ups, and closing.',
                'template_type': 'email_sequence',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'draft_intro',
                            'type': 'tool',
                            'action': 'generate_email',
                            'input_from': None,
                            'config': {'email_type': 'cold-outreach', 'tone': 'professional'},
                        },
                        {
                            'key': 'draft_followup1',
                            'type': 'tool',
                            'action': 'generate_email',
                            'input_from': 'step:draft_intro',
                            'config': {'email_type': 'follow-up', 'tone': 'friendly'},
                        },
                        {
                            'key': 'draft_followup2',
                            'type': 'tool',
                            'action': 'generate_email',
                            'input_from': 'step:draft_followup1',
                            'config': {'email_type': 'follow-up', 'tone': 'value-driven'},
                        },
                        {
                            'key': 'draft_breakup',
                            'type': 'tool',
                            'action': 'generate_email',
                            'input_from': 'step:draft_followup2',
                            'config': {'email_type': 'last-chance', 'tone': 'direct'},
                        },
                        {
                            'key': 'review_sequence',
                            'type': 'approval',
                            'action': 'approval_checkpoint',
                            'input_from': 'step:draft_breakup',
                            'config': {},
                            'requires_approval': True,
                        },
                    ]
                },
                'default_config_json': {'email_type': 'cold-outreach'},
            },
            {
                'name': 'Writing Prompt Pack',
                'slug': 'writing-prompt-pack',
                'description': 'A curated collection of AI writing prompts for blog posts, LinkedIn thought leadership, and newsletter intros in different tones.',
                'template_type': 'prompt_pack',
                'definition_json': {
                    'steps': [
                        {
                            'key': 'blog_ideas',
                            'type': 'llm',
                            'action': 'llm_generate',
                            'input_from': None,
                            'config': {
                                'system_prompt': 'You are a creative content strategist. Generate 5 compelling blog post ideas with working titles and a one-sentence hook for each.',
                                'temperature': 0.9,
                                'max_tokens': 1000,
                            },
                        },
                        {
                            'key': 'linkedin_posts',
                            'type': 'llm',
                            'action': 'llm_generate',
                            'input_from': 'step:blog_ideas',
                            'config': {
                                'system_prompt': 'You are a LinkedIn thought leadership ghostwriter. Take the blog ideas provided and create 3 LinkedIn posts (professional tone, include a hook, story, and CTA).',
                                'temperature': 0.8,
                                'max_tokens': 1500,
                            },
                        },
                        {
                            'key': 'newsletter_intros',
                            'type': 'llm',
                            'action': 'llm_generate',
                            'input_from': 'step:blog_ideas',
                            'config': {
                                'system_prompt': 'You are an email newsletter writer. Create 3 engaging newsletter intro paragraphs based on the blog ideas. Use a conversational, friendly tone.',
                                'temperature': 0.7,
                                'max_tokens': 1000,
                            },
                        },
                    ]
                },
                'default_config_json': {},
            },
        ]

        for t in templates:
            AgentWorkflowTemplate.objects.update_or_create(
                slug=t['slug'],
                version=1,
                defaults={
                    **t,
                    'is_public': True,
                    'is_active': True,
                    'created_by': user,
                }
            )
