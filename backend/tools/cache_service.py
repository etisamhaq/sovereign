"""
Redis caching service for AI responses
"""
import hashlib
import json
import logging
from typing import Any, Dict, Optional, Union
from datetime import timedelta
import redis
from django.conf import settings
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder

logger = logging.getLogger(__name__)


class CacheService:
    """
    Service for caching AI responses and frequently accessed data
    """
    
    def __init__(self):
        self.redis_client = self._init_redis()
        self.default_ttl = 3600 * 24  # 24 hours default
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }
    
    def _init_redis(self):
        """Initialize Redis connection"""
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1')
            client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            client.ping()
            logger.info("Redis cache service initialized successfully")
            return client
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using Django cache backend.")
            return None
    
    def _generate_cache_key(self, tool_name: str, params: Dict[str, Any]) -> str:
        """
        Generate a unique cache key based on tool name and parameters
        """
        # Sort params for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True, cls=DjangoJSONEncoder)
        
        # Create hash of parameters
        param_hash = hashlib.md5(sorted_params.encode()).hexdigest()
        
        # Create cache key
        cache_key = f"ai_response:{tool_name}:{param_hash}"
        return cache_key
    
    def get(self, tool_name: str, params: Dict[str, Any]) -> Optional[Any]:
        """
        Get cached response for a tool with given parameters
        """
        cache_key = self._generate_cache_key(tool_name, params)
        
        try:
            if self.redis_client:
                # Try Redis first
                cached_value = self.redis_client.get(cache_key)
                if cached_value:
                    self.cache_stats['hits'] += 1
                    logger.debug(f"Cache hit for {tool_name}")
                    return json.loads(cached_value)
            else:
                # Fallback to Django cache
                cached_value = cache.get(cache_key)
                if cached_value:
                    self.cache_stats['hits'] += 1
                    logger.debug(f"Cache hit for {tool_name}")
                    return cached_value
            
            self.cache_stats['misses'] += 1
            logger.debug(f"Cache miss for {tool_name}")
            return None
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache get error: {e}")
            return None
    
    def set(self, tool_name: str, params: Dict[str, Any], 
            value: Any, ttl: Optional[int] = None) -> bool:
        """
        Cache a response for a tool with given parameters
        """
        cache_key = self._generate_cache_key(tool_name, params)
        ttl = ttl or self.default_ttl
        
        try:
            if self.redis_client:
                # Use Redis
                serialized_value = json.dumps(value, cls=DjangoJSONEncoder)
                self.redis_client.setex(cache_key, ttl, serialized_value)
                logger.debug(f"Cached response for {tool_name} with TTL {ttl}s")
            else:
                # Fallback to Django cache
                cache.set(cache_key, value, ttl)
                logger.debug(f"Cached response for {tool_name} with TTL {ttl}s")
            
            return True
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, tool_name: str, params: Dict[str, Any]) -> bool:
        """
        Delete cached response for a tool with given parameters
        """
        cache_key = self._generate_cache_key(tool_name, params)
        
        try:
            if self.redis_client:
                self.redis_client.delete(cache_key)
            else:
                cache.delete(cache_key)
            
            logger.debug(f"Deleted cache for {tool_name}")
            return True
            
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def clear_tool_cache(self, tool_name: str) -> int:
        """
        Clear all cached responses for a specific tool
        """
        pattern = f"ai_response:{tool_name}:*"
        deleted_count = 0
        
        try:
            if self.redis_client:
                # Use SCAN to find and delete keys
                cursor = 0
                while True:
                    cursor, keys = self.redis_client.scan(
                        cursor, match=pattern, count=100
                    )
                    if keys:
                        self.redis_client.delete(*keys)
                        deleted_count += len(keys)
                    if cursor == 0:
                        break
            else:
                # For Django cache, we can't easily pattern match
                # So we'll just log a warning
                logger.warning("Pattern-based cache clearing not supported with Django cache backend")
            
            logger.info(f"Cleared {deleted_count} cache entries for {tool_name}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        """
        stats = self.cache_stats.copy()
        
        # Calculate hit rate
        total_requests = stats['hits'] + stats['misses']
        if total_requests > 0:
            stats['hit_rate'] = (stats['hits'] / total_requests) * 100
        else:
            stats['hit_rate'] = 0
        
        # Get Redis info if available
        if self.redis_client:
            try:
                info = self.redis_client.info('memory')
                stats['redis_memory_used'] = info.get('used_memory_human', 'N/A')
                stats['redis_memory_peak'] = info.get('used_memory_peak_human', 'N/A')
            except:
                pass
        
        return stats
    
    def warm_cache(self, tool_name: str, common_queries: list):
        """
        Pre-populate cache with common queries
        """
        logger.info(f"Warming cache for {tool_name} with {len(common_queries)} queries")
        
        # This would typically call the AI service for each query
        # and cache the results
        # Implementation depends on your specific needs
        pass


class ResponseCache:
    """
    Decorator for caching AI tool responses
    """
    
    def __init__(self, ttl: int = 3600 * 24, vary_on: list = None):
        """
        Initialize cache decorator
        
        Args:
            ttl: Time to live in seconds
            vary_on: List of parameter names to include in cache key
        """
        self.ttl = ttl
        self.vary_on = vary_on or []
        self.cache_service = CacheService()
    
    def __call__(self, func):
        """
        Decorator implementation
        """
        def wrapper(*args, **kwargs):
            # Extract tool name from function
            tool_name = func.__name__
            
            # Build cache parameters
            cache_params = {}
            if self.vary_on:
                for param in self.vary_on:
                    if param in kwargs:
                        cache_params[param] = kwargs[param]
            else:
                # Use all kwargs if vary_on not specified
                cache_params = kwargs
            
            # Try to get from cache
            cached_response = self.cache_service.get(tool_name, cache_params)
            if cached_response is not None:
                logger.info(f"Returning cached response for {tool_name}")
                return cached_response
            
            # Execute function if not cached
            response = func(*args, **kwargs)
            
            # Cache the response
            self.cache_service.set(tool_name, cache_params, response, self.ttl)
            
            return response
        
        return wrapper


class UserQuotaCache:
    """
    Cache for user quota and usage tracking
    """
    
    def __init__(self):
        self.cache_service = CacheService()
        self.ttl = 3600  # 1 hour TTL for usage data
    
    def get_user_usage(self, user_id: int, period: str = 'daily') -> int:
        """
        Get cached user usage count
        """
        cache_key = f"user_usage:{user_id}:{period}"
        
        if self.cache_service.redis_client:
            try:
                usage = self.cache_service.redis_client.get(cache_key)
                return int(usage) if usage else 0
            except:
                return 0
        
        return cache.get(cache_key, 0)
    
    def increment_user_usage(self, user_id: int, period: str = 'daily') -> int:
        """
        Increment user usage count
        """
        cache_key = f"user_usage:{user_id}:{period}"
        
        if self.cache_service.redis_client:
            try:
                # Use Redis INCR for atomic increment
                new_value = self.cache_service.redis_client.incr(cache_key)
                
                # Set expiry on first increment
                if new_value == 1:
                    if period == 'daily':
                        self.cache_service.redis_client.expire(cache_key, 86400)  # 24 hours
                    elif period == 'hourly':
                        self.cache_service.redis_client.expire(cache_key, 3600)  # 1 hour
                
                return new_value
            except Exception as e:
                logger.error(f"Failed to increment usage: {e}")
                return 0
        
        # Fallback to Django cache
        current = cache.get(cache_key, 0)
        new_value = current + 1
        ttl = 86400 if period == 'daily' else 3600
        cache.set(cache_key, new_value, ttl)
        return new_value
    
    def check_quota_exceeded(self, user_id: int, limit: int, period: str = 'daily') -> bool:
        """
        Check if user has exceeded their quota
        """
        usage = self.get_user_usage(user_id, period)
        return usage >= limit


# Singleton instances
_cache_service = None
_quota_cache = None


def get_cache_service() -> CacheService:
    """Get or create the singleton cache service"""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


def get_quota_cache() -> UserQuotaCache:
    """Get or create the singleton quota cache"""
    global _quota_cache
    if _quota_cache is None:
        _quota_cache = UserQuotaCache()
    return _quota_cache