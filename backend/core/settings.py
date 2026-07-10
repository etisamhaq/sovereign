"""
Django settings for core project.
"""

from pathlib import Path
import os
import sys
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-dev-only-key-change-in-production')
if not os.getenv('SECRET_KEY') and os.getenv('DJANGO_ENV') == 'production':
    raise ValueError('SECRET_KEY environment variable must be set in production!')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'channels',
    'storages',

    # Local apps
    'accounts',
    'tools',
    'payments',
    'api',
    'research',
    'rewards',
    'community',
    'agents.apps.AgentsConfig',
    'solutions',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.SecurityHeadersMiddleware',
    'core.middleware.RequestIDMiddleware',
    'core.middleware.RateLimitMiddleware',
    'core.middleware.UsageTrackingMiddleware',
    'core.middleware.APILoggingMiddleware',
    # Custom middleware for scaling
    'tools.middleware.RequestOptimizationMiddleware',
    'tools.middleware.HealthCheckMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'ai_writing_platform'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'CONN_MAX_AGE': int(os.getenv('CONN_MAX_AGE', '600')),
        'CONN_HEALTH_CHECKS': True,
    }
}

# Redis URL — single source of truth for cache, channels, celery, services
REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1')

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'IGNORE_EXCEPTIONS': True,
        }
    }
}

# Database connection pooling — keep persistent connections for 10 minutes.
# (CONN_MAX_AGE / CONN_HEALTH_CHECKS also set in DATABASES['default'] above; this
# re-asserts them here for clarity and to keep settings grouped by concern.)
CONN_MAX_AGE = int(os.getenv('CONN_MAX_AGE', '600'))
DATABASES['default']['CONN_MAX_AGE'] = CONN_MAX_AGE
DATABASES['default']['CONN_HEALTH_CHECKS'] = True

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Community rich media (used below for upload limits)
COMMUNITY_MODERATION_NEW_POSTS = (
    os.getenv('COMMUNITY_MODERATION_NEW_POSTS', 'False').lower() == 'true'
)
COMMUNITY_MAX_ATTACHMENTS_PER_POST = int(
    os.getenv('COMMUNITY_MAX_ATTACHMENTS_PER_POST', '6')
)
COMMUNITY_MAX_IMAGES_PER_POST = int(os.getenv('COMMUNITY_MAX_IMAGES_PER_POST', '4'))
COMMUNITY_MAX_VIDEOS_PER_POST = int(os.getenv('COMMUNITY_MAX_VIDEOS_PER_POST', '1'))
COMMUNITY_MAX_IMAGE_BYTES = int(
    os.getenv('COMMUNITY_MAX_IMAGE_BYTES', str(10 * 1024 * 1024))
)
COMMUNITY_MAX_VIDEO_BYTES = int(
    os.getenv('COMMUNITY_MAX_VIDEO_BYTES', str(100 * 1024 * 1024))
)
COMMUNITY_THUMBNAIL_MAX = int(os.getenv('COMMUNITY_THUMBNAIL_MAX', '640'))
COMMUNITY_POST_LIST_CACHE_TTL = int(os.getenv('COMMUNITY_POST_LIST_CACHE_TTL', '45'))

# File upload settings (large enough for community video uploads)
FILE_UPLOAD_MAX_MEMORY_SIZE = min(
    COMMUNITY_MAX_VIDEO_BYTES, 2621440
)  # stream big files to disk via temp
DATA_UPLOAD_MAX_MEMORY_SIZE = COMMUNITY_MAX_VIDEO_BYTES + (4 * 1024 * 1024)

# Allowed video formats
ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg']
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '200/hour',  # Increased from 100
        'user': '2000/hour',  # Increased from 1000
        'public_tools': '5/day',  # Anonymous tool usage limit
        'community_upload': '120/hour',
        # Agentic surface — generous for Pro, tight for free.
        'agent_chat': '120/hour',
        'agent_workflow': '40/hour',
    }
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# CORS settings
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False') == 'True'
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
CORS_ALLOW_CREDENTIALS = True

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_RESULT_EXPIRES = 86400

# Channels
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')],
        },
    },
}

