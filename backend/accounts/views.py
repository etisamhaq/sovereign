from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
import logging

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from .serializers import (
    UserSerializer, UserCreateSerializer, LoginSerializer,
    TokenSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer, EmailVerificationSerializer,
    ChangePasswordSerializer, UserUpdateSerializer
)
from .models import PasswordResetToken, EmailVerificationToken
from payments.models import UsageQuota
from rewards.services import RewardService
from .tasks import send_welcome_email, send_verification_email as send_verification_email_task, send_password_reset_email as send_password_reset_email_task

User = get_user_model()
logger = logging.getLogger(__name__)


# ── Rate-limit throttles ──────────────────────────────────────────

class PasswordResetThrottle(AnonRateThrottle):
    """5 password reset requests per hour per IP."""
    rate = '5/hour'
    scope = 'password_reset'


class ResendVerificationThrottle(AnonRateThrottle):
    """3 verification email resends per hour per IP."""
    rate = '3/hour'
    scope = 'resend_verification'


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()

        # Create usage quota for new user
        UsageQuota.objects.create(user=user)

        # Grant signup bonus coins
        try:
            RewardService.grant_signup_bonus(user)
        except Exception as e:
            logger.error(f"Failed to grant signup bonus: {e}")

        # Process referral if user was referred
        if user.referred_by:
            try:
                RewardService.process_referral(user.referred_by, user)
            except Exception as e:
                logger.error(f"Failed to process referral: {e}")

        # Invalidate any old verification tokens
        EmailVerificationToken.objects.filter(user=user, used=False).update(used=True)

        # Send verification email
        token = EmailVerificationToken.objects.create(user=user)
        self._send_verification_email(user, token)

        # Queue welcome email via Celery
        try:
            send_welcome_email.delay(user.id)
        except Exception as e:
            logger.error(f"Failed to queue welcome email: {e}")

        return user

    def _send_verification_email(self, user, token):
        """Queue verification email via Celery for async delivery."""
        try:
            send_verification_email_task.delay(user.id, str(token.token))
            logger.info(f"Queued verification email for {user.email}")
        except Exception as e:
            logger.error(f"Failed to queue verification email for {user.email}: {e}")
            # Fallback: send synchronously if Celery is down
            self._send_verification_email_sync(user, token)

    def _send_verification_email_sync(self, user, token):
        """Synchronous fallback for verification email."""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        verify_url = f"{frontend_url}/verify-email?token={token.token}"

        subject = 'Verify your email — Sovereign'
        message = render_to_string('emails/verify_email.html', {
            'user': user,
            'verify_url': verify_url,
        })

        try:
            send_mail(
                subject,
                '',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                html_message=message,
                fail_silently=False,
            )
            logger.info(f"Verification email sent (sync) to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {e}")

    def create(self, request, *args, **kwargs):
        # Log registration attempt without sensitive data
        safe_data = {k: v for k, v in request.data.items() if k not in ('password', 'password_confirm', 'password2')}
        logger.info(f"Registration request from: {safe_data.get('email', 'unknown')}")
        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            # Format error messages for better display
            formatted_errors = {}
            for field, errors in serializer.errors.items():
                if field == 'password':
                    # Combine password errors into a single message
                    formatted_errors[field] = ' '.join([str(error) for error in errors])
                else:
                    formatted_errors[field] = errors[0] if isinstance(errors, list) else errors
            return Response(formatted_errors, status=status.HTTP_400_BAD_REQUEST)

        user = self.perform_create(serializer)

        # Generate tokens — user can login but will see verification reminder
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'needs_verification': True,
            'message': 'Registration successful! Please check your email to verify your account.'
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh = RefreshToken.for_user(user)

        response_data = {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        }

        # Add verification flag if not verified
        if not user.is_verified:
            response_data['needs_verification'] = True
            response_data['message'] = 'Please verify your email address to unlock all features.'

        return Response(response_data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer


class UsageInfoView(APIView):
    """Get detailed usage information for the authenticated user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        usage_info = user.get_usage_info()

        # Add list of premium tool slugs for the frontend
        usage_info['free_tool_slugs'] = settings.FREE_TOOL_SLUGS
        usage_info['premium_tool_slugs'] = settings.PREMIUM_TOOL_SLUGS

        return Response(usage_info)


class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        # Always return success to prevent email enumeration
        try:
            user = User.objects.get(email=email)

            # Invalidate any previous unused reset tokens
            PasswordResetToken.objects.filter(user=user, used=False).update(used=True)

            # Create fresh token
            token = PasswordResetToken.objects.create(user=user)

            # Send reset email
            self._send_reset_email(user, token)
        except User.DoesNotExist:
            # Don't reveal that user doesn't exist
            logger.info(f"Password reset requested for non-existent email: {email}")

        return Response({
            'message': 'If an account exists with this email, you will receive a password reset link shortly.'
        })

    def _send_reset_email(self, user, token):
        """Queue password reset email via Celery for async delivery."""
        try:
            send_password_reset_email_task.delay(user.id, str(token.token))
            logger.info(f"Queued password reset email for {user.email}")
        except Exception as e:
            logger.error(f"Failed to queue reset email for {user.email}: {e}")
            # Fallback: send synchronously if Celery is down
            self._send_reset_email_sync(user, token)

    def _send_reset_email_sync(self, user, token):
        """Synchronous fallback for password reset email."""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_url = f"{frontend_url}/reset-password?token={token.token}"

        subject = 'Reset your password — Sovereign'
        message = render_to_string('emails/password_reset.html', {
            'user': user,
            'reset_url': reset_url,
        })

        try:
            send_mail(
                subject,
                '',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                html_message=message,
                fail_silently=False,
            )
            logger.info(f"Password reset email sent (sync) to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send password reset email to {user.email}: {e}")


class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reset_token = serializer.validated_data['reset_token']
        password = serializer.validated_data['password']

        # Update password
        user = reset_token.user
        user.set_password(password)
        user.save()

        # Mark token as used
        reset_token.used = True
        reset_token.save()

        return Response({
            'message': 'Password reset successful. You can now login with your new password.'
        })


class EmailVerificationView(generics.GenericAPIView):
    serializer_class = EmailVerificationSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        verification_token = serializer.context['verification_token']
        user = verification_token.user

        # Verify user
        user.is_verified = True
        user.save(update_fields=['is_verified'])

        # Mark token as used
        verification_token.used = True
        verification_token.save()

        # Return fresh tokens so the frontend can update the user state
        refresh = RefreshToken.for_user(user)

        return Response({
            'message': 'Email verified successfully!',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({
            'message': 'Password changed successfully.'
        })


class ResendVerificationEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ResendVerificationThrottle]

    def post(self, request):
        # Support both authenticated users and unauthenticated with email
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            email = request.data.get('email')
            if email:
                try:
                    user = User.objects.get(email=email)
                except User.DoesNotExist:
                    pass

        if not user:
            # Don't reveal if email exists
            return Response({
                'message': 'If an account exists, a verification email has been sent.'
            })

        if user.is_verified:
            return Response({
                'message': 'Email is already verified.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Invalidate old tokens
        EmailVerificationToken.objects.filter(user=user, used=False).update(used=True)

        # Create new verification token
        token = EmailVerificationToken.objects.create(user=user)

        # Build email
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        verify_url = f"{frontend_url}/verify-email?token={token.token}"

        subject = 'Verify your email — Sovereign'
        message = render_to_string('emails/verify_email.html', {
            'user': user,
            'verify_url': verify_url,
        })

        try:
            send_mail(
                subject,
                '',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                html_message=message,
                fail_silently=False,
            )
            logger.info(f"Resent verification email to {user.email}")
            return Response({
                'message': 'Verification email sent! Please check your inbox.'
            })
        except Exception as e:
            logger.error(f"Failed to resend verification email to {user.email}: {e}")
            return Response({
                'error': 'Failed to send email. Please try again later.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleAuthView(APIView):
    """
    Handle Google OAuth sign-in / sign-up.
    Accepts a Google ID token (credential) from the frontend, verifies it
    with Google, and either logs in an existing user or creates a new one.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get('credential')
        if not credential:
            return Response(
                {'error': 'Google credential is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the Google ID token
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        if not client_id:
            logger.error("GOOGLE_OAUTH_CLIENT_ID is not configured")
            return Response(
                {'error': 'Google authentication is not configured on the server.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                client_id,
            )
        except ValueError as e:
            logger.warning(f"Google token verification failed: {e}")
            return Response(
                {'error': 'Invalid Google token. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Extract user info from verified token
        google_user_id = idinfo['sub']
        email = idinfo.get('email')
        email_verified = idinfo.get('email_verified', False)
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        avatar_url = idinfo.get('picture', '')

        if not email:
            return Response(
                {'error': 'Email not provided by Google. Please use an account with an email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Try to find existing user by google_id or email
        user = None
        is_new_user = False

        # First check by google_id
        try:
            user = User.objects.get(google_id=google_user_id)
        except User.DoesNotExist:
            pass

        # Then check by email
        if not user:
            try:
                user = User.objects.get(email=email)
                # Link Google account to existing email-based account
                user.google_id = google_user_id
                if email_verified and not user.is_verified:
                    user.is_verified = True
                user.save(update_fields=['google_id', 'is_verified'])
                logger.info(f"Linked Google account to existing user: {email}")
            except User.DoesNotExist:
                pass

        # Create new user if not found
        if not user:
            is_new_user = True
            user = User.objects.create_user(
                email=email,
                password=None,  # No password for OAuth users
                first_name=first_name,
                last_name=last_name,
                google_id=google_user_id,
                is_verified=email_verified,
            )
            logger.info(f"Created new user via Google OAuth: {email}")

            # Create usage quota for new user
            UsageQuota.objects.create(user=user)

            # Grant signup bonus coins
            try:
                RewardService.grant_signup_bonus(user)
            except Exception as e:
                logger.error(f"Failed to grant signup bonus for Google user: {e}")

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        response_data = {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'is_new_user': is_new_user,
        }

        return Response(response_data, status=status.HTTP_200_OK)