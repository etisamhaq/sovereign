"""
API Key Manager for load balancing and rate limit management
"""
import random
import time
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from threading import Lock
import redis
from django.conf import settings
from groq import Groq
import json

logger = logging.getLogger(__name__)


class APIKeyManager:
    """
    Manages multiple API keys with round-robin selection,
    health checking, and rate limit tracking
    """
    
    def __init__(self):
        self.redis_client = self._init_redis()
        self.keys = self._load_api_keys()
        self.current_index = 0
        self.lock = Lock()
        self.key_stats = {}  # Track usage statistics
        self.circuit_breakers = {}  # Circuit breaker for each key
        
        # Initialize stats for each key
        for key_id in self.keys:
            self.key_stats[key_id] = {
                'requests': 0,
                'errors': 0,
                'last_used': None,
                'rate_limited_until': None
            }
            self.circuit_breakers[key_id] = CircuitBreaker(
                failure_threshold=5,
                recovery_timeout=60,
                expected_exception=Exception
            )
    
    def _init_redis(self):
        """Initialize Redis connection for tracking API key usage"""
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1')
            return redis.from_url(redis_url, decode_responses=True)
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory fallback.")
            return None
    
    def _load_api_keys(self) -> Dict[str, str]:
        """Load API keys from settings"""
        keys = {}
        
        # Primary API key
        primary_key = getattr(settings, 'GROQ_API_KEY', None)
        if primary_key and primary_key != 'your_groq_api_key_here':
            keys['primary'] = primary_key
        
        # Additional API keys from environment
        # Format: GROQ_API_KEY_1, GROQ_API_KEY_2, etc.
        for i in range(1, 11):  # Support up to 10 additional keys
            key_name = f'GROQ_API_KEY_{i}'
            api_key = getattr(settings, key_name, None)
            if api_key and api_key != 'your_groq_api_key_here':
                keys[f'key_{i}'] = api_key
        
        if not keys:
            logger.error("No valid API keys found!")
            # Add fallback to prevent complete failure
            keys['fallback'] = getattr(settings, 'GROQ_API_KEY', 'invalid_key')
        
        logger.info(f"Loaded {len(keys)} API keys")
        return keys
    
    def get_next_key(self) -> Tuple[str, str]:
        """
        Get next available API key using round-robin with health checking
        Returns: (key_id, api_key)
        """
        with self.lock:
            attempts = 0
            keys_list = list(self.keys.items())
            
            while attempts < len(keys_list):
                key_id, api_key = keys_list[self.current_index]
                self.current_index = (self.current_index + 1) % len(keys_list)
                attempts += 1
                
                # Check if key is rate limited
                if self._is_rate_limited(key_id):
                    continue
                
                # Check circuit breaker
                if not self.circuit_breakers[key_id].is_open():
                    self._update_usage(key_id)
                    return key_id, api_key
            
            # If all keys are unavailable, return the least recently used
            return self._get_fallback_key()
    
    def _is_rate_limited(self, key_id: str) -> bool:
        """Check if an API key is currently rate limited"""
        if self.redis_client:
            rate_limit_key = f"groq:rate_limit:{key_id}"
            is_limited = self.redis_client.get(rate_limit_key)
            return bool(is_limited)
        else:
            # In-memory fallback
            stats = self.key_stats.get(key_id, {})
            rate_limited_until = stats.get('rate_limited_until')
            if rate_limited_until and datetime.now() < rate_limited_until:
                return True
        return False
    
    def mark_rate_limited(self, key_id: str, duration_seconds: int = 60):
        """Mark an API key as rate limited"""
        logger.warning(f"API key {key_id} hit rate limit. Cooling down for {duration_seconds}s")
        
        if self.redis_client:
            rate_limit_key = f"groq:rate_limit:{key_id}"
            self.redis_client.setex(rate_limit_key, duration_seconds, "1")
        else:
            # In-memory fallback
            self.key_stats[key_id]['rate_limited_until'] = \
                datetime.now() + timedelta(seconds=duration_seconds)
    
    def mark_error(self, key_id: str, error: Exception):
        """Mark an error for an API key"""
        self.key_stats[key_id]['errors'] += 1
        self.circuit_breakers[key_id].record_failure()
        
        # If it's a rate limit error, mark the key as rate limited
        if "rate_limit" in str(error).lower():
            self.mark_rate_limited(key_id, 60)
    
    def mark_success(self, key_id: str):
        """Mark a successful request for an API key"""
        self.circuit_breakers[key_id].record_success()
        
        if self.redis_client:
            # Track successful requests in Redis
            success_key = f"groq:success:{key_id}:{datetime.now().strftime('%Y%m%d%H')}"
            self.redis_client.incr(success_key)
            self.redis_client.expire(success_key, 86400)  # Expire after 24 hours
    
    def _update_usage(self, key_id: str):
        """Update usage statistics for an API key"""
        self.key_stats[key_id]['requests'] += 1
        self.key_stats[key_id]['last_used'] = datetime.now()
        
        if self.redis_client:
            # Track in Redis for distributed systems
            usage_key = f"groq:usage:{key_id}:{datetime.now().strftime('%Y%m%d%H')}"
            self.redis_client.incr(usage_key)
            self.redis_client.expire(usage_key, 86400)  # Expire after 24 hours
    
    def _get_fallback_key(self) -> Tuple[str, str]:
        """Get the least recently used key as fallback"""
        # Sort keys by last usage time
        sorted_keys = sorted(
            self.keys.items(),
            key=lambda x: self.key_stats[x[0]].get('last_used') or datetime.min
        )
        
        if sorted_keys:
            return sorted_keys[0]
        
        # Ultimate fallback
        return 'fallback', list(self.keys.values())[0]
    
    def get_stats(self) -> Dict:
        """Get usage statistics for all API keys"""
        stats = {
            'total_keys': len(self.keys),
            'keys': {}
        }
        
        for key_id in self.keys:
            if self.redis_client:
                # Get stats from Redis
                hour_key = f"groq:usage:{key_id}:{datetime.now().strftime('%Y%m%d%H')}"
                hourly_requests = self.redis_client.get(hour_key) or 0
                
                stats['keys'][key_id] = {
                    'hourly_requests': int(hourly_requests),
                    'is_rate_limited': self._is_rate_limited(key_id),
                    'circuit_breaker_open': self.circuit_breakers[key_id].is_open(),
                    'errors': self.key_stats[key_id]['errors']
                }
            else:
                stats['keys'][key_id] = self.key_stats[key_id]
        
        return stats


