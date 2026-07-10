"""
Custom middleware for rate limiting and request optimization
"""
import time
import logging
import json
from typing import Optional
from django.core.cache import cache
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from .cache_service import get_quota_cache

logger = logging.getLogger(__name__)


class RateLimitMiddleware(MiddlewareMixin):
    """
    Advanced rate limiting middleware with per-user and per-endpoint limits
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.quota_cache = get_quota_cache()

        # Default rate limits (can be overridden in settings)
        self.default_limits = {
            'anonymous': {
                'per_minute': 10,
                'per_hour': 100,
                'per_day': 500
            },
            'authenticated': {
                'per_minute': 60,
                'per_hour': 1000,
                'per_day': 10000
            },
            'premium': {
                'per_minute': 120,
                'per_hour': 2000,
                'per_day': 50000
            }
        }

        # Tool-specific limits
        self.tool_limits = {
            'paraphrase': {'per_minute': 10, 'per_hour': 100},
            'grammar-check': {'per_minute': 20, 'per_hour': 200},
            'essay-generator': {'per_minute': 5, 'per_hour': 50},
            'research-assistant': {'per_minute': 3, 'per_hour': 30},
        }

    def process_request(self, request):
        """Process incoming request and check rate limits"""

        # Skip rate limiting for static files and admin
        if self._should_skip(request):
            return None

        # Get user tier
        user_tier = self._get_user_tier(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Check global rate limits
        if not self._check_global_limits(client_id, user_tier):
            return self._rate_limit_exceeded_response()

        # Check tool-specific limits for API endpoints
        if request.path.startswith('/api/tools/'):
            tool_slug = self._extract_tool_slug(request.path)
            if tool_slug and not self._check_tool_limits(client_id, tool_slug):
                return self._rate_limit_exceeded_response(tool_specific=True)

        # Add rate limit headers to request for later use
        request.rate_limit_info = {
            'client_id': client_id,
            'user_tier': user_tier,
            'timestamp': time.time()
        }

        return None

    def process_response(self, request, response):
        """Add rate limit headers to response"""

        if hasattr(request, 'rate_limit_info'):
            client_id = request.rate_limit_info['client_id']
            user_tier = request.rate_limit_info['user_tier']

            # Add rate limit headers
            limits = self.default_limits[user_tier]

            # Get current usage
            minute_usage = self._get_usage(client_id, 'minute')
            hour_usage = self._get_usage(client_id, 'hour')

            response['X-RateLimit-Limit-Minute'] = str(limits['per_minute'])
            response['X-RateLimit-Remaining-Minute'] = str(max(0, limits['per_minute'] - minute_usage))
            response['X-RateLimit-Limit-Hour'] = str(limits['per_hour'])
            response['X-RateLimit-Remaining-Hour'] = str(max(0, limits['per_hour'] - hour_usage))

            # Add retry-after header if rate limited
            if response.status_code == 429:
                response['Retry-After'] = '60'

        return response

    def _should_skip(self, request) -> bool:
        """Check if request should skip rate limiting"""
        skip_paths = [
            '/static/',
            '/media/',
            '/admin/',
            '/health/',
            '/metrics/'
        ]
        return any(request.path.startswith(path) for path in skip_paths)

    def _get_user_tier(self, request) -> str:
        """Determine user tier based on authentication and subscription"""
        if not request.user.is_authenticated:
            return 'anonymous'

        # Check if user has premium subscription
        try:
            subscription = request.user.subscription
            if subscription and subscription.is_active:
                return 'premium'
        except Exception:
            pass

        return 'authenticated'

    def _get_client_id(self, request) -> str:
        """Get unique client identifier"""
        if request.user.is_authenticated:
            return f"user_{request.user.id}"

        # For anonymous users, use IP address
        ip = self._get_client_ip(request)
        return f"ip_{ip}"

    def _get_client_ip(self, request) -> str:
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def _check_global_limits(self, client_id: str, user_tier: str) -> bool:
        """Check if client has exceeded global rate limits"""
        limits = self.default_limits[user_tier]

        # Check per-minute limit
        minute_usage = self._increment_usage(client_id, 'minute', 60)
        if minute_usage > limits['per_minute']:
            logger.warning(f"Rate limit exceeded for {client_id}: {minute_usage}/{limits['per_minute']} per minute")
            return False

        # Check per-hour limit
        hour_usage = self._increment_usage(client_id, 'hour', 3600)
        if hour_usage > limits['per_hour']:
            logger.warning(f"Rate limit exceeded for {client_id}: {hour_usage}/{limits['per_hour']} per hour")
            return False

        # Check per-day limit
        day_usage = self._increment_usage(client_id, 'day', 86400)
        if day_usage > limits['per_day']:
            logger.warning(f"Rate limit exceeded for {client_id}: {day_usage}/{limits['per_day']} per day")
            return False

        return True

    def _check_tool_limits(self, client_id: str, tool_slug: str) -> bool:
        """Check tool-specific rate limits"""
        if tool_slug not in self.tool_limits:
            return True

        limits = self.tool_limits[tool_slug]
        tool_client_id = f"{client_id}:tool:{tool_slug}"

        # Check per-minute limit
        if 'per_minute' in limits:
            minute_usage = self._increment_usage(tool_client_id, 'minute', 60)
            if minute_usage > limits['per_minute']:
                logger.warning(f"Tool rate limit exceeded for {tool_slug}: {minute_usage}/{limits['per_minute']} per minute")
                return False

        # Check per-hour limit
        if 'per_hour' in limits:
            hour_usage = self._increment_usage(tool_client_id, 'hour', 3600)
            if hour_usage > limits['per_hour']:
                logger.warning(f"Tool rate limit exceeded for {tool_slug}: {hour_usage}/{limits['per_hour']} per hour")
                return False

        return True

    def _increment_usage(self, client_id: str, period: str, ttl: int) -> int:
        """Increment and get usage count"""
        cache_key = f"rate_limit:{client_id}:{period}"

        try:
            # Use Redis INCR for atomic increment
            from django_redis import get_redis_connection
            redis = get_redis_connection("default")

            pipe = redis.pipeline()
            pipe.incr(cache_key)
            pipe.expire(cache_key, ttl)
            result = pipe.execute()

            return result[0]
        except Exception:
            # Fallback to Django cache
            current = cache.get(cache_key, 0)
            new_value = current + 1
            cache.set(cache_key, new_value, ttl)
            return new_value

    def _get_usage(self, client_id: str, period: str) -> int:
        """Get current usage count without incrementing"""
        cache_key = f"rate_limit:{client_id}:{period}"

        try:
            from django_redis import get_redis_connection
            redis = get_redis_connection("default")
            value = redis.get(cache_key)
            return int(value) if value else 0
        except Exception:
            return cache.get(cache_key, 0)

    def _extract_tool_slug(self, path: str) -> Optional[str]:
        """Extract tool slug from API path"""
        # Path format: /api/tools/{tool-slug}/...
        parts = path.strip('/').split('/')
        if len(parts) >= 3 and parts[0] == 'api' and parts[1] == 'tools':
            return parts[2]
        return None

    def _rate_limit_exceeded_response(self, tool_specific: bool = False) -> JsonResponse:
        """Return rate limit exceeded response"""
        message = "Rate limit exceeded. Please try again later."
        if tool_specific:
            message = "You've reached the usage limit for this tool. Please wait a moment before trying again."

        return JsonResponse({
            'error': message,
            'retry_after': 60
        }, status=429)


class RequestOptimizationMiddleware(MiddlewareMixin):
    """
    Middleware for request optimization and compression
    """

    def process_request(self, request):
        """Process and optimize incoming request"""

        # Add request timing
        request._start_time = time.time()

        # Parse and validate JSON payload for API requests
        if request.content_type == 'application/json' and request.body:
            try:
                request.json = json.loads(request.body)
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON payload'}, status=400)

        return None

    def process_response(self, request, response):
        """Add performance headers to response"""

        # Add response time header
        if hasattr(request, '_start_time'):
            response_time = (time.time() - request._start_time) * 1000  # Convert to ms
            response['X-Response-Time'] = f"{response_time:.2f}ms"

        # Add cache headers for static content
        if request.path.startswith('/static/') or request.path.startswith('/media/'):
            response['Cache-Control'] = 'public, max-age=31536000'  # 1 year

        return response


class HealthCheckMiddleware(MiddlewareMixin):
    """
    Middleware for health check endpoints
    """

    def process_request(self, request):
        """Handle health check requests"""

        if request.path == '/health/':
            return JsonResponse({
                'status': 'healthy',
                'timestamp': time.time()
            })

        if request.path == '/health/ready/':
            # Check if all services are ready
            ready = self._check_readiness()
            status_code = 200 if ready else 503

            return JsonResponse({
                'ready': ready,
                'timestamp': time.time()
            }, status=status_code)

        return None

    def _check_readiness(self) -> bool:
        """Check if all services are ready"""
        try:
            # Check database
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

            # Check Redis
            cache.set('health_check', 'ok', 1)

            # Check Celery
            from celery import current_app
            stats = current_app.control.inspect().stats()
            if not stats:
                return False

            return True
        except Exception as e:
            logger.error(f"Readiness check failed: {e}")
            return False