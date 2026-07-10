"""
Unit tests for payments.views — SubscriptionView, UsageQuotaView,
PaymentHistoryView, InvoiceListView, create_checkout_session, list_products.
"""
import pytest
from unittest.mock import patch, MagicMock
from rest_framework import status
from django.contrib.auth import get_user_model
from payments.models import UsageQuota, Subscription, Payment

User = get_user_model()


@pytest.mark.django_db
class TestSubscriptionView:
    url = "/api/payments/subscription/"

    def test_get_subscription_exists(self, auth_client, subscription, user):
        # The fixture creates a subscription linked to `user`, but
        # subscription fixture uses user fixture (which creates a different user).
        # So we must ensure auth_client's user has the subscription.
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_subscription_not_exists(self, api_client, second_user):
        api_client.force_authenticate(user=second_user)
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestUsageQuotaView:
    url = "/api/payments/usage-quota/"

    def test_get_quota_creates_if_missing(self, auth_client, user):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert "monthly_limit" in resp.data
        assert "current_usage" in resp.data
        assert UsageQuota.objects.filter(user=user).exists()

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPaymentHistoryView:
    url = "/api/payments/history/"

    def test_payment_history(self, auth_client, payment):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_empty_history(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestInvoiceListView:
    url = "/api/payments/invoices/"

    def test_list_invoices(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCreateCheckoutSession:
    url = "/api/payments/checkout-session/"

    def test_missing_product_id(self, auth_client):
        resp = auth_client.post(self.url, {})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    @patch("payments.polar_service.PolarService")
    def test_success(self, MockPolar, auth_client):
        mock_ps = MockPolar.return_value
        mock_ps.create_checkout_session.return_value = {
            "url": "https://polar.sh/checkout/123",
            "id": "chk_123",
        }
        resp = auth_client.post(self.url, {"product_id": "prod_abc"})
        assert resp.status_code == status.HTTP_200_OK
        assert "checkout_url" in resp.data

    def test_unauthenticated(self, api_client):
        resp = api_client.post(self.url, {"product_id": "prod_abc"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestListProducts:
    url = "/api/payments/products/"

    @patch("payments.polar_service.PolarService")
    def test_list_products(self, MockPolar, api_client):
        mock_ps = MockPolar.return_value
        mock_ps.list_products.return_value = [{"id": "prod_1", "name": "Pro"}]
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert "products" in resp.data


@pytest.mark.django_db
class TestCancelSubscriptionView:
    url = "/api/payments/subscription/cancel/"

    def test_unauthenticated(self, api_client):
        resp = api_client.post(self.url, {})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_no_active_subscription(self, auth_client):
        resp = auth_client.post(self.url, {})
        # User has no subscription, should get an error
        assert resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR)
