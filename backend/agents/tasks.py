import json
from celery import shared_task
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from agents.models import (
    AgentWorkflowRun,
    AgentWorkflowApproval,
    AgentWorkflowTrigger,
    AgentConnectorAccount,
    AgentReliabilityAlert,
    AgentOrchestrationJob,
    AgentOrchestrationJobStep,
)
from agents.services.workflow_engine import WorkflowEngine
from agents.services.connectors import ensure_connector_token_health
from agents.services.crypto import TokenCipher
from agents.services.reliability_notifications import notify_reliability_alert


def _orchestration_dependencies_satisfied(step, status_by_sequence: dict[int, str]) -> bool:
    deps = step.depends_on_json if isinstance(step.depends_on_json, list) else []
    if not deps and step.sequence > 1:
        deps = [step.sequence - 1]
    for dep in deps:
        dep_status = status_by_sequence.get(int(dep), 'pending')
        if dep_status not in ('succeeded', 'skipped'):
            return False
    return True


def _orchestration_condition_passes(step, status_by_sequence: dict[int, str], outputs_by_sequence: dict[int, dict]) -> bool:
    cond = step.run_if_json if isinstance(step.run_if_json, dict) else {}
    if not cond:
        return True

    step_status_cond = cond.get('step_status')
    if isinstance(step_status_cond, dict):
        sequence = int(step_status_cond.get('sequence', 0) or 0)
        expected = str(step_status_cond.get('equals', '')).strip()
        if sequence and expected:
            return status_by_sequence.get(sequence) == expected

    output_contains = cond.get('previous_output_contains')
    if isinstance(output_contains, dict):
        key = output_contains.get('key')
        expected = output_contains.get('value')
        if key:
            prev_sequences = [s for s in outputs_by_sequence.keys() if s < step.sequence]
            if not prev_sequences:
                return False
            latest = outputs_by_sequence[max(prev_sequences)] or {}
            return latest.get(key) == expected

    if 'any_step_failed' in cond:
        expected = bool(cond.get('any_step_failed'))
        has_failed = any(v == 'failed' for v in status_by_sequence.values())
        return has_failed == expected

    return True


def _upsert_reliability_alert(
    *,
    dedupe_key: str,
    alert_type: str,
    severity: str,
    message: str,
    context_json: dict | None = None,
    user_id=None,
    trigger_id=None,
    run_id=None,
):
    alert, _ = AgentReliabilityAlert.objects.update_or_create(
        dedupe_key=dedupe_key,
        defaults={
            'alert_type': alert_type,
            'severity': severity,
            'status': 'open',
            'message': message,
            'context_json': context_json or {},
            'user_id': user_id,
            'trigger_id': trigger_id,
            'run_id': run_id,
            'resolved_at': None,
        }
    )
    notify_reliability_alert(alert)
    return alert


