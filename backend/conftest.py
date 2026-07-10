"""
Shared pytest fixtures for the AI Writing Platform test suite.
"""
import pytest
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


# ── User fixtures ──────────────────────────────────────────────────

@pytest.fixture
def api_client():
    """Unauthenticated DRF test client."""
    return APIClient()


@pytest.fixture
def user_password():
    return "StrongPass123!"


@pytest.fixture
def user(db, user_password):
    """Regular free-tier user."""
    return User.objects.create_user(
        email="testuser@example.com",
        password=user_password,
        username="testuser",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def pro_user(db, user_password):
    """Pro-tier user with active subscription."""
    u = User.objects.create_user(
        email="prouser@example.com",
        password=user_password,
        username="prouser",
        first_name="Pro",
        last_name="User",
        subscription_tier="pro",
        subscription_end_date=timezone.now() + timedelta(days=30),
    )
    return u


@pytest.fixture
def admin_user(db, user_password):
    """Staff / superuser."""
    return User.objects.create_superuser(
        email="admin@example.com",
        password=user_password,
    )


@pytest.fixture
def second_user(db, user_password):
    """A second regular user for multi-user tests."""
    return User.objects.create_user(
        email="second@example.com",
        password=user_password,
        username="seconduser",
        first_name="Second",
        last_name="User",
    )


@pytest.fixture
def auth_client(api_client, user):
    """Authenticated API client for the regular user."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def pro_auth_client(api_client, pro_user):
    """Authenticated API client for the pro user."""
    api_client.force_authenticate(user=pro_user)
    return api_client


@pytest.fixture
def admin_auth_client(api_client, admin_user):
    """Authenticated API client for the admin user."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def user_tokens(user):
    """JWT token pair for the regular user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


# ── Tool fixtures ──────────────────────────────────────────────────

@pytest.fixture
def tool(db):
    """A generic active tool."""
    from tools.models import Tool
    return Tool.objects.create(
        name="Paraphraser",
        slug="paraphrase",
        description="Paraphrase text in different modes.",
        category="writing",
        icon="edit",
        is_active=True,
        is_premium=False,
    )


@pytest.fixture
def premium_tool(db):
    """A premium-only tool."""
    from tools.models import Tool
    return Tool.objects.create(
        name="Essay Writer",
        slug="essay-writer",
        description="Generate essays on any topic.",
        category="writing",
        icon="book",
        is_active=True,
        is_premium=True,
    )


@pytest.fixture
def inactive_tool(db):
    """An inactive tool that shouldn't appear in lists."""
    from tools.models import Tool
    return Tool.objects.create(
        name="Inactive Tool",
        slug="inactive-tool",
        description="This tool is disabled.",
        category="utility",
        icon="x",
        is_active=False,
    )


@pytest.fixture
def tool_usage(db, user, tool):
    """A sample tool-usage record."""
    from tools.models import ToolUsage
    return ToolUsage.objects.create(
        user=user,
        tool=tool,
        input_data={"text": "Hello world"},
        output_data={"result": "Hi world"},
        processing_time=1.5,
        tokens_used=100,
    )


@pytest.fixture
def document(db, user):
    """A sample document."""
    from tools.models import Document
    return Document.objects.create(
        user=user,
        title="Test Document",
        content="This is a test document with some content.",
        document_type="text",
        word_count=8,
    )


@pytest.fixture
def template(db, user):
    """A sample template."""
    from tools.models import Template
    return Template.objects.create(
        name="Business Email",
        slug="business-email",
        description="A professional business email template.",
        category="business",
        content="Dear {{name}},\n\n{{body}}\n\nBest regards,\n{{sender}}",
        variables=["name", "body", "sender"],
        created_by=user,
    )


# ── Payment / Subscription fixtures ───────────────────────────────

@pytest.fixture
def usage_quota(db, user):
    """UsageQuota for regular user."""
    from payments.models import UsageQuota
    return UsageQuota.objects.create(
        user=user,
        monthly_limit=100,
        current_usage=0,
    )


@pytest.fixture
def subscription(db, user):
    """Active subscription record."""
    from payments.models import Subscription
    return Subscription.objects.create(
        user=user,
        polar_subscription_id="sub_test_123",
        polar_customer_id="cus_test_123",
        polar_product_id="prod_test_123",
        status="active",
        current_period_start=timezone.now() - timedelta(days=15),
        current_period_end=timezone.now() + timedelta(days=15),
    )


@pytest.fixture
def payment(db, user, subscription):
    """A completed payment record."""
    from payments.models import Payment
    return Payment.objects.create(
        user=user,
        subscription=subscription,
        polar_transaction_id="txn_test_123",
        amount=Decimal("3.00"),
        currency="USD",
        status="completed",
    )


# ── Rewards fixtures ──────────────────────────────────────────────

@pytest.fixture
def coin_balance(db, user):
    """CoinBalance for regular user."""
    from rewards.models import CoinBalance
    return CoinBalance.objects.create(
        user=user,
        balance=500,
        total_earned=600,
        total_redeemed=100,
    )


@pytest.fixture
def user_streak(db, user):
    """UserStreak for regular user."""
    from rewards.models import UserStreak
    return UserStreak.objects.create(
        user=user,
        current_streak=5,
        longest_streak=10,
        last_active_date=timezone.now().date(),
    )


@pytest.fixture
def redemption_tier(db):
    """A redemption tier."""
    from rewards.models import RedemptionTier
    return RedemptionTier.objects.create(
        name="Small Pack",
        description="5 bonus credits",
        coin_cost=100,
        bonus_credits=5,
        is_active=True,
    )


# ── Research fixtures ─────────────────────────────────────────────

@pytest.fixture
def research_project(db, user):
    """A research project in completed state."""
    from research.models import ResearchProject
    return ResearchProject.objects.create(
        user=user,
        title="Test Research",
        topic="Artificial Intelligence in Healthcare",
        depth_level="standard",
        status="completed",
        summary="AI is transforming healthcare.",
        key_findings=["Finding 1", "Finding 2"],
        completed_at=timezone.now(),
    )
