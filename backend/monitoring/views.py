"""
Monitoring and analytics views for admin dashboard
"""
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q, F, Max
from django.core.cache import cache
from django.http import JsonResponse
from datetime import datetime, timedelta
import json

from accounts.models import User
from tools.models import Tool, ToolUsage, Document
from payments.models import Payment, Subscription


@staff_member_required
def analytics_dashboard(request):
    """Main analytics dashboard view"""
    context = {
        'page_title': 'Analytics Dashboard',
        'current_time': timezone.now(),
    }
    return render(request, 'monitoring/dashboard.html', context)


@staff_member_required
def analytics_api(request, metric):
    """API endpoint for fetching analytics data"""

    # Time range from query params
    period = request.GET.get('period', 'week')

    if period == 'day':
        start_date = timezone.now() - timedelta(days=1)
    elif period == 'week':
        start_date = timezone.now() - timedelta(days=7)
    elif period == 'month':
        start_date = timezone.now() - timedelta(days=30)
    else:
        start_date = timezone.now() - timedelta(days=7)

    # Route to appropriate metric handler
    if metric == 'overview':
        data = get_overview_metrics()
    elif metric == 'usage':
        data = get_usage_metrics(start_date)
    elif metric == 'tools':
        data = get_tool_metrics(start_date)
    elif metric == 'users':
        data = get_user_metrics(start_date)
    elif metric == 'revenue':
        data = get_revenue_metrics(start_date)
    elif metric == 'performance':
        data = get_performance_metrics(start_date)
    elif metric == 'realtime':
        data = get_realtime_metrics()
    else:
        data = {'error': 'Invalid metric'}

    return JsonResponse(data)


def get_overview_metrics():
    """Get overview metrics for dashboard"""

    # Cache key for overview metrics
    cache_key = 'analytics:overview'
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    # Calculate metrics
    total_users = User.objects.count()
    pro_users = User.objects.filter(subscription_tier='pro').count()
    active_users_today = User.objects.filter(
        last_login__gte=timezone.now() - timedelta(days=1)
    ).count()

    total_usage_today = ToolUsage.objects.filter(
        created_at__gte=timezone.now() - timedelta(days=1)
    ).count()

    total_documents = Document.objects.count()

    # Revenue metrics
    now = timezone.now()
    monthly_revenue = Payment.objects.filter(
        created_at__year=now.year,
        created_at__month=now.month,
        status='completed'
    ).aggregate(total=Sum('amount'))['total'] or 0

    data = {
        'total_users': total_users,
        'pro_users': pro_users,
        'active_users_today': active_users_today,
        'total_usage_today': total_usage_today,
        'total_documents': total_documents,
        'monthly_revenue': float(monthly_revenue / 100),  # Convert cents to dollars
        'conversion_rate': (pro_users / total_users * 100) if total_users > 0 else 0,
    }

    # Cache for 5 minutes
    cache.set(cache_key, data, 300)
    return data


def get_usage_metrics(start_date):
    """Get usage metrics over time"""

    # Daily usage trend
    usage_by_day = ToolUsage.objects.filter(
        created_at__gte=start_date
    ).extra(
        select={'day': 'date(created_at)'}
    ).values('day').annotate(
        count=Count('id'),
        errors=Count('id', filter=Q(error_message__isnull=False))
    ).order_by('day')

    # Usage by hour of day
    usage_by_hour = ToolUsage.objects.filter(
        created_at__gte=start_date
    ).extra(
        select={'hour': 'extract(hour from created_at)'}
    ).values('hour').annotate(
        count=Count('id')
    ).order_by('hour')

    return {
        'daily_trend': list(usage_by_day),
        'hourly_pattern': list(usage_by_hour),
        'total_usage': sum(day['count'] for day in usage_by_day),
        'error_rate': sum(day['errors'] for day in usage_by_day) / max(sum(day['count'] for day in usage_by_day), 1) * 100
    }


def get_tool_metrics(start_date):
    """Get tool-specific metrics"""

    # Tool popularity
    tool_usage = Tool.objects.annotate(
        usage_count=Count(
            'usages',
            filter=Q(usages__created_at__gte=start_date)
        ),
        avg_time=Avg(
            'usages__processing_time',
            filter=Q(usages__created_at__gte=start_date)
        ),
        error_count=Count(
            'usages',
            filter=Q(
                usages__created_at__gte=start_date,
                usages__error_message__isnull=False
            )
        )
    ).values('name', 'slug', 'category', 'usage_count', 'avg_time', 'error_count').order_by('-usage_count')

    # Category breakdown
    category_usage = Tool.objects.values('category').annotate(
        usage_count=Count(
            'usages',
            filter=Q(usages__created_at__gte=start_date)
        )
    ).order_by('-usage_count')

    return {
        'tool_usage': list(tool_usage[:20]),  # Top 20 tools
        'category_breakdown': list(category_usage),
    }