def _create_run_from_trigger(
    trigger: AgentWorkflowTrigger,
    payload: dict | None = None,
    trigger_source: str = 'api',
) -> AgentWorkflowRun:
    merged_payload = {
        **(trigger.input_defaults_json or {}),
        **(payload or {}),
    }

    run = AgentWorkflowRun.objects.create(
        template=trigger.template,
        created_by=trigger.owner,
        trigger_type='schedule' if trigger_source == 'schedule' else 'api',
        input_payload_json=merged_payload,
        run_context_json={
            'trigger_id': str(trigger.id),
            'trigger_type': trigger.trigger_type,
            'trigger_source': trigger_source,
            'requested_at': timezone.now().isoformat(),
        },
    )

    trigger.last_triggered_at = timezone.now()
    trigger.save(update_fields=['last_triggered_at', 'updated_at'])

    return run


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def execute_agent_workflow_run(self, run_id: str):
    run = AgentWorkflowRun.objects.select_related('template', 'created_by').get(id=run_id)
    engine = WorkflowEngine(run)
    result = engine.execute()
    return {
        'run_id': str(run.id),
        'status': run.status,
        'errors': result.get('errors', []),
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 2})
def execute_agent_orchestration_job(self, job_id: str):
    job = AgentOrchestrationJob.objects.select_related('created_by').get(id=job_id)
    if job.status in ('running', 'succeeded', 'cancelled'):
        return {'job_id': str(job.id), 'status': job.status}

    job.status = 'running'
    job.started_at = timezone.now()
    job.finished_at = None
    job.save(update_fields=['status', 'started_at', 'finished_at', 'updated_at'])

    failed = False
    waiting_approval = False
    status_by_sequence = {}
    outputs_by_sequence = {}

    while True:
        steps = list(job.steps.select_related('template').order_by('sequence'))
        for s in steps:
            status_by_sequence[s.sequence] = s.status
            if s.run_id:
                outputs_by_sequence[s.sequence] = s.run.output_payload_json if s.run else {}

        if any(s.status == 'awaiting_approval' for s in steps):
            waiting_approval = True
            break

        runnable = []
        for step in steps:
            if step.status not in ('pending', 'queued'):
                continue
            if not _orchestration_dependencies_satisfied(step, status_by_sequence):
                continue
            if not _orchestration_condition_passes(step, status_by_sequence, outputs_by_sequence):
                step.status = 'skipped'
                step.save(update_fields=['status', 'updated_at'])
                status_by_sequence[step.sequence] = 'skipped'
                continue
            runnable.append(step)

        if not runnable:
            if any(s.status in ('pending', 'queued', 'running') for s in steps):
                # Deadlock or blocked graph
                unresolved = [s.sequence for s in steps if s.status in ('pending', 'queued', 'running')]
                _upsert_reliability_alert(
                    dedupe_key=f'orchestration_deadlock:{job.id}',
                    alert_type='trigger_dispatch_failure',
                    severity='critical',
                    message=f"Orchestration job '{job.name}' is blocked with unresolved steps {unresolved}.",
                    context_json={'job_id': str(job.id), 'unresolved_steps': unresolved},
                    user_id=job.created_by_id,
                )
                failed = True
            break

        for step in runnable:
            if step.requires_approval and not step.approved_at:
                step.status = 'awaiting_approval'
                step.save(update_fields=['status', 'updated_at'])
                waiting_approval = True
                break

            step.status = 'running'
            step.save(update_fields=['status', 'updated_at'])

            run = AgentWorkflowRun.objects.create(
                template=step.template,
                created_by=job.created_by,
                trigger_type='api',
                input_payload_json=step.input_payload_json or {},
                run_context_json={
                    'orchestration_job_id': str(job.id),
                    'orchestration_step_id': str(step.id),
                    'orchestration_step_sequence': step.sequence,
                },
            )

            step.run = run
            step.save(update_fields=['run', 'updated_at'])

            result = WorkflowEngine(run).execute()
            run.refresh_from_db(fields=['status', 'output_payload_json'])

            if run.status == 'succeeded':
                step.status = 'succeeded'
                step.save(update_fields=['status', 'updated_at'])
                status_by_sequence[step.sequence] = 'succeeded'
                outputs_by_sequence[step.sequence] = run.output_payload_json or {}
            else:
                step.status = 'failed'
                step.save(update_fields=['status', 'updated_at'])
                status_by_sequence[step.sequence] = 'failed'
                failed = True
                _upsert_reliability_alert(
                    dedupe_key=f'orchestration_failure:{job.id}:{step.id}',
                    alert_type='trigger_dispatch_failure',
                    severity='critical',
                    message=f"Orchestration job '{job.name}' failed at step '{step.name}'.",
                    context_json={
                        'job_id': str(job.id),
                        'step_id': str(step.id),
                        'run_id': str(run.id),
                        'errors': result.get('errors', []),
                    },
                    user_id=job.created_by_id,
                    run_id=run.id,
                )
                break

        if failed or waiting_approval:
            break

        if all(s.status in ('succeeded', 'failed', 'skipped') for s in job.steps.all()):
            break

    if waiting_approval:
        job.status = 'waiting_approval'
    else:
        job.status = 'failed' if failed else 'succeeded'
    job.finished_at = timezone.now()
    job.save(update_fields=['status', 'finished_at', 'updated_at'])

    return {
        'job_id': str(job.id),
        'status': job.status,
        'steps_total': AgentOrchestrationJobStep.objects.filter(job=job).count(),
        'steps_failed': AgentOrchestrationJobStep.objects.filter(job=job, status='failed').count(),
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def resume_agent_workflow_after_approval(self, approval_id: str):
    approval = AgentWorkflowApproval.objects.select_related('run').get(id=approval_id)
    run = approval.run
    with transaction.atomic():
        result = WorkflowEngine.resume_after_approval(run)
    return {
        'run_id': str(run.id),
        'status': run.status,
        'errors': result.get('errors', []),
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def dispatch_agent_trigger(self, trigger_id: str, payload: dict | None = None, trigger_source: str = 'api'):
    try:
        trigger = AgentWorkflowTrigger.objects.select_related('template', 'owner').get(id=trigger_id)
        if not trigger.is_active or not trigger.template.is_active:
            return {'trigger_id': trigger_id, 'queued': False, 'reason': 'inactive'}

        run = _create_run_from_trigger(trigger, payload=payload, trigger_source=trigger_source)
        execute_agent_workflow_run.delay(str(run.id))
        return {'trigger_id': trigger_id, 'run_id': str(run.id), 'queued': True}
    except Exception as exc:
        trigger = AgentWorkflowTrigger.objects.filter(id=trigger_id).select_related('owner').first()
        _upsert_reliability_alert(
            dedupe_key=f"trigger_dispatch_failure:{trigger_id}",
            alert_type='trigger_dispatch_failure',
            severity='critical',
            message=f'Trigger dispatch failed for trigger={trigger_id}: {exc}',
            context_json={
                'trigger_id': trigger_id,
                'error': str(exc),
            },
            user_id=trigger.owner_id if trigger else None,
            trigger_id=trigger.id if trigger else None,
        )
        raise


@shared_task(bind=True)
def scan_scheduled_agent_triggers(self):
    now = timezone.now()
    candidates = AgentWorkflowTrigger.objects.filter(
        trigger_type='schedule',
        is_active=True,
        template__is_active=True,
        schedule_every_minutes__isnull=False,
    ).select_related('template', 'owner')

    dispatched = 0
    for trigger in candidates:
        every_minutes = trigger.schedule_every_minutes or 0
        if every_minutes <= 0:
            continue

        if trigger.last_triggered_at:
            elapsed = (now - trigger.last_triggered_at).total_seconds()
            if elapsed < (every_minutes * 60):
                continue

        run = _create_run_from_trigger(trigger, payload=None, trigger_source='schedule')
        execute_agent_workflow_run.delay(str(run.id))
        dispatched += 1

    return {'dispatched': dispatched}


@shared_task(bind=True)
def check_agent_connector_health(self):
    checked = 0
    expired = 0
    refreshed = 0
    errors = 0

    connectors = AgentConnectorAccount.objects.filter(status__in=['connected', 'error']).only(
        'id', 'user_id', 'provider', 'metadata_json', 'status', 'updated_at', 'last_sync_at', 'encrypted_tokens_json'
    )

    for connector in connectors:
        checked += 1
        try:
            token_bundle = {}
            if connector.encrypted_tokens_json:
                decrypted = TokenCipher.decrypt(connector.encrypted_tokens_json)
                if decrypted:
                    token_bundle = json.loads(decrypted)

            before_status = connector.status
            before_expiry = (connector.metadata_json or {}).get('access_token_expires_at')
            ensure_connector_token_health(connector, token_bundle, raise_on_error=False)
            connector.refresh_from_db(fields=['status', 'metadata_json'])
            after_expiry = (connector.metadata_json or {}).get('access_token_expires_at')

            if connector.status == 'expired':
                expired += 1
                _upsert_reliability_alert(
                    dedupe_key=f'connector_auth_failure:{connector.id}:expired',
                    alert_type='connector_auth_failure',
                    severity='critical',
                    message=f'Connector for provider {connector.provider} is expired and requires re-authentication.',
                    context_json={
                        'connector_id': str(connector.id),
                        'provider': connector.provider,
                        'status': connector.status,
                    },
                    user_id=connector.user_id,
                )
            elif connector.status == 'error':
                errors += 1
                _upsert_reliability_alert(
                    dedupe_key=f'connector_auth_failure:{connector.id}:error',
                    alert_type='connector_auth_failure',
                    severity='critical',
                    message=f'Connector token refresh failed for provider {connector.provider}.',
                    context_json={
                        'connector_id': str(connector.id),
                        'provider': connector.provider,
                        'status': connector.status,
                        'refresh_error': (connector.metadata_json or {}).get('last_refresh_error', ''),
                    },
                    user_id=connector.user_id,
                )
            elif before_expiry and before_expiry != after_expiry and before_status in ('connected', 'error'):
                refreshed += 1
        except Exception as exc:
            errors += 1
            _upsert_reliability_alert(
                dedupe_key=f'connector_auth_failure:{connector.id}:exception',
                alert_type='connector_auth_failure',
                severity='critical',
                message=f'Connector health check failed for provider {connector.provider}: {exc}',
                context_json={
                    'connector_id': str(connector.id),
                    'provider': connector.provider,
                    'error': str(exc),
                },
                user_id=connector.user_id,
            )

    return {
        'checked': checked,
        'expired': expired,
        'refreshed': refreshed,
        'errors': errors,
    }


@shared_task(bind=True)
def evaluate_agent_reliability_alerts(self):
    now = timezone.now()
    lookback_minutes = int(getattr(settings, 'AGENT_ALERT_LOOKBACK_MINUTES', 60))
    min_runs = int(getattr(settings, 'AGENT_ALERT_MIN_RUNS', 10))
    failed_ratio_threshold = float(getattr(settings, 'AGENT_ALERT_FAILED_RUN_RATIO', 0.30))
    lookback_start = now - timedelta(minutes=lookback_minutes)

    opened = 0
    resolved = 0

    runs = AgentWorkflowRun.objects.filter(created_at__gte=lookback_start)
    grouped = runs.values('created_by').annotate(
        total=Count('id'),
        failed=Count('id', filter=Q(status='failed')),
    )

    active_failed_ratio_keys = set()
    for bucket in grouped:
        total = bucket['total'] or 0
        if total < min_runs:
            continue
        failed = bucket['failed'] or 0
        ratio = failed / total if total else 0
        if ratio < failed_ratio_threshold:
            continue

        user_id = str(bucket['created_by'])
        dedupe_key = f'failed_run_ratio:{user_id}'
        active_failed_ratio_keys.add(dedupe_key)
        alert, created = AgentReliabilityAlert.objects.update_or_create(
            dedupe_key=dedupe_key,
            defaults={
                'alert_type': 'failed_run_ratio',
                'severity': 'warning' if ratio < 0.5 else 'critical',
                'status': 'open',
                'user_id': bucket['created_by'],
                'message': f'Failed run ratio {ratio:.0%} over last {lookback_minutes} minutes ({failed}/{total}).',
                'context_json': {
                    'failed': failed,
                    'total': total,
                    'ratio': ratio,
                    'window_minutes': lookback_minutes,
                },
                'resolved_at': None,
            }
        )
        if created:
            opened += 1
        notify_reliability_alert(alert)

    stale_triggers = AgentWorkflowTrigger.objects.filter(
        trigger_type='schedule',
        is_active=True,
        schedule_every_minutes__isnull=False,
    ).select_related('owner')

    active_stale_trigger_keys = set()
    for trigger in stale_triggers:
        every = trigger.schedule_every_minutes or 0
        if every <= 0:
            continue
        threshold_minutes = max(3 * every, 15)
        stale_cutoff = now - timedelta(minutes=threshold_minutes)
        if trigger.last_triggered_at and trigger.last_triggered_at >= stale_cutoff:
            continue

        dedupe_key = f'schedule_trigger_stalled:{trigger.id}'
        active_stale_trigger_keys.add(dedupe_key)
        alert, created = AgentReliabilityAlert.objects.update_or_create(
            dedupe_key=dedupe_key,
            defaults={
                'alert_type': 'schedule_trigger_stalled',
                'severity': 'warning',
                'status': 'open',
                'user': trigger.owner,
                'trigger': trigger,
                'message': f"Scheduled trigger '{trigger.name}' appears stalled.",
                'context_json': {
                    'trigger_id': str(trigger.id),
                    'schedule_every_minutes': every,
                    'last_triggered_at': trigger.last_triggered_at.isoformat() if trigger.last_triggered_at else None,
                },
                'resolved_at': None,
            }
        )
        if created:
            opened += 1
        notify_reliability_alert(alert)

    connectors = AgentConnectorAccount.objects.filter(status__in=['expired', 'error'])
    active_connector_auth_keys = {
        f'connector_auth_failure:{connector.id}:expired' if connector.status == 'expired' else f'connector_auth_failure:{connector.id}:error'
        for connector in connectors
    }

    to_resolve = AgentReliabilityAlert.objects.filter(status='open').filter(
        Q(alert_type='failed_run_ratio') | Q(alert_type='schedule_trigger_stalled') | Q(alert_type='connector_auth_failure')
    )
    for alert in to_resolve:
        should_resolve = (
            (alert.alert_type == 'failed_run_ratio' and alert.dedupe_key not in active_failed_ratio_keys)
            or (alert.alert_type == 'schedule_trigger_stalled' and alert.dedupe_key not in active_stale_trigger_keys)
            or (alert.alert_type == 'connector_auth_failure' and alert.dedupe_key not in active_connector_auth_keys)
        )
        if should_resolve:
            alert.status = 'resolved'
            alert.resolved_at = now
            alert.save(update_fields=['status', 'resolved_at', 'updated_at'])
            resolved += 1

    return {
        'opened': opened,
        'resolved': resolved,
        'active_failed_ratio_alerts': len(active_failed_ratio_keys),
        'active_stalled_trigger_alerts': len(active_stale_trigger_keys),
        'active_connector_auth_alerts': len(active_connector_auth_keys),
    }


# ─── Chat runtime maintenance ─────────────────────────────────────────────


@shared_task(bind=True, name='agents.tasks.cleanup_stale_conversations')
def cleanup_stale_conversations(self, *, age_days: int | None = None):
    """Auto-archive empty / abandoned chat conversations.

    Runs daily from Celery Beat. We archive instead of deleting so users
    can recover history if they later open the archived view. Hard delete
    is reserved for the user's explicit "delete" action in the UI.

    A conversation is considered stale when *all* of the following hold:

    1. ``last_message_at`` is older than ``age_days`` (default: 30 days).
    2. It is not yet archived.
    3. It either has no messages, or its most recent message is older than
       the same threshold.
    """
    from agents.models import Conversation

    threshold_days = age_days if age_days is not None else getattr(
        settings, 'AGENTS_STALE_CONVERSATION_DAYS', 30,
    )
    cutoff = timezone.now() - timedelta(days=threshold_days)

    qs = Conversation.objects.filter(
        archived_at__isnull=True,
    ).filter(
        Q(last_message_at__lt=cutoff)
        | (Q(last_message_at__isnull=True) & Q(created_at__lt=cutoff))
    )

    archived_count = qs.update(archived_at=timezone.now())
    return {'archived': archived_count, 'cutoff': cutoff.isoformat()}
