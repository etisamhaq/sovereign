"""
Test settings — overrides for running pytest with SQLite and no external services.
"""
from .settings import *  # noqa: F401,F403

# Ensure DEBUG-like behaviour so SecurityMiddleware doesn't redirect to HTTPS
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0

# Use SQLite for fast, isolated test runs
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable Redis cache — use in-memory LocMemCache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Use console email backend
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Celery: run tasks in-process; avoid Redis broker/result backend from base settings
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

# Speed up password hashing for tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable throttling during tests (keep rates for ScopedRateThrottle scopes
# and any explicitly attached throttle classes).
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []  # noqa: F405
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {  # noqa: F405
    # SimpleRateThrottle subclasses (AnonRateThrottle / UserRateThrottle) are
    # attached on a few enterprise endpoints (e.g. SSO assertion); they
    # require the matching scope rate to be set even when DRF defaults are
    # empty, so we provide generous numbers here.
    'anon': '10000/hour',
    'user': '10000/hour',
    'community_upload': '10000/hour',
    # The agents chat endpoints attach UserRateThrottle subclasses explicitly,
    # so the rates must also be defined even when the default throttle list
    # is empty.
    'agent_chat': '10000/hour',
    'agent_workflow': '10000/hour',
}

# Strip heavy middleware that depends on Redis / external services
MIDDLEWARE = [
    m for m in MIDDLEWARE  # noqa: F405
    if m not in (
        'core.middleware.RateLimitMiddleware',
        'core.middleware.UsageTrackingMiddleware',
        'tools.middleware.RequestOptimizationMiddleware',
        'tools.middleware.HealthCheckMiddleware',
    )
]

# Channels — use in-memory layer
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# Static files — use simple storage for tests
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# Groq — force mock mode
GROQ_API_KEY = ''

# Avoid cross-test pollution from cached community feed (LocMem is process-global)
COMMUNITY_POST_LIST_CACHE_TTL = 0

# Faster tests: no log I/O
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
        'level': 'CRITICAL',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
