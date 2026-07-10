from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # User profile
    path('profile/', views.UserProfileView.as_view(), name='profile'),

    # Usage info
    path('usage-info/', views.UsageInfoView.as_view(), name='usage_info'),

    # Password management
    path('password/reset/', views.PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password/reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password/change/', views.ChangePasswordView.as_view(), name='password_change'),

    # Email verification
    path('email/verify/', views.EmailVerificationView.as_view(), name='email_verify'),
    path('email/resend-verification/', views.ResendVerificationEmailView.as_view(), name='resend_verification'),

    # Social / OAuth
    path('google/', views.GoogleAuthView.as_view(), name='google_auth'),
]