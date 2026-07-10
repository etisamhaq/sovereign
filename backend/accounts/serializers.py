from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from .models import PasswordResetToken, EmailVerificationToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    usage_limit = serializers.SerializerMethodField()
    usage_remaining = serializers.SerializerMethodField()
    referral_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name',
            'is_verified', 'is_staff', 'date_joined', 'subscription_tier',
            'monthly_usage_count', 'avatar', 'bio', 'preferred_language',
            'email_notifications', 'dark_mode', 'is_pro',
            'usage_limit', 'usage_remaining', 'referral_code', 'referral_count'
        )
        read_only_fields = ('id', 'date_joined', 'is_verified', 'is_staff', 'is_pro', 'monthly_usage_count', 'referral_code', 'referral_count')

    def get_usage_limit(self, obj):
        return obj.get_usage_limit()

    def get_usage_remaining(self, obj):
        limit = obj.get_usage_limit()
        return max(0, limit - obj.monthly_usage_count)

    def get_referral_count(self, obj):
        return obj.referral_count


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password_confirm', 'first_name', 'last_name', 'referral_code')

    def validate_referral_code(self, value):
        if value:
            value = value.upper().strip()
            if not User.objects.filter(referral_code=value).exists():
                raise serializers.ValidationError('Invalid referral code.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        ref_code = validated_data.pop('referral_code', None)
        user = User.objects.create_user(**validated_data)

        # Link referrer
        if ref_code:
            try:
                referrer = User.objects.get(referral_code=ref_code.upper().strip())
                user.referred_by = referrer
                user.save(update_fields=['referred_by'])
            except User.DoesNotExist:
                pass

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = User.objects.filter(email=email).first()

            if not user:
                raise serializers.ValidationError('Invalid credentials')

            if not user.check_password(password):
                raise serializers.ValidationError('Invalid credentials')

            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')

            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include "email" and "password"')


class TokenSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        # Don't reveal whether the email exists — validation always passes
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField(required=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})

        try:
            reset_token = PasswordResetToken.objects.get(token=attrs['token'])
            if not reset_token.is_valid():
                raise serializers.ValidationError({"token": "Invalid or expired token"})
            attrs['reset_token'] = reset_token
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid token"})

        return attrs


class EmailVerificationSerializer(serializers.Serializer):
    token = serializers.UUIDField(required=True)

    def validate_token(self, value):
        try:
            verification_token = EmailVerificationToken.objects.get(token=value)
            if not verification_token.is_valid():
                raise serializers.ValidationError("Invalid or expired token")
            self.context['verification_token'] = verification_token
        except EmailVerificationToken.DoesNotExist:
            raise serializers.ValidationError("Invalid token")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'bio', 'avatar',
            'preferred_language', 'email_notifications', 'dark_mode'
        )

    def validate_username(self, value):
        user = self.context['request'].user
        if value and User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken")
        return value