# Email Configuration
if os.getenv('SENDGRID_API_KEY'):
    EMAIL_BACKEND = 'sendgrid_backend.SendgridBackend'
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
    SENDGRID_SANDBOX_MODE_IN_DEBUG = False
else:
    # Fallback to console backend for development
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@sovereign.com')
CONTACT_FORM_EMAIL = os.getenv('CONTACT_FORM_EMAIL', os.getenv('DEFAULT_FROM_EMAIL', 'noreply@sovereign.com'))
API_CONTACT_EMAIL = os.getenv('API_CONTACT_EMAIL', os.getenv('DEFAULT_FROM_EMAIL', 'noreply@sovereign.com'))

# Frontend URL for email links (verification, password reset, etc.)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Public site URL for sitemaps and canonical links
SITE_URL = os.getenv('SITE_URL', 'https://sovereign.com')

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')

# Polar Configuration
POLAR_ACCESS_TOKEN = os.getenv('POLAR_ACCESS_TOKEN', '')
POLAR_WEBHOOK_SECRET = os.getenv('POLAR_WEBHOOK_SECRET', '')
POLAR_CUSTOMER_PORTAL_URL = os.getenv('POLAR_CUSTOMER_PORTAL_URL', 'https://polar.sh/portal')
POLAR_PRO_MONTHLY_PRODUCT_ID = os.getenv('POLAR_PRO_MONTHLY_PRODUCT_ID', '')

# Groq API Configuration with multiple keys support
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'mixtral-8x7b-32768')

# Additional API keys for load balancing
for i in range(1, 11):  # Support up to 10 additional keys
    key_name = f'GROQ_API_KEY_{i}'
    key_value = os.getenv(key_name, '')
    if key_value:
        setattr(sys.modules[__name__], key_name, key_value)

# AI Service Configuration
USE_ASYNC_AI = os.getenv('USE_ASYNC_AI', 'True').lower() == 'true'
AI_CACHE_TTL = int(os.getenv('AI_CACHE_TTL', 86400))  # 24 hours default
AI_MAX_RETRIES = int(os.getenv('AI_MAX_RETRIES', 3))
AI_TIMEOUT = int(os.getenv('AI_TIMEOUT', 30))  # 30 seconds default

# ─── Agents (multi-provider LLM + planner/executor) ────────────────────────
# The "agents" app exposes a tool-calling planner that can run any registered
# AgentTool. Provider choice is layered: Groq is primary; OpenAI / Anthropic /
# Ollama are fallback only when configured.
AGENTS_DEFAULT_PROVIDER = os.getenv('AGENTS_DEFAULT_PROVIDER', 'groq')
AGENTS_PLANNER_MODEL = os.getenv('AGENTS_PLANNER_MODEL', 'llama-3.3-70b-versatile')
AGENTS_MAX_STEPS = int(os.getenv('AGENTS_MAX_STEPS', '6'))
AGENTS_TOOL_TIMEOUT = int(os.getenv('AGENTS_TOOL_TIMEOUT', '60'))
AGENTS_FALLBACK_PROVIDERS = [
    p.strip()
    for p in os.getenv('AGENTS_FALLBACK_PROVIDERS', 'groq').split(',')
    if p.strip()
]
AGENTS_ENABLE_MODERATION = os.getenv('AGENTS_ENABLE_MODERATION', 'True').lower() == 'true'
AGENTS_FREE_TIER_DAILY_LIMIT = int(os.getenv('AGENTS_FREE_TIER_DAILY_LIMIT', '20'))
AGENTS_PRO_TIER_DAILY_LIMIT = int(os.getenv('AGENTS_PRO_TIER_DAILY_LIMIT', '500'))

# Optional fallback provider keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest')
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', '')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1:8b')

# ── AMD Instinct (self-hosted, private) — the data-sovereignty path ─────────
# An open model served on AMD Developer Cloud via vLLM/ROCm, exposing the
# OpenAI-compatible /v1 API. This is the "your data never leaves your GPUs"
# path. AMD_VLLM_API_KEY is usually unset for a self-hosted endpoint.
AMD_VLLM_BASE_URL = os.getenv('AMD_VLLM_BASE_URL', '')  # e.g. http://<instinct-host>:8000/v1
AMD_VLLM_API_KEY = os.getenv('AMD_VLLM_API_KEY', 'EMPTY')
AMD_VLLM_MODEL = os.getenv('AMD_VLLM_MODEL', 'meta-llama/Llama-3.1-8B-Instruct')

