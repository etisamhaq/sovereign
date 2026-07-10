"""
Unit tests for payments.models — Subscription, Payment, UsageQuota, Invoice.
"""
import pytest
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from payments.models import Subscription, Payment, UsageQuota, Invoice

User = get_user_model()


@pytest.mark.django_db
class TestSubscriptionModel:
    def test_str(self, subscription, user):
        assert user.email in str(subscription)
        assert "active" in str(subscription)

    def test_is_active_true(self, subscription):
        assert subscription.is_active is True

    def test_is_active_expired(self, user, db):
        sub = Subscription.objects.create(
            user=user,
            polar_subscription_id="sub_exp",
            polar_customer_id="cus_exp",
            polar_product_id="prod_exp",
            status="active",
            current_period_start=timezone.now() - timedelta(days=30),
            current_period_end=timezone.now() - timedelta(days=1),
        )
        assert sub.is_active is False

    def test_is_active_cancelled(self, user, db):
        sub = Subscription.objects.create(
            user=user,
            polar_subscription_id="sub_can",
            polar_customer_id="cus_can",
            polar_product_id="prod_can",
            status="cancelled",
            current_period_start=timezone.now() - timedelta(days=15),
            current_period_end=timezone.now() + timedelta(days=15),
        )
        assert sub.is_active is False


@pytest.mark.django_db
class TestPaymentModel:
    def test_str(self, payment, user):
        assert user.email in str(payment)
        assert "completed" in str(payment)

    def test_default_currency(self, payment):
        assert payment.currency == "USD"

    def test_amount(self, payment):
        assert payment.amount == Decimal("3.00")


@pytest.mark.django_db
class TestUsageQuotaModel:
    def test_str(self, usage_quota, user):
        assert user.email in str(usage_quota)

    def test_has_credits_under_limit(self, usage_quota):
        assert usage_quota.has_credits() is True

    def test_has_credits_at_limit(self, usage_quota):
        usage_quota.current_usage = usage_quota.monthly_limit
        usage_quota.save()
        assert usage_quota.has_credits() is False

    def test_has_credits_with_bonus(self, usage_quota):
        usage_quota.current_usage = usage_quota.monthly_limit
        usage_quota.bonus_credits = 5
        usage_quota.save()
        assert usage_quota.has_credits() is True

    def test_use_credit_normal(self, usage_quota):
        initial = usage_quota.current_usage
        usage_quota.use_credit()
        assert usage_quota.current_usage == initial + 1

    def test_use_credit_bonus_first(self, usage_quota):
        usage_quota.bonus_credits = 3
        usage_quota.save()
        initial_usage = usage_quota.current_usage
        usage_quota.use_credit()
        assert usage_quota.bonus_credits == 2
        assert usage_quota.current_usage == initial_usage  # regular usage unchanged

    def test_reset_monthly_usage(self, usage_quota):
        usage_quota.current_usage = 50
        usage_quota.save()
        usage_quota.reset_monthly_usage()
        assert usage_quota.current_usage == 0

    def test_add_bonus_credits(self, usage_quota):
        initial = usage_quota.bonus_credits
        usage_quota.add_bonus_credits(10)
        assert usage_quota.bonus_credits == initial + 10


@pytest.mark.django_db
class TestInvoiceModel:
    def test_str(self, user, payment):
        invoice = Invoice.objects.create(
            user=user,
            payment=payment,
            invoice_number="INV-001",
            polar_invoice_id="inv_polar_001",
            subtotal=Decimal("3.00"),
            tax=Decimal("0.00"),
            total=Decimal("3.00"),
            issued_date=timezone.now(),
        )
        assert "INV-001" in str(invoice)
        assert user.email in str(invoice)
