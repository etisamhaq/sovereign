"""
Django management command to clear Redis cache
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
import redis
import os


class Command(BaseCommand):
    help = 'Clear Redis cache to resolve rate limiting issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Clear all cache entries (not just rate limits)',
        )
        parser.add_argument(
            '--stats',
            action='store_true',
            help='Show cache statistics',
        )

    def handle(self, *args, **options):
        if options['stats']:
            self.show_stats()
        elif options['all']:
            self.clear_all_cache()
        else:
            self.clear_rate_limits()

    def clear_rate_limits(self):
        """Clear only rate limit cache entries"""
        self.stdout.write('Clearing rate limit cache entries...')
        
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1')
            r = redis.from_url(redis_url)
            
            count = 0
            for key in r.scan_iter(match="*rate_limit:*"):
                r.delete(key)
                count += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully cleared {count} rate limit entries')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing rate limits: {e}')
            )

    def clear_all_cache(self):
        """Clear all cache entries"""
        self.stdout.write('Clearing ALL cache entries...')
        
        try:
            # Clear Django cache
            cache.clear()
            self.stdout.write(self.style.SUCCESS('✓ Django cache cleared'))
            
            # Clear Redis directly
            redis_url = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1')
            r = redis.from_url(redis_url)
            r.flushdb()
            self.stdout.write(self.style.SUCCESS('✓ Redis database flushed'))
            
            # Clear Celery broker if using Redis
            broker_url = os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
            if 'redis' in broker_url:
                r_broker = redis.from_url(broker_url)
                r_broker.flushdb()
                self.stdout.write(self.style.SUCCESS('✓ Celery broker cleared'))
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing cache: {e}')
            )

    def show_stats(self):
        """Show cache statistics"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1')
            r = redis.from_url(redis_url)
            
            info = r.info()
            self.stdout.write('\nRedis Cache Statistics:')
            self.stdout.write(f'- Used memory: {info.get("used_memory_human", "N/A")}')
            self.stdout.write(f'- Total keys: {r.dbsize()}')
            
            # Count different key types
            rate_limit_keys = list(r.scan_iter(match="*rate_limit:*"))
            api_usage_keys = list(r.scan_iter(match="*api_usage:*"))
            daily_usage_keys = list(r.scan_iter(match="*daily_usage:*"))
            
            self.stdout.write(f'\nKey counts by type:')
            self.stdout.write(f'- Rate limit keys: {len(rate_limit_keys)}')
            self.stdout.write(f'- API usage keys: {len(api_usage_keys)}')
            self.stdout.write(f'- Daily usage keys: {len(daily_usage_keys)}')
            
            # Show sample rate limit keys
            if rate_limit_keys:
                self.stdout.write('\nSample rate limit keys:')
                for key in rate_limit_keys[:5]:
                    ttl = r.ttl(key)
                    value = r.get(key)
                    key_str = key.decode()
                    value_str = value.decode() if value else 'None'
                    self.stdout.write(f'  - {key_str}: requests={value_str}, TTL={ttl}s')
                    
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error getting stats: {e}')
            )