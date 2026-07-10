from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()


class Subscription(models.Model):
    SUBSCRIPTION_STATUS = (
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('past_due', 'Past Due'),
        ('incomplete', 'Incomplete'),
        ('trialing', 'Trialing'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')

    polar_subscription_id = models.CharField(max_length=255, unique=True)
    polar_customer_id = models.CharField(max_length=255)
    polar_product_id = models.CharField(max_length=255)

    status = models.CharField(max_length=20, choices=SUBSCRIPTION_STATUS)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptions'
        indexes = [
            models.Index(fields=['polar_subscription_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.status}"

    @property
    def is_active(self):
        return self.status == 'active' and self.current_period_end > timezone.now()


class Payment(models.Model):
    PAYMENT_STATUS = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    subscription = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True, blank=True)

    polar_transaction_id = models.CharField(max_length=255, unique=True)
    polar_checkout_id = models.CharField(max_length=255, blank=True, null=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS)

    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['polar_transaction_id']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - ${self.amount} - {self.status}"


class UsageQuota(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='usage_quota')

    # Monthly limits
    monthly_limit = models.IntegerField(default=50)  # Free tier: 50 uses/month
    current_usage = models.IntegerField(default=0)
    reset_date = models.DateTimeField(default=timezone.now)

    # Bonus credits
    bonus_credits = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'usage_quotas'

    def __str__(self):
        return f"{self.user.email} - {self.current_usage}/{self.monthly_limit}"

    def has_credits(self):
        return (self.current_usage < self.monthly_limit) or (self.bonus_credits > 0)

    def use_credit(self):
        if self.bonus_credits > 0:
            self.bonus_credits -= 1
        else:
            self.current_usage += 1
        self.save(update_fields=['current_usage', 'bonus_credits'])

    def reset_monthly_usage(self):
        self.current_usage = 0
        self.reset_date = timezone.now()
        self.save(update_fields=['current_usage', 'reset_date'])

    def add_bonus_credits(self, amount):
        self.bonus_credits += amount
        self.save(update_fields=['bonus_credits'])


class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name='invoice')

    invoice_number = models.CharField(max_length=50, unique=True)
    polar_invoice_id = models.CharField(max_length=255, unique=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    invoice_pdf_url = models.URLField(blank=True)

    issued_date = models.DateTimeField()
    due_date = models.DateTimeField(null=True, blank=True)
    paid_date = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-issued_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['polar_invoice_id']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.user.email}"