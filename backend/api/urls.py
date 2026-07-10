from django.conf import settings as django_settings
from django.urls import path
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions
from .views import DashboardStatsView, UserActivityView, ToolUsageAnalyticsView, ContactFormView, ChatbotView

app_name = 'api'

schema_view = get_schema_view(
    openapi.Info(
        title="Sovereign API",
        default_version='v1',
        description="API for AI-powered writing and education tools",
        terms_of_service=f"{getattr(django_settings, 'SITE_URL', 'https://sovereign.com')}/terms/",
        contact=openapi.Contact(email=getattr(django_settings, 'API_CONTACT_EMAIL', 'support@sovereign.com')),
        license=openapi.License(name="Proprietary License"),
    ),
    public=False,
    permission_classes=[permissions.IsAdminUser],
)

urlpatterns = [
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('swagger.json', schema_view.without_ui(cache_timeout=0), name='schema-json'),

    # Dashboard endpoints
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/activity/', UserActivityView.as_view(), name='user-activity'),
    path('dashboard/analytics/', ToolUsageAnalyticsView.as_view(), name='tool-analytics'),

    # Contact form
    path('contact/', ContactFormView.as_view(), name='contact-form'),

    # AI Chatbot
    path('chatbot/', ChatbotView.as_view(), name='chatbot'),
]