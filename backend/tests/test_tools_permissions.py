"""
Unit tests for tools.permissions — HasUsageQuota, IsPremiumUser.
"""
import pytest
from unittest.mock import MagicMock
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from tools.permissions import HasUsageQuota, IsPremiumUser
from payments.models import UsageQuota

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.mark.django_db
class TestHasUsageQuota:
    def _make_request(self, rf, user=None):
        request = rf.get("/api/tools/paraphrase/")
        request.user = user if user else MagicMock(is_authenticated=False)
        return request

    def test_unauthenticated_denied(self, rf):
        perm = HasUsageQuota()
        req = self._make_request(rf)
        assert perm.has_permission(req, MagicMock()) is False

    def test_user_with_credits(self, rf, user):
        UsageQuota.objects.create(user=user, monthly_limit=100, current_usage=0)
        perm = HasUsageQuota()
        req = self._make_request(rf, user)
        view = MagicMock()
        assert perm.has_permission(req, view) is True

    def test_user_without_credits(self, rf, user):
        UsageQuota.objects.create(user=user, monthly_limit=10, current_usage=10)
        perm = HasUsageQuota()
        req = self._make_request(rf, user)
        view = MagicMock()
        assert perm.has_permission(req, view) is False

    def test_user_with_bonus_credits(self, rf, user):
        UsageQuota.objects.create(
            user=user, monthly_limit=10, current_usage=10, bonus_credits=5
        )
        perm = HasUsageQuota()
        req = self._make_request(rf, user)
        view = MagicMock()
        assert perm.has_permission(req, view) is True


@pytest.mark.django_db
class TestIsPremiumUser:
    def _make_request(self, rf, user=None):
        request = rf.get("/api/tools/paraphrase/")
        request.user = user if user else MagicMock(is_authenticated=False)
        return request

    def test_unauthenticated_denied(self, rf):
        perm = IsPremiumUser()
        req = self._make_request(rf)
        assert perm.has_permission(req, MagicMock()) is False

    def test_free_user_denied(self, rf, user):
        perm = IsPremiumUser()
        req = self._make_request(rf, user)
        assert perm.has_permission(req, MagicMock()) is False

    def test_pro_user_allowed(self, rf, pro_user):
        perm = IsPremiumUser()
        req = self._make_request(rf, pro_user)
        assert perm.has_permission(req, MagicMock()) is True
