import json
from typing import Dict, List

import httpx
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from agents.models import AgentReliabilityAlert


def _is_notification_enabled_for(alert: AgentReliabilityAlert) -> bool:
    severities = getattr(settings, 'AGENT_ALERT_NOTIFY_SEVERITIES', 'critical,warning')
    allowed = {s.strip().lower() for s in str(severities).split(',') if s.strip()}
    return alert.severity.lower() in allowed


def notify_reliability_alert(alert: AgentReliabilityAlert) -> Dict[str, List[str]]:
    if alert.status != 'open' or not _is_notification_enabled_for(alert):
        return {'delivered_channels': []}

    context = alert.context_json or {}
    delivered_channels = set(context.get('delivered_channels', []))

    payload = {
        'id': str(alert.id),
        'alert_type': alert.alert_type,
        'severity': alert.severity,
        'message': alert.message,
        'status': alert.status,
        'created_at': alert.created_at.isoformat() if alert.created_at else timezone.now().isoformat(),
        'user_id': str(alert.user_id) if alert.user_id else None,
        'context': alert.context_json or {},
    }

    email_enabled = str(getattr(settings, 'AGENT_ALERT_NOTIFY_EMAIL_ENABLED', 'true')).lower() == 'true'
    if email_enabled and alert.user and alert.user.email and 'email' not in delivered_channels:
        subject = f"[Sovereign Agent Alert] {alert.severity.upper()} - {alert.alert_type}"
        body = (
            f"Alert: {alert.alert_type}\n"
            f"Severity: {alert.severity}\n"
            f"Message: {alert.message}\n"
            f"Created: {payload['created_at']}\n"
        )
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sovereign.com'),
            recipient_list=[alert.user.email],
            fail_silently=True,
        )
        delivered_channels.add('email')

    webhook_url = getattr(settings, 'AGENT_ALERT_NOTIFY_WEBHOOK_URL', '')
    if webhook_url and 'webhook' not in delivered_channels:
        try:
            response = httpx.post(webhook_url, json=payload, timeout=10)
            if response.status_code < 400:
                delivered_channels.add('webhook')
        except Exception:
            pass

    slack_webhook_url = getattr(settings, 'AGENT_ALERT_NOTIFY_SLACK_WEBHOOK_URL', '')
    if slack_webhook_url and 'slack' not in delivered_channels:
        try:
            slack_payload = {
                'text': f"[{alert.severity.upper()}] {alert.alert_type}",
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': (
                                f"*Sovereign Agent Alert*\n"
                                f"*Type:* `{alert.alert_type}`\n"
                                f"*Severity:* `{alert.severity}`\n"
                                f"*Message:* {alert.message}\n"
                                f"*Run:* `{payload.get('context', {}).get('run_id') or payload.get('id')}`"
                            ),
                        },
                    },
                ],
            }
            response = httpx.post(slack_webhook_url, json=slack_payload, timeout=10)
            if response.status_code < 400:
                delivered_channels.add('slack')
        except Exception:
            pass

    context['delivered_channels'] = sorted(delivered_channels)
    context['last_notified_at'] = timezone.now().isoformat()
    context['notifications_enabled_for'] = sorted({
        s.strip().lower() for s in str(getattr(settings, 'AGENT_ALERT_NOTIFY_SEVERITIES', 'critical,warning')).split(',') if s.strip()
    })
    context['notification_payload_preview'] = json.dumps(payload)[:500]

    alert.context_json = context
    alert.save(update_fields=['context_json', 'updated_at'])

    return {'delivered_channels': sorted(delivered_channels)}
