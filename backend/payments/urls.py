from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    # Subscription management
    path('subscription/', views.SubscriptionView.as_view(), name='subscription'),
    path('subscription/create/', views.CreateSubscriptionView.as_view(), name='create_subscription'),
    path('subscription/cancel/', views.CancelSubscriptionView.as_view(), name='cancel_subscription'),

    # Payment methods
    path('payment-methods/', views.PaymentMethodsView.as_view(), name='payment_methods'),
    path('checkout-session/', views.create_checkout_session, name='checkout_session'),

    # Products
    path('products/', views.list_products, name='list_products'),
    path('validate-config/', views.validate_polar_config, name='validate_config'),

    # Usage and history
    path('usage-quota/', views.UsageQuotaView.as_view(), name='usage_quota'),
    path('history/', views.PaymentHistoryView.as_view(), name='payment_history'),
    path('invoices/', views.InvoiceListView.as_view(), name='invoices'),
    path('dashboard/', views.PaymentDashboardView.as_view(), name='payment_dashboard'),

    # Webhooks
    path('webhook/polar/', views.PolarWebhookView.as_view(), name='polar_webhook'),
]