class CircuitBreaker:
    """
    Circuit breaker pattern to prevent cascading failures
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60,
                 expected_exception: type = Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
        self.lock = Lock()
    
    def is_open(self) -> bool:
        """Check if circuit breaker is open (blocking requests)"""
        with self.lock:
            if self.state == 'open':
                # Check if recovery timeout has passed
                if self.last_failure_time and \
                   (datetime.now() - self.last_failure_time).total_seconds() > self.recovery_timeout:
                    self.state = 'half-open'
                    return False
                return True
            return False
    
    def record_success(self):
        """Record a successful request"""
        with self.lock:
            if self.state == 'half-open':
                self.state = 'closed'
            self.failure_count = 0
    
    def record_failure(self):
        """Record a failed request"""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = datetime.now()
            
            if self.failure_count >= self.failure_threshold:
                self.state = 'open'
                logger.warning(f"Circuit breaker opened after {self.failure_count} failures")


class GroqClientPool:
    """
    Pool of Groq clients with automatic key rotation
    """
    
    def __init__(self):
        self.key_manager = APIKeyManager()
        self.clients = {}
        self._init_clients()
    
    def _init_clients(self):
        """Initialize Groq clients for each API key"""
        for key_id, api_key in self.key_manager.keys.items():
            try:
                self.clients[key_id] = Groq(api_key=api_key)
            except Exception as e:
                logger.error(f"Failed to initialize client for {key_id}: {e}")
    
    def get_client(self) -> Tuple[str, Groq]:
        """Get next available Groq client"""
        key_id, api_key = self.key_manager.get_next_key()
        
        # Create client if not exists
        if key_id not in self.clients:
            self.clients[key_id] = Groq(api_key=api_key)
        
        return key_id, self.clients[key_id]
    
    def execute_with_retry(self, func, max_retries: int = 3, **kwargs):
        """
        Execute a function with automatic retry and key rotation
        """
        last_error = None
        
        for attempt in range(max_retries):
            key_id, client = self.get_client()
            
            try:
                # Execute the function with the client
                result = func(client, **kwargs)
                self.key_manager.mark_success(key_id)
                return result
                
            except Exception as e:
                last_error = e
                self.key_manager.mark_error(key_id, e)
                
                # Check if it's a rate limit error
                if "rate_limit" in str(e).lower():
                    logger.warning(f"Rate limit hit on {key_id}, rotating to next key")
                    continue
                
                # For other errors, retry with exponential backoff
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    logger.info(f"Retrying after {wait_time:.2f} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"All retry attempts failed: {e}")
        
        raise last_error or Exception("All API keys exhausted")


# Singleton instance
_client_pool = None


def get_client_pool() -> GroqClientPool:
    """Get or create the singleton client pool"""
    global _client_pool
    if _client_pool is None:
        _client_pool = GroqClientPool()
    return _client_pool