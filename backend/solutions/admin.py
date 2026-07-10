from django.contrib import admin
from .models import ServiceRequest, BookCallRequest


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'service_type', 'package_tier', 'status', 'payment_status', 'amount', 'created_at')
    list_filter = ('status', 'service_type', 'package_tier', 'payment_status')
    search_fields = ('name', 'email', 'business_type', 'requirements')
    readonly_fields = ('id', 'ai_summary', 'ai_suggested_solution', 'created_at', 'updated_at')
    ordering = ('-created_at',)

    fieldsets = (
        ('Client Info', {
            'fields': ('id', 'user', 'name', 'email', 'business_type'),
        }),
        ('Service Details', {
            'fields': ('service_type', 'package_tier', 'requirements', 'tools_used', 'budget', 'timeline'),
        }),
        ('Status & Payment', {
            'fields': ('status', 'payment_status', 'amount', 'polar_checkout_id', 'polar_transaction_id'),
        }),
        ('AI Analysis', {
            'fields': ('ai_summary', 'ai_suggested_solution'),
        }),
        ('Admin', {
            'fields': ('admin_notes', 'delivered_url', 'created_at', 'updated_at'),
        }),
    )


@admin.register(BookCallRequest)
class BookCallRequestAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'service_type', 'created_at')
    list_filter = ('service_type',)
    search_fields = ('name', 'email')
    ordering = ('-created_at',)
