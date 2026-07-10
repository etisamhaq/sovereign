from rest_framework import serializers
from .models import ServiceRequest, BookCallRequest


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = (
            'service_type', 'package_tier', 'name', 'email',
            'business_type', 'requirements', 'tools_used',
            'budget', 'timeline',
        )

    def validate_requirements(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError(
                'Please provide at least 20 characters describing your requirements.'
            )
        return value


class ServiceRequestListSerializer(serializers.ModelSerializer):
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    package_tier_display = serializers.CharField(source='get_package_tier_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ServiceRequest
        fields = (
            'id', 'service_type', 'service_type_display',
            'package_tier', 'package_tier_display',
            'status', 'status_display', 'payment_status',
            'name', 'email', 'business_type', 'requirements',
            'tools_used', 'budget', 'timeline', 'amount',
            'ai_summary', 'ai_suggested_solution',
            'delivered_url', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class ServiceRequestAdminSerializer(serializers.ModelSerializer):
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    package_tier_display = serializers.CharField(source='get_package_tier_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True, default=None)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = (
            'id', 'user', 'user_email', 'user_name',
            'service_type', 'service_type_display',
            'package_tier', 'package_tier_display',
            'status', 'status_display', 'payment_status',
            'name', 'email', 'business_type', 'requirements',
            'tools_used', 'budget', 'timeline', 'amount',
            'polar_checkout_id', 'polar_transaction_id',
            'ai_summary', 'ai_suggested_solution',
            'admin_notes', 'delivered_url',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'user', 'user_email', 'user_name',
            'service_type', 'service_type_display',
            'package_tier', 'package_tier_display',
            'name', 'email', 'business_type', 'requirements',
            'tools_used', 'budget', 'timeline', 'amount',
            'polar_checkout_id', 'polar_transaction_id',
            'ai_summary', 'ai_suggested_solution',
            'created_at', 'updated_at',
        )

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return None


class ServiceRequestStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceRequest.STATUS_CHOICES, required=False)
    payment_status = serializers.ChoiceField(choices=ServiceRequest.PAYMENT_STATUS_CHOICES, required=False)
    admin_notes = serializers.CharField(required=False, allow_blank=True)
    delivered_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)


class CheckoutRequestSerializer(serializers.Serializer):
    service_type = serializers.ChoiceField(choices=ServiceRequest.SERVICE_TYPES)
    package_tier = serializers.ChoiceField(choices=ServiceRequest.PACKAGE_TIERS)
    service_request_id = serializers.UUIDField(required=False, allow_null=True)


class BookCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookCallRequest
        fields = ('name', 'email', 'service_type', 'message')
