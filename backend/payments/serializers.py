from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Subscription, Payment, UsageQuota, Invoice

User = get_user_model()


class SubscriptionSerializer(serializers.ModelSerializer):
    is_active = serializers.ReadOnlyField()

    class Meta:
        model = Subscription
        fields = [
            'id', 'polar_subscription_id', 'status',
            'current_period_start', 'current_period_end',
            'cancel_at_period_end', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'polar_transaction_id', 'amount',
            'currency', 'status', 'description',
            'created_at'
        ]
        read_only_fields = fields


class UsageQuotaSerializer(serializers.ModelSerializer):
    has_credits = serializers.ReadOnlyField()

    class Meta:
        model = UsageQuota
        fields = [
            'id', 'monthly_limit', 'current_usage',
            'bonus_credits', 'has_credits', 'reset_date'
        ]
        read_only_fields = fields


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'subtotal', 'tax',
            'total', 'invoice_pdf_url', 'issued_date',
            'due_date', 'paid_date'
        ]
        read_only_fields = fields


class CreateSubscriptionSerializer(serializers.Serializer):
    product_id = serializers.CharField(required=True)


class CancelSubscriptionSerializer(serializers.Serializer):
    cancel_immediately = serializers.BooleanField(default=False)