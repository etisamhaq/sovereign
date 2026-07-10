"""
Unit tests for accounts.models — User, UserManager, PasswordResetToken, EmailVerificationToken.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from accounts.models import PasswordResetToken, EmailVerificationToken

User = get_user_model()


# ── UserManager ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserManager:
    def test_create_user(self):
        user = User.objects.create_user(email="u@example.com", password="Pass1234!")
        assert user.email == "u@example.com"
        assert user.check_password("Pass1234!")
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_create_user_normalizes_email(self):
        user = User.objects.create_user(email="U@EXAMPLE.COM", password="Pass1234!")
        assert user.email == "U@example.com"

    def test_create_user_no_email_raises(self):
        with pytest.raises(ValueError, match="email"):
            User.objects.create_user(email="", password="Pass1234!")

    def test_create_superuser(self):
        su = User.objects.create_superuser(email="su@example.com", password="Pass1234!")
        assert su.is_staff is True
        assert su.is_superuser is True
        assert su.is_active is True

    def test_create_superuser_not_staff_raises(self):
        with pytest.raises(ValueError, match="is_staff"):
            User.objects.create_superuser(email="su2@example.com", password="x", is_staff=False)

    def test_create_superuser_not_superuser_raises(self):
        with pytest.raises(ValueError, match="is_superuser"):
            User.objects.create_superuser(email="su3@example.com", password="x", is_superuser=False)


# ── User model ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserModel:
    def test_str(self, user):
        assert str(user) == user.email

    def test_get_full_name_with_names(self, user):
        assert user.get_full_name() == "Test User"

    def test_get_full_name_without_names(self, db):
        u = User.objects.create_user(email="bare@example.com", password="x")
        assert u.get_full_name() == "bare@example.com"

    def test_get_short_name_with_first_name(self, user):
        assert user.get_short_name() == "Test"

    def test_get_short_name_without_first_name(self, db):
        u = User.objects.create_user(email="short@example.com", password="x")
        assert u.get_short_name() == "short"

    def test_is_pro_free_user(self, user):
        assert user.is_pro is False

    def test_is_pro_with_active_subscription(self, pro_user):
        assert pro_user.is_pro is True

    def test_is_pro_expired_subscription(self, db):
        u = User.objects.create_user(
            email="expired@example.com", password="x",
            subscription_tier="pro",
            subscription_end_date=timezone.now() - timedelta(days=1),
        )
        assert u.is_pro is False

    def test_get_usage_limit_free(self, user):
        from django.conf import settings
        assert user.get_usage_limit() == settings.USAGE_LIMIT_FREE

    def test_get_usage_limit_pro(self, pro_user):
        from django.conf import settings
        assert pro_user.get_usage_limit() == settings.USAGE_LIMIT_PRO

    def test_can_use_tool_within_limit(self, user):
        assert user.can_use_tool() is True

    def test_can_use_tool_over_limit(self, user):
        user.monthly_usage_count = user.get_usage_limit()
        user.save()
        assert user.can_use_tool() is False

    def test_increment_usage(self, user):
        initial_monthly = user.monthly_usage_count
        initial_total = user.total_usage_count
        user.increment_usage()
        assert user.monthly_usage_count == initial_monthly + 1
        assert user.total_usage_count == initial_total + 1

    def test_reset_monthly_usage(self, user):
        user.monthly_usage_count = 50
        user.save()
        user.reset_monthly_usage()
        assert user.monthly_usage_count == 0

    def test_get_usage_info(self, user):
        info = user.get_usage_info()
        assert "monthly_usage" in info
        assert "monthly_limit" in info
        assert "remaining" in info
        assert "percentage_used" in info
        assert "is_pro" in info
        assert info["is_pro"] is False

    def test_referral_code_auto_generated(self, user):
        assert user.referral_code is not None
        assert user.referral_code.startswith("MNT-")

    def test_referral_code_unique(self, user, second_user):
        assert user.referral_code != second_user.referral_code


# ── PasswordResetToken ─────────────────────────────────────────────

@pytest.mark.django_db
class TestPasswordResetToken:
    def test_is_valid_fresh_token(self, user):
        token = PasswordResetToken.objects.create(user=user)
        assert token.is_valid() is True

    def test_is_valid_used_token(self, user):
        token = PasswordResetToken.objects.create(user=user, used=True)
        assert token.is_valid() is False

    def test_is_valid_expired_token(self, user):
        token = PasswordResetToken.objects.create(user=user)
        # Manually set created_at to >1 hour ago
        PasswordResetToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )
        token.refresh_from_db()
        assert token.is_valid() is False


# ── EmailVerificationToken ─────────────────────────────────────────

@pytest.mark.django_db
class TestEmailVerificationToken:
    def test_is_valid_fresh_token(self, user):
        token = EmailVerificationToken.objects.create(user=user)
        assert token.is_valid() is True

    def test_is_valid_used_token(self, user):
        token = EmailVerificationToken.objects.create(user=user, used=True)
        assert token.is_valid() is False

    def test_is_valid_expired_token(self, user):
        token = EmailVerificationToken.objects.create(user=user)
        EmailVerificationToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        token.refresh_from_db()
        assert token.is_valid() is False
