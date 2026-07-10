from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class ServiceRequest(models.Model):
    SERVICE_TYPES = (
        ('automation', 'AI Automation Setup'),
        ('agents', 'Custom AI Agents'),
        ('optimization', 'Workflow Optimization'),
    )

    PACKAGE_TIERS = (
        ('starter', 'Starter'),
        ('growth', 'Growth'),
        ('pro', 'Pro'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('refunded', 'Refunded'),
    )

    BUDGET_CHOICES = (
        ('under_500', 'Under $500'),
        ('500_1000', '$500 - $1,000'),
        ('1000_2500', '$1,000 - $2,500'),
        ('2500_5000', '$2,500 - $5,000'),
        ('5000_plus', '$5,000+'),
    )

    TIMELINE_CHOICES = (
        ('asap', 'ASAP (1-2 weeks)'),
        ('standard', 'Standard (2-4 weeks)'),
        ('flexible', 'Flexible (1-2 months)'),
        ('no_rush', 'No Rush (3+ months)'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_requests')

    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES)
    package_tier = models.CharField(max_length=10, choices=PACKAGE_TIERS)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='unpaid')

    name = models.CharField(max_length=255)
    email = models.EmailField()
    business_type = models.CharField(max_length=255)
    requirements = models.TextField()
    tools_used = models.TextField(blank=True, default='')
    budget = models.CharField(max_length=20, choices=BUDGET_CHOICES)
    timeline = models.CharField(max_length=20, choices=TIMELINE_CHOICES)

    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    polar_checkout_id = models.CharField(max_length=255, blank=True, null=True)
    polar_transaction_id = models.CharField(max_length=255, blank=True, null=True)

    ai_summary = models.TextField(blank=True, null=True)
    ai_suggested_solution = models.TextField(blank=True, null=True)

    admin_notes = models.TextField(blank=True, default='')
    delivered_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['service_type']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"{self.name} - {self.get_service_type_display()} ({self.status})"


class BookCallRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    service_type = models.CharField(max_length=20, choices=ServiceRequest.SERVICE_TYPES, blank=True, default='')
    message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'book_call_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.email}"
