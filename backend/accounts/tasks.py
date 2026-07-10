from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task
def send_welcome_email(user_id):
    """Send welcome email to new user"""
    try:
        user = User.objects.get(id=user_id)

        subject = 'Welcome to AI Writing Platform!'
        message = render_to_string('emails/welcome.html', {
            'user': user,
            'domain': settings.FRONTEND_URL,
        })

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Welcome email sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error sending welcome email: {e}")
        return False


@shared_task
def send_verification_email(user_id, token):
    """Send email verification link"""
    try:
        user = User.objects.get(id=user_id)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        verify_url = f"{frontend_url}/verify-email?token={token}"

        subject = 'Verify your email — Sovereign'
        message = render_to_string('emails/verify_email.html', {
            'user': user,
            'verify_url': verify_url,
            'token': token,
            'domain': frontend_url,
        })

        send_mail(
            subject,
            '',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Verification email sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Error sending verification email: {e}")
        return False


@shared_task
def send_password_reset_email(user_id, token):
    """Send password reset email"""
    try:
        user = User.objects.get(id=user_id)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_url = f"{frontend_url}/reset-password?token={token}"

        subject = 'Reset your password — Sovereign'
        message = render_to_string('emails/password_reset.html', {
            'user': user,
            'reset_url': reset_url,
            'token': token,
            'domain': frontend_url,
        })

        send_mail(
            subject,
            '',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Password reset email sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Error sending password reset email: {e}")
        return False


@shared_task
def send_subscription_confirmation(user_id):
    """Send subscription confirmation email"""
    try:
        user = User.objects.get(id=user_id)

        subject = 'Your Pro subscription is active!'
        message = render_to_string('emails/subscription_confirmation.html', {
            'user': user,
        })

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Subscription confirmation sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Error sending subscription confirmation: {e}")
        return False


@shared_task
def send_usage_limit_warning(user_id):
    """Send warning when user is approaching usage limit"""
    try:
        user = User.objects.get(id=user_id)

        subject = 'You\'re approaching your usage limit'
        message = render_to_string('emails/usage_limit_warning.html', {
            'user': user,
            'usage_percentage': 80,
        })

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Usage limit warning sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Error sending usage limit warning: {e}")
        return False


@shared_task
def send_monthly_usage_report(user_id):
    """Send monthly usage report to user"""
    try:
        user = User.objects.get(id=user_id)

        # Get usage stats
        usage_stats = {
            'total_usage': user.monthly_usage_count,
            'tools_used': user.tool_usages.count(),
            'documents_created': user.documents.count(),
            'time_saved': '4.5 hours',  # Calculate based on usage
        }

        subject = 'Your monthly usage report'
        message = render_to_string('emails/monthly_report.html', {
            'user': user,
            'stats': usage_stats,
        })

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=message,
            fail_silently=False,
        )

        logger.info(f"Monthly report sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Error sending monthly report: {e}")
        return False


@shared_task
def reset_monthly_usage():
    """Reset monthly usage count for users whose reset date has passed"""
    try:
        now = timezone.now()

        # Find users whose usage needs to be reset (last reset was more than 30 days ago)
        users_to_reset = User.objects.filter(
            last_usage_reset__lte=now - timedelta(days=30)
        )

        reset_count = 0
        for user in users_to_reset:
            user.reset_monthly_usage()
            reset_count += 1

        logger.info(f"Reset monthly usage for {reset_count} users")

        # Send monthly reports to active users who were reset
        for user in users_to_reset:
            if user.last_login and user.last_login >= now - timedelta(days=30):
                send_monthly_usage_report.delay(user.id)

        return f"Reset {reset_count} users"

    except Exception as e:
        logger.error(f"Error resetting monthly usage: {e}")
        return False


@shared_task
def check_usage_limits():
    """Check and warn users approaching their usage limits"""
    try:
        # Get all users
        users = User.objects.filter(is_active=True)
        warned_count = 0

        for user in users:
            usage_limit = user.get_usage_limit()
            warning_threshold = int(usage_limit * 0.8)

            if warning_threshold <= user.monthly_usage_count < usage_limit:
                # Check if we already sent a warning this month
                cache_key = f"usage_warning_sent:{user.id}:{timezone.now().month}"
                if not cache.get(cache_key):
                    send_usage_limit_warning.delay(user.id)
                    cache.set(cache_key, True, 86400 * 30)  # Remember for 30 days
                    warned_count += 1

        logger.info(f"Checked usage limits, warned {warned_count} users")
        return True

    except Exception as e:
        logger.error(f"Error checking usage limits: {e}")
        return False


@shared_task
def cleanup_old_sessions():
    """Clean up expired sessions and temporary data"""
    try:
        from django.contrib.sessions.models import Session
        from django.utils import timezone

        # Delete expired sessions
        Session.objects.filter(expire_date__lt=timezone.now()).delete()

        # Clean up old usage records (keep last 90 days)
        from tools.models import ToolUsage
        cutoff_date = timezone.now() - timedelta(days=90)
        old_records = ToolUsage.objects.filter(created_at__lt=cutoff_date)
        count = old_records.count()
        old_records.delete()

        logger.info(f"Cleaned up {count} old usage records")
        return True

    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}")
        return False