"""
Unit tests for accounts.serializers.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from accounts.serializers import (
    UserSerializer,
    UserCreateSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    ChangePasswordSerializer,
    UserUpdateSerializer,
)

User = get_user_model()
factory = APIRequestFactory()


@pytest.mark.django_db
class TestUserSerializer:
    def test_fields_present(self, user):
        s = UserSerializer(user)
        data = s.data
        assert "email" in data
        assert "subscription_tier" in data
        assert "is_pro" in data
        assert "usage_limit" in data
        assert "usage_remaining" in data
        assert "referral_code" in data
        assert "referral_count" in data

    def test_is_pro_false_for_free_user(self, user):
        assert UserSerializer(user).data["is_pro"] is False

    def test_is_pro_true_for_pro_user(self, pro_user):
        assert UserSerializer(pro_user).data["is_pro"] is True


@pytest.mark.django_db
class TestUserCreateSerializer:
    def test_valid_data(self):
        data = {
            "email": "new@example.com",
            "username": "newuser",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "first_name": "New",
            "last_name": "User",
        }
        s = UserCreateSerializer(data=data)
        assert s.is_valid(), s.errors
        user = s.save()
        assert user.email == "new@example.com"
        assert user.check_password("StrongPass123!")

    def test_password_mismatch(self):
        data = {
            "email": "pw@example.com",
            "password": "StrongPass123!",
            "password_confirm": "Different123!",
        }
        s = UserCreateSerializer(data=data)
        assert not s.is_valid()
        assert "password" in s.errors or "non_field_errors" in s.errors

    def test_invalid_referral_code(self):
        data = {
            "email": "ref@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "referral_code": "INVALID",
        }
        s = UserCreateSerializer(data=data)
        assert not s.is_valid()
        assert "referral_code" in s.errors

    def test_valid_referral_code(self, user):
        data = {
            "email": "ref2@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "referral_code": user.referral_code,
        }
        s = UserCreateSerializer(data=data)
        assert s.is_valid(), s.errors
        new_user = s.save()
        assert new_user.referred_by == user


@pytest.mark.django_db
class TestLoginSerializer:
    def test_valid_credentials(self, user, user_password):
        data = {"email": user.email, "password": user_password}
        s = LoginSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data["user"] == user

    def test_wrong_password(self, user):
        data = {"email": user.email, "password": "WrongPassword!"}
        s = LoginSerializer(data=data)
        assert not s.is_valid()

    def test_nonexistent_email(self):
        data = {"email": "ghost@example.com", "password": "anything"}
        s = LoginSerializer(data=data)
        assert not s.is_valid()


@pytest.mark.django_db
class TestPasswordResetRequestSerializer:
    def test_any_email_passes(self):
        """Validator should always pass to prevent email enumeration."""
        s = PasswordResetRequestSerializer(data={"email": "anybody@example.com"})
        assert s.is_valid()


@pytest.mark.django_db
class TestChangePasswordSerializer:
    def test_valid_change(self, user, user_password):
        request = factory.post("/fake/")
        request.user = user
        data = {
            "old_password": user_password,
            "new_password": "NewStrongPass123!",
            "new_password_confirm": "NewStrongPass123!",
        }
        s = ChangePasswordSerializer(data=data, context={"request": request})
        assert s.is_valid(), s.errors

    def test_wrong_old_password(self, user):
        request = factory.post("/fake/")
        request.user = user
        data = {
            "old_password": "WrongOldPass!",
            "new_password": "NewStrongPass123!",
            "new_password_confirm": "NewStrongPass123!",
        }
        s = ChangePasswordSerializer(data=data, context={"request": request})
        assert not s.is_valid()

    def test_new_passwords_mismatch(self, user, user_password):
        request = factory.post("/fake/")
        request.user = user
        data = {
            "old_password": user_password,
            "new_password": "NewStrongPass123!",
            "new_password_confirm": "Different123!",
        }
        s = ChangePasswordSerializer(data=data, context={"request": request})
        assert not s.is_valid()


@pytest.mark.django_db
class TestUserUpdateSerializer:
    def test_update_profile_fields(self, user):
        request = factory.patch("/fake/")
        request.user = user
        data = {
            "first_name": "Updated",
            "bio": "I am updated",
            "dark_mode": True,
        }
        s = UserUpdateSerializer(user, data=data, partial=True, context={"request": request})
        assert s.is_valid(), s.errors
        updated = s.save()
        assert updated.first_name == "Updated"
        assert updated.bio == "I am updated"
        assert updated.dark_mode is True

    def test_duplicate_username_rejected(self, user, second_user):
        request = factory.patch("/fake/")
        request.user = user
        data = {"username": second_user.username}
        s = UserUpdateSerializer(user, data=data, partial=True, context={"request": request})
        assert not s.is_valid()
        assert "username" in s.errors