# ── Fireworks AI (managed cloud) — the low-latency path ─────────────────────
FIREWORKS_API_KEY = os.getenv('FIREWORKS_API_KEY', '')
FIREWORKS_BASE_URL = os.getenv('FIREWORKS_BASE_URL', 'https://api.fireworks.ai/inference/v1')
FIREWORKS_MODEL = os.getenv('FIREWORKS_MODEL', 'accounts/fireworks/models/llama-v3p1-8b-instruct')

# Sentry — initialized in BOTH default and production settings so dev/staging
# also surface errors. No-ops cleanly when SENTRY_DSN is empty.
SENTRY_DSN = os.getenv('SENTRY_DSN', '')
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.redis import RedisIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
            traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.05')),
            send_default_pii=False,
            environment=os.getenv('DJANGO_ENV', 'development'),
        )
    except Exception:  # pragma: no cover - sentry optional
        pass

# Rate Limiting Configuration
RATE_LIMIT_ANONYMOUS = {
    'requests': 100,
    'window': 60  # 100 requests per minute for anonymous users
}

RATE_LIMIT_FREE = {
    'requests': 100,
    'window': 60  # 60 requests per minute for free users
}

RATE_LIMIT_PRO = {
    'requests': 300,
    'window': 60  # 300 requests per minute for pro users
}

# Usage Limits
USAGE_LIMIT_FREE = 50  # 50 uses per month for free users
USAGE_LIMIT_PRO = 2000  # 2000 uses per month for pro users (effectively unlimited)

# Marketplace settings
# If True, authenticated users can submit external tools for review.
MARKETPLACE_SUBMISSIONS_ENABLED = os.getenv('MARKETPLACE_SUBMISSIONS_ENABLED', 'True').lower() == 'true'

# Agent platform settings
AGENT_ENCRYPTION_KEY = os.getenv('AGENT_ENCRYPTION_KEY', '')
AGENT_MAX_STEPS_PER_RUN = int(os.getenv('AGENT_MAX_STEPS_PER_RUN', '25'))
AGENT_DEFAULT_TIMEOUT_SECONDS = int(os.getenv('AGENT_DEFAULT_TIMEOUT_SECONDS', '90'))
AGENT_CONNECTOR_REFRESH_BUFFER_SECONDS = int(os.getenv('AGENT_CONNECTOR_REFRESH_BUFFER_SECONDS', '300'))
AGENT_ALERT_LOOKBACK_MINUTES = int(os.getenv('AGENT_ALERT_LOOKBACK_MINUTES', '60'))
AGENT_ALERT_MIN_RUNS = int(os.getenv('AGENT_ALERT_MIN_RUNS', '10'))
AGENT_ALERT_FAILED_RUN_RATIO = float(os.getenv('AGENT_ALERT_FAILED_RUN_RATIO', '0.30'))
AGENT_ALERT_NOTIFY_EMAIL_ENABLED = os.getenv('AGENT_ALERT_NOTIFY_EMAIL_ENABLED', 'true').lower() == 'true'
AGENT_ALERT_NOTIFY_WEBHOOK_URL = os.getenv('AGENT_ALERT_NOTIFY_WEBHOOK_URL', '')
AGENT_ALERT_NOTIFY_SEVERITIES = os.getenv('AGENT_ALERT_NOTIFY_SEVERITIES', 'critical,warning')
AGENT_SLO_TARGET_SUCCESS_RATE = float(os.getenv('AGENT_SLO_TARGET_SUCCESS_RATE', '0.99'))
AGENT_MEMORY_VECTOR_DIMENSIONS = int(os.getenv('AGENT_MEMORY_VECTOR_DIMENSIONS', '128'))

