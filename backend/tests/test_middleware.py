"""
Unit tests for custom middleware classes.
"""
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from django.test import RequestFactory, override_settings
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.models import AnonymousUser

from core.middleware import (
    RateLimitMiddleware,
    UsageTrackingMiddleware,
    SecurityHeadersMiddleware,
    APILoggingMiddleware,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def rf():
    """Django RequestFactory."""
    return RequestFactory()


@pytest.fixture
def get_response():
    """A simple get_response callable that returns 200."""
    def _get_response(request):
        return HttpResponse("OK", status=200)
    return _get_response


# ── SecurityHeadersMiddleware ──────────────────────────────────────

class TestSecurityHeadersMiddleware:
    def test_adds_security_headers(self, rf, get_response):
        middleware = SecurityHeadersMiddleware(get_response)
        request = rf.get("/api/tools/")
        response = middleware(request)

        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["X-Frame-Options"] == "DENY"
        assert response["X-XSS-Protection"] == "1; mode=block"
        assert response["Referrer-Policy"] == "strict-origin-when-cross-origin"

    @override_settings(DEBUG=True)
    def test_no_csp_in_debug(self, rf, get_response):
        middleware = SecurityHeadersMiddleware(get_response)
        request = rf.get("/api/tools/")
        response = middleware(request)
        assert "Content-Security-Policy" not in response

    @override_settings(DEBUG=False)
    def test_csp_in_production(self, rf, get_response):
        middleware = SecurityHeadersMiddleware(get_response)
        request = rf.get("/api/tools/")
        response = middleware(request)
        assert "Content-Security-Policy" in response
        csp = response["Content-Security-Policy"]
        assert "default-src 'self'" in csp
        assert "connect-src" in csp

    def test_headers_on_static_paths(self, rf, get_response):
        middleware = SecurityHeadersMiddleware(get_response)
        request = rf.get("/static/style.css")
        response = middleware(request)
        # Security headers should still be present
        assert response["X-Content-Type-Options"] == "nosniff"

    def test_headers_on_non_api_paths(self, rf, get_response):
        middleware = SecurityHeadersMiddleware(get_response)
        request = rf.get("/some/page/")
        response = middleware(request)
        assert response["X-Frame-Options"] == "DENY"


# ── APILoggingMiddleware ───────────────────────────────────────────

class TestAPILoggingMiddleware:
    def test_logs_api_request(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()

        with patch("core.middleware.logger") as mock_logger:
            middleware.process_request(request)
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args[0][0]
            assert "GET" in call_args
            assert "/api/tools/" in call_args

    def test_does_not_log_non_api(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/static/style.css")
        request.user = AnonymousUser()

        with patch("core.middleware.logger") as mock_logger:
            result = middleware.process_request(request)
            mock_logger.info.assert_not_called()
            assert result is None

    def test_logs_api_response(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()
        response = HttpResponse("OK", status=200)

        with patch("core.middleware.logger") as mock_logger:
            result = middleware.process_response(request, response)
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args[0][0]
            assert "200" in call_args

    def test_does_not_log_non_api_response(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/static/style.css")
        request.user = AnonymousUser()
        response = HttpResponse("OK")

        with patch("core.middleware.logger") as mock_logger:
            middleware.process_response(request, response)
            mock_logger.info.assert_not_called()

    def test_logs_api_exception(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()
        exception = ValueError("Something went wrong")

        with patch("core.middleware.logger") as mock_logger:
            result = middleware.process_exception(request, exception)
            assert result is None  # process_exception returns None
            mock_logger.error.assert_called_once()
            call_args = mock_logger.error.call_args[0][0]
            assert "Something went wrong" in call_args

    def test_does_not_log_non_api_exception(self, rf, get_response):
        middleware = APILoggingMiddleware(get_response)
        request = rf.get("/admin/login/")
        request.user = AnonymousUser()
        exception = ValueError("Oops")

        with patch("core.middleware.logger") as mock_logger:
            result = middleware.process_exception(request, exception)
            assert result is None
            mock_logger.error.assert_not_called()


# ── RateLimitMiddleware ────────────────────────────────────────────

class TestRateLimitMiddleware:
    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_allows_requests_under_limit(self, rf, get_response, user):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = user

        with patch("core.middleware.cache") as mock_cache:
            mock_cache.get.return_value = 0  # No previous requests
            result = middleware.process_request(request)
            assert result is None  # None means continue processing

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_blocks_requests_over_limit(self, rf, get_response, user):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = user

        with patch("core.middleware.cache") as mock_cache:
            mock_cache.get.return_value = 999  # Way over limit
            result = middleware.process_request(request)
            assert isinstance(result, JsonResponse)
            assert result.status_code == 429

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_skips_static_files(self, rf, get_response, user):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/static/app.js")
        request.user = user

        result = middleware.process_request(request)
        assert result is None

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_skips_admin(self, rf, get_response, user):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/admin/")
        request.user = user

        result = middleware.process_request(request)
        assert result is None

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_anonymous_user_uses_ip(self, rf, get_response):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()
        request.META["REMOTE_ADDR"] = "192.168.1.1"

        with patch("core.middleware.cache") as mock_cache:
            mock_cache.get.return_value = 0
            result = middleware.process_request(request)
            assert result is None
            # Verify cache key uses IP
            cache_key = mock_cache.set.call_args[0][0]
            assert "ip_192.168.1.1" in cache_key

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_forwarded_for_ip(self, rf, get_response):
        middleware = RateLimitMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()
        request.META["HTTP_X_FORWARDED_FOR"] = "10.0.0.1, 192.168.1.1"

        with patch("core.middleware.cache") as mock_cache:
            mock_cache.get.return_value = 0
            result = middleware.process_request(request)
            assert result is None
            cache_key = mock_cache.set.call_args[0][0]
            assert "ip_10.0.0.1" in cache_key

    @override_settings(
        RATE_LIMIT_FREE={"requests": 50, "window": 60},
        RATE_LIMIT_PRO={"requests": 200, "window": 60},
        RATE_LIMIT_ANONYMOUS={"requests": 20, "window": 60},
    )
    def test_login_endpoint_specific_limit(self, rf, get_response, user):
        middleware = RateLimitMiddleware(get_response)
        request = rf.post("/api/auth/login/")
        request.user = user

        with patch("core.middleware.cache") as mock_cache:
            mock_cache.get.return_value = 21  # Over login limit of 20
            result = middleware.process_request(request)
            assert isinstance(result, JsonResponse)
            assert result.status_code == 429


# ── UsageTrackingMiddleware ────────────────────────────────────────

class TestUsageTrackingMiddleware:
    def test_sets_start_time_on_request(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()

        middleware.process_request(request)
        assert hasattr(request, "_start_time")

    def test_tracks_api_usage(self, rf, get_response, user):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = user
        request._start_time = 1000.0
        response = HttpResponse("OK", status=200)

        with patch("core.middleware.cache") as mock_cache, \
             patch("core.middleware.time") as mock_time:
            mock_time.time.return_value = 1001.0
            mock_time.strftime.return_value = "2026-02-27"
            mock_cache.get.return_value = 0

            result = middleware.process_response(request, response)
            assert result == response
            # Should have called cache.set at least once for usage data
            assert mock_cache.set.called

    def test_skips_static_files(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/static/style.css")
        request.user = AnonymousUser()
        response = HttpResponse("OK")

        with patch("core.middleware.cache") as mock_cache:
            result = middleware.process_response(request, response)
            assert result == response
            mock_cache.set.assert_not_called()

    def test_skips_admin_paths(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/admin/login/")
        request.user = AnonymousUser()
        response = HttpResponse("OK")

        with patch("core.middleware.cache") as mock_cache:
            result = middleware.process_response(request, response)
            assert result == response
            mock_cache.set.assert_not_called()

    def test_get_client_ip_from_remote_addr(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.META["REMOTE_ADDR"] = "192.168.1.100"

        ip = middleware.get_client_ip(request)
        assert ip == "192.168.1.100"

    def test_get_client_ip_from_forwarded(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.META["HTTP_X_FORWARDED_FOR"] = "10.0.0.5, 192.168.1.1"

        ip = middleware.get_client_ip(request)
        assert ip == "10.0.0.5"

    def test_handles_missing_start_time(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = AnonymousUser()
        # Don't set _start_time
        response = HttpResponse("OK")

        with patch("core.middleware.cache"):
            result = middleware.process_response(request, response)
            assert result == response

    def test_adds_rate_limit_headers(self, rf, get_response):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/some/path/")
        request.user = AnonymousUser()
        request._rate_limit_remaining = 45
        request._rate_limit_limit = 50
        request._rate_limit_reset = 1234567890
        response = HttpResponse("OK")

        result = middleware.process_response(request, response)
        # HTTP headers are stored as strings
        assert result["X-RateLimit-Limit"] == "50"
        assert result["X-RateLimit-Remaining"] == "45"
        assert result["X-RateLimit-Reset"] == "1234567890"

    def test_handles_tracking_error_gracefully(self, rf, get_response, user):
        middleware = UsageTrackingMiddleware(get_response)
        request = rf.get("/api/tools/")
        request.user = user
        request._start_time = 1000.0
        response = HttpResponse("OK", status=200)

        with patch("core.middleware.cache") as mock_cache, \
             patch("core.middleware.time") as mock_time:
            mock_time.time.return_value = 1001.0
            mock_time.strftime.return_value = "2026-02-27"
            mock_cache.set.side_effect = Exception("Cache error")

            # Should not raise, just log the error
            result = middleware.process_response(request, response)
            assert result == response
