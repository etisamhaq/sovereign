"""
Custom middleware for the AI Writing Platform
"""
import time
import json
import uuid
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger(__name__)


class RequestIDMiddleware(MiddlewareMixin):
    """Attach a unique request ID for log correlation."""

    def process_request(self, request):
        request.request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        return None

    def process_response(self, request, response):
        rid = getattr(request, 'request_id', '')
        if rid:
            response['X-Request-ID'] = rid
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """
    Rate limiting middleware to prevent API abuse
    """

    def process_request(self, request):
        # Skip rate limiting for static files and admin
        if request.path.startswith('/static/') or request.path.startswith('/admin/'):
            return None

        # Get client identifier
        if request.user.is_authenticated:
            client_id = f"user_{str(request.user.id)}"
            # Pro users get higher limits
            if hasattr(request.user, 'is_pro') and request.user.is_pro:
                rate_limit = settings.RATE_LIMIT_PRO
            else:
                rate_limit = settings.RATE_LIMIT_FREE
        else:
            # Use IP address for anonymous users
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            client_id = f"ip_{ip}"
            rate_limit = settings.RATE_LIMIT_ANONYMOUS

        # Define rate limits for different endpoints
        endpoint_limits = {
            '/api/auth/login/': {'requests': 20, 'window': 300},  # 20 requests per 5 minutes
            '/api/auth/register/': {'requests': 10, 'window': 3600},  # 10 requests per hour
            '/api/tools/': {'requests': rate_limit['requests'], 'window': rate_limit['window']},
            '/api/payments/': {'requests': 20, 'window': 60},  # 20 requests per minute
        }

        # Find matching endpoint
        limit_config = None
        for endpoint, config in endpoint_limits.items():
            if request.path.startswith(endpoint):
                limit_config = config
                break

        # If no specific limit, use default
        if not limit_config:
            limit_config = {'requests': 100, 'window': 60}  # 100 requests per minute default

        if request.path.startswith('/health'):
            return None

        cache_key = f"rate_limit:{client_id}"

        # Get current request count
        request_count = cache.get(cache_key, 0)

        if request_count >= limit_config['requests']:
            logger.warning(f"Rate limit exceeded for {client_id} on {request.path}")
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'message': f"You have exceeded the rate limit of {limit_config['requests']} requests per {limit_config['window']} seconds",
                'retry_after': limit_config['window']
            }, status=429)

        # Increment request count
        cache.set(cache_key, request_count + 1, limit_config['window'])

        return None


class UsageTrackingMiddleware(MiddlewareMixin):
    """
    Track API usage for analytics and monitoring
    """

    def process_request(self, request):
        request._start_time = time.time()
        return None

    def process_response(self, request, response):
        # Skip tracking for static files
        if request.path.startswith('/static/') or request.path.startswith('/admin/'):
            return response

        # Calculate processing time
        if hasattr(request, '_start_time'):
            processing_time = time.time() - request._start_time
        else:
            processing_time = 0

        # Track API usage
        if request.path.startswith('/api/'):
            try:
                # Create usage record
                usage_data = {
                    'timestamp': time.time(),
                    'path': request.path,
                    'method': request.method,
                    'user_id': str(request.user.id) if request.user.is_authenticated else None,
                    'ip_address': self.get_client_ip(request),
                    'status_code': response.status_code,
                    'processing_time': processing_time,
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                }

                # Store in cache for batch processing
                cache_key = f"api_usage:{int(time.time())}:{str(request.user.id) if request.user.is_authenticated else 'anonymous'}"
                cache.set(cache_key, json.dumps(usage_data), 3600)  # Keep for 1 hour

                # Update daily statistics
                if request.user.is_authenticated:
                    daily_key = f"daily_usage:{str(request.user.id)}:{time.strftime('%Y-%m-%d')}"
                    daily_count = cache.get(daily_key, 0)
                    cache.set(daily_key, daily_count + 1, 86400)  # Keep for 24 hours

            except Exception as e:
                logger.error(f"Error tracking API usage: {e}")

        # Add rate limit headers to response
        if hasattr(request, '_rate_limit_remaining'):
            response['X-RateLimit-Limit'] = request._rate_limit_limit
            response['X-RateLimit-Remaining'] = request._rate_limit_remaining
            response['X-RateLimit-Reset'] = request._rate_limit_reset

        return response

    def get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Add security headers to responses
    """

    def process_response(self, request, response):
        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Content Security Policy
        if not settings.DEBUG:
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.polar.sh wss:; "
                "frame-src https://polar.sh; "
            )
            response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'

        return response


class APILoggingMiddleware(MiddlewareMixin):
    """
    Log API requests and responses with request ID correlation.
    """

    def process_request(self, request):
        if request.path.startswith('/api/'):
            rid = getattr(request, 'request_id', '-')
            logger.info(f"[{rid}] {request.method} {request.path} user={request.user}")
        return None

    def process_response(self, request, response):
        if request.path.startswith('/api/'):
            rid = getattr(request, 'request_id', '-')
            duration = ''
            if hasattr(request, '_start_time'):
                duration = f' {(time.time() - request._start_time) * 1000:.0f}ms'
            logger.info(f"[{rid}] {request.method} {request.path} -> {response.status_code}{duration}")
        return response

    def process_exception(self, request, exception):
        if request.path.startswith('/api/'):
            rid = getattr(request, 'request_id', '-')
            logger.error(f"[{rid}] {request.method} {request.path} EXCEPTION: {exception}", exc_info=True)
        return None