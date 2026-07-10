from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid
import string
import random


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    SUBSCRIPTION_TIERS = (
        ('free', 'Free'),
        ('pro', 'Pro'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    # Subscription fields
    subscription_tier = models.CharField(max_length=10, choices=SUBSCRIPTION_TIERS, default='free')
    subscription_end_date = models.DateTimeField(null=True, blank=True)
    polar_customer_id = models.CharField(max_length=255, blank=True, null=True)
    polar_subscription_id = models.CharField(max_length=255, blank=True, null=True)

    # Usage tracking
    monthly_usage_count = models.IntegerField(default=0)
    total_usage_count = models.IntegerField(default=0)
    last_usage_reset = models.DateTimeField(default=timezone.now)

    # Profile
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True)
    preferred_language = models.CharField(max_length=10, default='en')

    # Settings
    email_notifications = models.BooleanField(default=True)
    dark_mode = models.BooleanField(default=False)

    # OAuth
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)

    # Referral program
    referral_code = models.CharField(max_length=12, unique=True, null=True, blank=True, db_index=True)
    referred_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='referrals'
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['polar_customer_id']),
        ]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self):
        return self.first_name or self.email.split('@')[0]

    @property
    def is_pro(self):
        return (
            self.subscription_tier == 'pro' and
            self.subscription_end_date and
            self.subscription_end_date > timezone.now()
        )

    def get_usage_limit(self):
        from django.conf import settings
        if self.is_pro:
            return settings.USAGE_LIMIT_PRO  # Pro users
        return settings.USAGE_LIMIT_FREE  # Free users

    def can_use_tool(self, tool_slug=None):
        """Check if user can use a tool. Checks both usage limits and tool access."""
        from django.conf import settings as app_settings

        # Auto-reset monthly usage if a new month has started
        now = timezone.now()
        if self.last_usage_reset.month != now.month or self.last_usage_reset.year != now.year:
            self.reset_monthly_usage()

        # Check usage limit
        limit = self.get_usage_limit()
        if self.monthly_usage_count >= limit:
            return False

        # Check tool access (premium tools require Pro)
        if tool_slug and not self.is_pro:
            if tool_slug in app_settings.PREMIUM_TOOL_SLUGS:
                return False

        return True

    def get_usage_info(self):
        """Return usage info dict for API responses."""
        from django.conf import settings as app_settings
        limit = self.get_usage_limit()
        remaining = max(0, limit - self.monthly_usage_count)
        return {
            'monthly_usage': self.monthly_usage_count,
            'monthly_limit': limit,
            'remaining': remaining,
            'percentage_used': round((self.monthly_usage_count / limit) * 100, 1) if limit > 0 else 0,
            'is_pro': self.is_pro,
            'subscription_tier': self.subscription_tier,
        }

    def increment_usage(self):
        from django.db.models import F
        User.objects.filter(pk=self.pk).update(
            monthly_usage_count=F('monthly_usage_count') + 1,
            total_usage_count=F('total_usage_count') + 1
        )
        self.refresh_from_db(fields=['monthly_usage_count', 'total_usage_count'])

    def reset_monthly_usage(self):
        self.monthly_usage_count = 0
        self.last_usage_reset = timezone.now()
        self.save(update_fields=['monthly_usage_count', 'last_usage_reset'])

    @staticmethod
    def generate_referral_code():
        """Generate a unique 8-char referral code like MNT-A3B7K9."""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = 'MNT-' + ''.join(random.choices(chars, k=6))
            from accounts.models import User as U
            if not U.objects.filter(referral_code=code).exists():
                return code

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = User.generate_referral_code()
        super().save(*args, **kwargs)

    @property
    def referral_count(self):
        return self.referrals.count()


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']

    def is_valid(self):
        # Token is valid for 1 hour (3600 seconds)
        return not self.used and (timezone.now() - self.created_at).total_seconds() < 3600


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verification_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'email_verification_tokens'
        ordering = ['-created_at']

    def is_valid(self):
        # Token is valid for 24 hours (86400 seconds)
        return not self.used and (timezone.now() - self.created_at).total_seconds() < 86400