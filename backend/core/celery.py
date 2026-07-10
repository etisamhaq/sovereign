import os
from celery import Celery
from celery.schedules import crontab
from celery.signals import celeryd_init
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@celeryd_init.connect
def init_sentry(**kwargs):
    dsn = os.getenv('SENTRY_DSN')
    if dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.celery import CeleryIntegration
            sentry_sdk.init(dsn=dsn, integrations=[CeleryIntegration()], send_default_pii=False)
        except ImportError:
            pass

# Celery Beat Schedule
app.conf.beat_schedule = {
    # Check and reset monthly usage daily at midnight
    'reset-monthly-usage': {
        'task': 'accounts.tasks.reset_monthly_usage',
        'schedule': crontab(minute=0, hour=0),  # Daily at midnight
    },

    # Check usage limits every hour
    'check-usage-limits': {
        'task': 'accounts.tasks.check_usage_limits',
        'schedule': crontab(minute=0),  # Every hour
    },

    # Clean up old data daily at 2 AM
    'cleanup-old-sessions': {
        'task': 'accounts.tasks.cleanup_old_sessions',
        'schedule': crontab(minute=0, hour=2),
    },

    # ── Agent platform (control plane) ────────────────────────────────────
    # Dispatch due scheduled agent triggers every minute
    'scan-scheduled-agent-triggers': {
        'task': 'agents.tasks.scan_scheduled_agent_triggers',
        'schedule': crontab(minute='*'),
    },

    # Check connector OAuth/token health every 15 minutes
    'check-agent-connector-health': {
        'task': 'agents.tasks.check_agent_connector_health',
        'schedule': crontab(minute='*/15'),
    },

    # Evaluate reliability alert signals every 5 minutes
    'evaluate-agent-reliability-alerts': {
        'task': 'agents.tasks.evaluate_agent_reliability_alerts',
        'schedule': crontab(minute='*/5'),
    },

    # Trim abandoned / stale chat conversations daily at 3 AM.
    'agents-cleanup-stale-conversations': {
        'task': 'agents.tasks.cleanup_stale_conversations',
        'schedule': crontab(minute=0, hour=3),
    },

    # ── Tools maintenance ─────────────────────────────────────────────────
    # Monitor Groq API keys (rate limit / circuit breaker state) every 5 minutes.
    'monitor-api-keys': {
        'task': 'tools.monitor_api_keys',
        'schedule': crontab(minute='*/5'),
    },

    # Sweep stale AI cache entries hourly.
    'cleanup-old-cache': {
        'task': 'tools.cleanup_old_cache',
        'schedule': crontab(minute=15),
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')