# OAuth refresh credentials for connectors
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '')
HUBSPOT_OAUTH_CLIENT_ID = os.getenv('HUBSPOT_OAUTH_CLIENT_ID', '')
HUBSPOT_OAUTH_CLIENT_SECRET = os.getenv('HUBSPOT_OAUTH_CLIENT_SECRET', '')
PIPEDRIVE_OAUTH_CLIENT_ID = os.getenv('PIPEDRIVE_OAUTH_CLIENT_ID', '')
PIPEDRIVE_OAUTH_CLIENT_SECRET = os.getenv('PIPEDRIVE_OAUTH_CLIENT_SECRET', '')
MICROSOFT_OAUTH_CLIENT_ID = os.getenv('MICROSOFT_OAUTH_CLIENT_ID', '')
MICROSOFT_OAUTH_CLIENT_SECRET = os.getenv('MICROSOFT_OAUTH_CLIENT_SECRET', '')
MICROSOFT_OAUTH_TENANT = os.getenv('MICROSOFT_OAUTH_TENANT', 'common')

# Free tier tool slugs - these tools are available to free users
FREE_TOOL_SLUGS = [
    'paraphrase',
    'grammar-check',
    'summarizer',
    'writing-improver',
    'outline-generator',
    'translator',
    'title-generator',
    'citation-generator',
    'flashcard-creator',
    'meta-description-generator',
    'keyword-extractor',
    'linkedin-post-optimizer',
    'video-downloader',
    'roadmap-builder',
    'decision-matrix-builder',
    'itinerary-planner',
    'cover-letter-writer',
]

# Premium-only tool slugs - require Pro subscription
PREMIUM_TOOL_SLUGS = [
    'essay-writer',
    'essay-generator',
    'quiz-generator',
    'course-outline-creator',
    'research-assistant',
    'content-calendar',
    'visisense-ai',
    'video-chat',
    'image-comparison',
    'tone-analyzer',
    'plagiarism-check',
    'content-repurposer',
    'resume-builder',
    'code-generator',
    'blog-post-generator',
    'youtube-script-writer',
    'ad-copy-generator',
    'document-analyzer',
]

# Tell Django to trust X-Forwarded-Proto from nginx reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = os.getenv(
    'CSRF_TRUSTED_ORIGINS',
    'https://sovereign.com,https://www.sovereign.com,http://sovereign.com,http://www.sovereign.com'
).split(',')

# Security Settings (for production)
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Logging Configuration
# Log to a file only when the logs directory is actually writable (local dev).
# In containers (Railway/Docker) that path is owned by root / not writable by the
# runtime user, so fall back to console/stdout — which the platform captures.
_LOG_DIR = BASE_DIR / 'logs'
_FILE_LOGGING = os.getenv('LOG_TO_FILE', 'True').lower() == 'true'
try:
    os.makedirs(_LOG_DIR, exist_ok=True)
    _probe = _LOG_DIR / '.write_test'
    with open(_probe, 'a'):
        pass
    os.remove(_probe)
except Exception:
    _FILE_LOGGING = False

_LOG_HANDLERS = ['console', 'file'] if _FILE_LOGGING else ['console']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'django.utils.log.ServerFormatter',
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        **({'file': {
            'class': 'logging.FileHandler',
            'filename': str(_LOG_DIR / 'django.log'),
            'formatter': 'verbose',
        }} if _FILE_LOGGING else {}),
    },
    'root': {
        'handlers': _LOG_HANDLERS,
        'level': 'INFO',
    },
    'loggers': {
        'django': {'handlers': _LOG_HANDLERS, 'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'), 'propagate': False},
        'agents': {'handlers': _LOG_HANDLERS, 'level': 'INFO', 'propagate': False},
        'tools': {'handlers': _LOG_HANDLERS, 'level': 'INFO', 'propagate': False},
        'solutions': {'handlers': _LOG_HANDLERS, 'level': 'INFO', 'propagate': False},
        'celery': {'handlers': _LOG_HANDLERS, 'level': 'INFO', 'propagate': False},
    },
}

# Optional S3 for uploaded media (community attachments, etc.)
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', '')
if AWS_STORAGE_BUCKET_NAME:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_DEFAULT_ACL = os.getenv('AWS_DEFAULT_ACL', 'public-read')
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# Create logs directory if it doesn't exist
os.makedirs(BASE_DIR / 'logs', exist_ok=True)