"""
Management command to process API usage analytics
"""
import json
import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.db.models import Count, Sum, Avg, F
from django.contrib.auth import get_user_model
from tools.models import ToolUsage, Tool
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = 'Process and analyze API usage data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--period',
            type=str,
            default='daily',
            choices=['hourly', 'daily', 'weekly', 'monthly'],
            help='Analytics period'
        )

    def handle(self, *args, **options):
        period = options['period']
        self.stdout.write(f"Processing {period} usage analytics...")
        
        # Process cached usage data
        self.process_cached_usage()
        
        # Generate analytics reports
        if period == 'hourly':
            self.generate_hourly_report()
        elif period == 'daily':
            self.generate_daily_report()
        elif period == 'weekly':
            self.generate_weekly_report()
        elif period == 'monthly':
            self.generate_monthly_report()
        
        self.stdout.write(self.style.SUCCESS('Successfully processed usage analytics'))

    def process_cached_usage(self):
        """Process usage data from cache and store in database"""
        pattern = "api_usage:*"
        cursor = 0
        
        while True:
            # Scan for usage keys in cache
            keys = []
            for key in cache._cache.keys(pattern):
                if key.startswith(b'api_usage:'):
                    keys.append(key.decode())
            
            if not keys:
                break
            
            # Process each usage record
            for key in keys:
                try:
                    usage_data = cache.get(key)
                    if usage_data:
                        data = json.loads(usage_data) if isinstance(usage_data, str) else usage_data
                        
                        # Store processed data (you could save to a separate analytics model)
                        logger.info(f"Processed usage: {data['path']} - {data['status_code']}")
                        
                        # Delete processed key
                        cache.delete(key)
                except Exception as e:
                    logger.error(f"Error processing usage data: {e}")

    def generate_daily_report(self):
        """Generate daily usage report"""
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        # Tool usage statistics
        tool_stats = ToolUsage.objects.filter(
            created_at__date=yesterday
        ).values('tool__name').annotate(
            usage_count=Count('id'),
            avg_processing_time=Avg('processing_time'),
            error_count=Count('id', filter=F('error_message') != '')
        ).order_by('-usage_count')
        
        self.stdout.write("\n=== Daily Tool Usage Report ===")
        self.stdout.write(f"Date: {yesterday}")
        self.stdout.write("-" * 50)
        
        for stat in tool_stats:
            self.stdout.write(
                f"{stat['tool__name']}: "
                f"{stat['usage_count']} uses, "
                f"{stat['avg_processing_time']:.2f}s avg time, "
                f"{stat['error_count']} errors"
            )
        
        # User statistics
        user_stats = User.objects.filter(
            tool_usages__created_at__date=yesterday
        ).annotate(
            daily_usage=Count('tool_usages')
        ).order_by('-daily_usage')[:10]
        
        self.stdout.write("\n=== Top Users ===")
        for user in user_stats:
            self.stdout.write(f"{user.email}: {user.daily_usage} uses")
        
        # Overall statistics
        total_usage = ToolUsage.objects.filter(created_at__date=yesterday).count()
        total_errors = ToolUsage.objects.filter(
            created_at__date=yesterday,
            error_message__isnull=False
        ).exclude(error_message='').count()
        
        self.stdout.write(f"\n=== Overall Statistics ===")
        self.stdout.write(f"Total API calls: {total_usage}")
        self.stdout.write(f"Total errors: {total_errors}")
        self.stdout.write(f"Error rate: {(total_errors/total_usage*100) if total_usage > 0 else 0:.2f}%")

    def generate_weekly_report(self):
        """Generate weekly usage report"""
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        # Weekly trends
        daily_usage = ToolUsage.objects.filter(
            created_at__date__gte=week_start,
            created_at__date__lte=week_end
        ).extra(
            select={'day': 'date(created_at)'}
        ).values('day').annotate(
            count=Count('id')
        ).order_by('day')
        
        self.stdout.write("\n=== Weekly Usage Trend ===")
        for day_stat in daily_usage:
            self.stdout.write(f"{day_stat['day']}: {day_stat['count']} uses")

    def generate_monthly_report(self):
        """Generate monthly usage report"""
        today = datetime.now().date()
        month_start = today.replace(day=1)
        
        # Monthly summary
        monthly_stats = ToolUsage.objects.filter(
            created_at__month=month_start.month,
            created_at__year=month_start.year
        ).aggregate(
            total_uses=Count('id'),
            unique_users=Count('user', distinct=True),
            avg_processing_time=Avg('processing_time'),
            total_tokens=Sum('tokens_used')
        )
        
        self.stdout.write("\n=== Monthly Summary ===")
        self.stdout.write(f"Month: {month_start.strftime('%B %Y')}")
        self.stdout.write(f"Total uses: {monthly_stats['total_uses']}")
        self.stdout.write(f"Unique users: {monthly_stats['unique_users']}")
        self.stdout.write(f"Avg processing time: {monthly_stats['avg_processing_time']:.2f}s")
        self.stdout.write(f"Total tokens used: {monthly_stats['total_tokens']}")
        
        # Tool popularity
        tool_popularity = Tool.objects.annotate(
            monthly_uses=Count(
                'usages',
                filter=F('usages__created_at__month') == month_start.month
            )
        ).order_by('-monthly_uses')[:10]
        
        self.stdout.write("\n=== Most Popular Tools ===")
        for tool in tool_popularity:
            self.stdout.write(f"{tool.name}: {tool.monthly_uses} uses")

    def generate_hourly_report(self):
        """Generate hourly usage report"""
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        
        # Hourly statistics
        hourly_stats = ToolUsage.objects.filter(
            created_at__gte=hour_ago,
            created_at__lt=now
        ).aggregate(
            total_uses=Count('id'),
            avg_processing_time=Avg('processing_time'),
            error_count=Count('id', filter=F('error_message') != '')
        )
        
        self.stdout.write("\n=== Hourly Report ===")
        self.stdout.write(f"Period: {hour_ago.strftime('%Y-%m-%d %H:00')} - {now.strftime('%H:00')}")
        self.stdout.write(f"Total uses: {hourly_stats['total_uses']}")
        self.stdout.write(f"Avg processing time: {hourly_stats['avg_processing_time']:.2f}s")
        self.stdout.write(f"Errors: {hourly_stats['error_count']}")