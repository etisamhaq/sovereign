from django.contrib import admin
from .models import Subscription, Payment, UsageQuota, Invoice


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'polar_subscription_id', 'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'cancel_at_period_end')
    search_fields = ('user__email', 'polar_subscription_id', 'polar_customer_id')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('status', 'currency')
    search_fields = ('user__email', 'polar_transaction_id')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(UsageQuota)
class UsageQuotaAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_usage', 'monthly_limit', 'bonus_credits', 'reset_date')
    search_fields = ('user__email',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'user', 'total', 'issued_date', 'paid_date')
    list_filter = ('issued_date',)
    search_fields = ('user__email', 'invoice_number', 'polar_invoice_id')
    readonly_fields = ('id', 'created_at')