def get_user_metrics(start_date):
    """Get user-related metrics"""

    # New users over time
    new_users = User.objects.filter(
        date_joined__gte=start_date
    ).extra(
        select={'day': 'date(date_joined)'}
    ).values('day').annotate(
        count=Count('id'),
        pro_count=Count('id', filter=Q(subscription_tier='pro'))
    ).order_by('day')

    # User engagement
    engagement = User.objects.filter(
        last_login__gte=start_date
    ).aggregate(
        daily_active=Count('id', filter=Q(last_login__gte=timezone.now() - timedelta(days=1))),
        weekly_active=Count('id', filter=Q(last_login__gte=timezone.now() - timedelta(days=7))),
        monthly_active=Count('id', filter=Q(last_login__gte=timezone.now() - timedelta(days=30))),
    )

    # Top users by usage
    top_users = User.objects.filter(
        tool_usages__created_at__gte=start_date
    ).annotate(
        usage_count=Count('tool_usages')
    ).order_by('-usage_count')[:10].values('email', 'subscription_tier', 'usage_count')

    return {
        'new_users_trend': list(new_users),
        'engagement': engagement,
        'top_users': list(top_users),
    }


def get_revenue_metrics(start_date):
    """Get revenue-related metrics"""

    # Daily revenue
    daily_revenue = Payment.objects.filter(
        created_at__gte=start_date,
        status='completed'
    ).extra(
        select={'day': 'date(created_at)'}
    ).values('day').annotate(
        revenue=Sum('amount'),
        count=Count('id')
    ).order_by('day')

    # Subscription metrics
    active_subscriptions = Subscription.objects.filter(
        status='active'
    ).count()

    churned_subscriptions = Subscription.objects.filter(
        status='canceled',
        canceled_at__gte=start_date
    ).count()

    # MRR (Monthly Recurring Revenue)
    mrr = active_subscriptions * 3  # $3 per subscription

    return {
        'daily_revenue': [
            {
                'day': item['day'],
                'revenue': float(item['revenue'] / 100),  # Convert cents to dollars
                'count': item['count']
            }
            for item in daily_revenue
        ],
        'active_subscriptions': active_subscriptions,
        'churned_subscriptions': churned_subscriptions,
        'mrr': mrr,
        'churn_rate': (churned_subscriptions / max(active_subscriptions, 1)) * 100
    }


def get_performance_metrics(start_date):
    """Get performance-related metrics"""

    # Average processing times by tool
    performance_by_tool = Tool.objects.annotate(
        avg_time=Avg(
            'usages__processing_time',
            filter=Q(usages__created_at__gte=start_date)
        ),
        max_time=Max(
            'usages__processing_time',
            filter=Q(usages__created_at__gte=start_date)
        )
    ).values('name', 'avg_time', 'max_time').exclude(avg_time__isnull=True).order_by('-avg_time')

    # Error rates by tool
    error_rates = Tool.objects.annotate(
        total_uses=Count(
            'usages',
            filter=Q(usages__created_at__gte=start_date)
        ),
        error_count=Count(
            'usages',
            filter=Q(
                usages__created_at__gte=start_date,
                usages__error_message__isnull=False
            )
        )
    ).values('name', 'total_uses', 'error_count').exclude(total_uses=0)

    # Calculate error rates
    for tool in error_rates:
        tool['error_rate'] = (tool['error_count'] / tool['total_uses']) * 100

    return {
        'performance_by_tool': list(performance_by_tool[:20]),
        'error_rates': list(sorted(error_rates, key=lambda x: x['error_rate'], reverse=True)[:20]),
    }


def get_realtime_metrics():
    """Get real-time metrics from cache and system"""

    # Get current active users (from cache)
    active_users = 0
    pattern = "rate_limit:user_*"

    # Count unique users who made requests in the last minute
    for key in cache._cache.keys(pattern):
        if cache.get(key.decode()):
            active_users += 1

    # Get recent API calls per minute
    api_calls_per_minute = cache.get('api_calls_per_minute', 0)

    # Get real system metrics where available
    system_load = _get_system_load()

    return {
        'active_users': active_users,
        'api_calls_per_minute': api_calls_per_minute,
        'system_load': system_load,
        'timestamp': timezone.now().isoformat(),
    }


def _get_system_load():
    """Read actual system metrics from /proc (Linux) with safe fallbacks."""
    import os, subprocess

    cpu_percent = None
    memory_percent = None
    redis_memory_mb = None
    db_connections = None

    # ── CPU: 1-minute load average / number of CPUs ──
    try:
        load1 = os.getloadavg()[0]
        cpu_count = os.cpu_count() or 1
        cpu_percent = round(min(load1 / cpu_count * 100, 100), 1)
    except OSError:
        cpu_percent = None

    # ── Memory: read /proc/meminfo ──
    try:
        with open('/proc/meminfo') as f:
            meminfo = {}
            for line in f:
                parts = line.split()
                meminfo[parts[0].rstrip(':')] = int(parts[1])
            total = meminfo.get('MemTotal', 1)
            available = meminfo.get('MemAvailable', total)
            memory_percent = round((1 - available / total) * 100, 1)
    except (OSError, KeyError, ZeroDivisionError):
        memory_percent = None

    # ── Redis memory: ask Redis via cache backend ──
    try:
        from django_redis import get_redis_connection
        redis_conn = get_redis_connection("default")
        info = redis_conn.info("memory")
        redis_memory_mb = round(info.get("used_memory", 0) / (1024 * 1024), 1)
    except Exception:
        redis_memory_mb = None

    # ── DB connections: pg_stat_activity ──
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
            db_connections = cursor.fetchone()[0]
    except Exception:
        db_connections = None

    return {
        'cpu_percent': cpu_percent,
        'memory_percent': memory_percent,
        'redis_memory_mb': redis_memory_mb,
        'db_connections': db_connections,
    }