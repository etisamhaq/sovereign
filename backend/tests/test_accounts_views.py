"""
Unit tests for accounts.views — registration, login, logout, profile,
password reset, email verification, change password.
"""
import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import PasswordResetToken, EmailVerificationToken

User = get_user_model()

# ── Registration ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestRegisterView:
    url = "/api/auth/register/"

    @patch("accounts.views.send_mail")
    def test_register_success(self, mock_mail, api_client):
        data = {
            "email": "new@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "first_name": "New",
            "last_name": "User",
        }
        resp = api_client.post(self.url, data)
        assert resp.status_code == status.HTTP_201_CREATED
        assert "tokens" in resp.data
        assert "user" in resp.data
        assert User.objects.filter(email="new@example.com").exists()

    def test_register_missing_password_confirm(self, api_client):
        data = {
            "email": "fail@example.com",
            "password": "StrongPass123!",
        }
        resp = api_client.post(self.url, data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_duplicate_email(self, api_client, user):
        data = {
            "email": user.email,
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        resp = api_client.post(self.url, data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @patch("accounts.views.send_mail")
    def test_register_with_referral_code(self, mock_mail, api_client, user):
        data = {
            "email": "ref@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "referral_code": user.referral_code,
        }
        resp = api_client.post(self.url, data)
        assert resp.status_code == status.HTTP_201_CREATED
        new_user = User.objects.get(email="ref@example.com")
        assert new_user.referred_by == user


# ── Login ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLoginView:
    url = "/api/auth/login/"

    def test_login_success(self, api_client, user, user_password):
        resp = api_client.post(self.url, {"email": user.email, "password": user_password})
        assert resp.status_code == status.HTTP_200_OK
        assert "tokens" in resp.data
        assert resp.data["user"]["email"] == user.email

    def test_login_wrong_password(self, api_client, user):
        resp = api_client.post(self.url, {"email": user.email, "password": "WrongPass!"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_nonexistent_user(self, api_client):
        resp = api_client.post(self.url, {"email": "ghost@example.com", "password": "x"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_updates_last_login(self, api_client, user, user_password):
        assert user.last_login is None
        api_client.post(self.url, {"email": user.email, "password": user_password})
        user.refresh_from_db()
        assert user.last_login is not None


# ── Logout ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogoutView:
    url = "/api/auth/logout/"

    def test_logout_success(self, auth_client, user):
        refresh = str(RefreshToken.for_user(user))
        resp = auth_client.post(self.url, {"refresh_token": refresh})
        assert resp.status_code == status.HTTP_200_OK

    def test_logout_invalid_token(self, auth_client):
        resp = auth_client.post(self.url, {"refresh_token": "invalid"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_unauthenticated(self, api_client):
        resp = api_client.post(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Profile ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserProfileView:
    url = "/api/auth/profile/"

    def test_get_profile(self, auth_client, user):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["email"] == user.email

    def test_update_profile(self, auth_client, user):
        resp = auth_client.patch(self.url, {"first_name": "Updated"})
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == "Updated"

    def test_profile_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Usage Info ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUsageInfoView:
    url = "/api/auth/usage-info/"

    def test_get_usage_info(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert "monthly_usage" in resp.data
        assert "monthly_limit" in resp.data
        assert "remaining" in resp.data

    def test_usage_info_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Password Reset ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestPasswordResetFlow:
    request_url = "/api/auth/password/reset/"
    confirm_url = "/api/auth/password/reset/confirm/"

    @patch("accounts.views.send_mail")
    def test_reset_request_existing_email(self, mock_mail, api_client, user):
        resp = api_client.post(self.request_url, {"email": user.email})
        assert resp.status_code == status.HTTP_200_OK
        assert PasswordResetToken.objects.filter(user=user).exists()

    def test_reset_request_nonexistent_email(self, api_client):
        """Should still return 200 to prevent email enumeration."""
        resp = api_client.post(self.request_url, {"email": "ghost@example.com"})
        assert resp.status_code == status.HTTP_200_OK

    @patch("accounts.views.send_mail")
    def test_reset_confirm_valid_token(self, mock_mail, api_client, user):
        token = PasswordResetToken.objects.create(user=user)
        data = {
            "token": str(token.token),
            "password": "BrandNewPass123!",
            "password_confirm": "BrandNewPass123!",
        }
        resp = api_client.post(self.confirm_url, data)
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("BrandNewPass123!")

    def test_reset_confirm_invalid_token(self, api_client):
        import uuid
        data = {
            "token": str(uuid.uuid4()),
            "password": "BrandNewPass123!",
            "password_confirm": "BrandNewPass123!",
        }
        resp = api_client.post(self.confirm_url, data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ── Email Verification ─────────────────────────────────────────────

@pytest.mark.django_db
class TestEmailVerificationView:
    url = "/api/auth/email/verify/"

    def test_verify_valid_token(self, api_client, user):
        token = EmailVerificationToken.objects.create(user=user)
        resp = api_client.post(self.url, {"token": str(token.token)})
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_verified is True
        assert "tokens" in resp.data

    def test_verify_invalid_token(self, api_client):
        import uuid
        resp = api_client.post(self.url, {"token": str(uuid.uuid4())})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_used_token(self, api_client, user):
        token = EmailVerificationToken.objects.create(user=user, used=True)
        resp = api_client.post(self.url, {"token": str(token.token)})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ── Change Password ────────────────────────────────────────────────

@pytest.mark.django_db
class TestChangePasswordView:
    url = "/api/auth/password/change/"

    def test_change_password_success(self, auth_client, user, user_password):
        data = {
            "old_password": user_password,
            "new_password": "BrandNewPass123!",
            "new_password_confirm": "BrandNewPass123!",
        }
        resp = auth_client.post(self.url, data)
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("BrandNewPass123!")

    def test_change_password_wrong_old(self, auth_client):
        data = {
            "old_password": "WrongOldPass!",
            "new_password": "BrandNewPass123!",
            "new_password_confirm": "BrandNewPass123!",
        }
        resp = auth_client.post(self.url, data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_mismatch(self, auth_client, user_password):
        data = {
            "old_password": user_password,
            "new_password": "BrandNewPass123!",
            "new_password_confirm": "Different123!",
        }
        resp = auth_client.post(self.url, data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_unauthenticated(self, api_client):
        resp = api_client.post(self.url, {})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
