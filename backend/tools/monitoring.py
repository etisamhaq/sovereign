"""
Monitoring and metrics collection for the application
"""
import time
import logging
import psutil
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from django.core.cache import cache
from django.db import connection
from django.conf import settings
from django.utils import timezone
import redis

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Collects and aggregates application metrics
    """
    
    def __init__(self):
        self.redis_client = self._init_redis()
        self.metrics_prefix = "metrics"
        
    def _init_redis(self):
        """Initialize Redis connection"""
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1')
            return redis.from_url(redis_url, decode_responses=True)
        except Exception as e:
            logger.warning(f"Redis connection failed for metrics: {e}")
            return None
    
    def record_request(self, endpoint: str, method: str, status_code: int, 
                      response_time: float, user_id: Optional[int] = None):
        """Record API request metrics"""
        timestamp = datetime.now()
        hour_bucket = timestamp.strftime('%Y%m%d%H')
        
        metrics = {
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'response_time': response_time,
            'timestamp': timestamp.isoformat()
        }
        
        if user_id:
            metrics['user_id'] = user_id
        
        # Store in Redis if available
        if self.redis_client:
            try:
                # Increment counters
                self.redis_client.hincrby(f"{self.metrics_prefix}:requests:{hour_bucket}", endpoint, 1)
                self.redis_client.hincrby(f"{self.metrics_prefix}:status:{hour_bucket}", str(status_code), 1)
                
                # Store response time for percentile calculations
                self.redis_client.zadd(
                    f"{self.metrics_prefix}:response_times:{hour_bucket}",
                    {f"{endpoint}:{timestamp.timestamp()}": response_time}
                )
                
                # Set expiry
                self.redis_client.expire(f"{self.metrics_prefix}:requests:{hour_bucket}", 86400 * 7)  # 7 days
                self.redis_client.expire(f"{self.metrics_prefix}:status:{hour_bucket}", 86400 * 7)
                self.redis_client.expire(f"{self.metrics_prefix}:response_times:{hour_bucket}", 86400 * 7)
                
            except Exception as e:
                logger.error(f"Failed to record metrics: {e}")
    
    def record_ai_request(self, tool_name: str, success: bool, response_time: float,
                         cached: bool = False, user_id: Optional[int] = None):
        """Record AI tool usage metrics"""
        timestamp = datetime.now()
        hour_bucket = timestamp.strftime('%Y%m%d%H')
        
        if self.redis_client:
            try:
                # Increment tool usage counter
                self.redis_client.hincrby(f"{self.metrics_prefix}:ai_tools:{hour_bucket}", tool_name, 1)
                
                # Track success/failure
                status = "success" if success else "failure"
                self.redis_client.hincrby(f"{self.metrics_prefix}:ai_status:{hour_bucket}", status, 1)
                
                # Track cache hits
                if cached:
                    self.redis_client.hincrby(f"{self.metrics_prefix}:cache_hits:{hour_bucket}", tool_name, 1)
                
                # Store response time
                self.redis_client.zadd(
                    f"{self.metrics_prefix}:ai_response_times:{hour_bucket}",
                    {f"{tool_name}:{timestamp.timestamp()}": response_time}
                )
                
                # Set expiry
                self.redis_client.expire(f"{self.metrics_prefix}:ai_tools:{hour_bucket}", 86400 * 7)
                self.redis_client.expire(f"{self.metrics_prefix}:ai_status:{hour_bucket}", 86400 * 7)
                self.redis_client.expire(f"{self.metrics_prefix}:cache_hits:{hour_bucket}", 86400 * 7)
                self.redis_client.expire(f"{self.metrics_prefix}:ai_response_times:{hour_bucket}", 86400 * 7)
                
            except Exception as e:
                logger.error(f"Failed to record AI metrics: {e}")
    
    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get metrics summary for the last N hours"""
        summary = {
            'period_hours': hours,
            'requests': {},
            'ai_tools': {},
            'status_codes': {},
            'cache_stats': {},
            'performance': {},
            'system': {}
        }
        
        if not self.redis_client:
            return summary
        
        # Calculate time range
        now = datetime.now()
        
        for i in range(hours):
            hour_time = now - timedelta(hours=i)
            hour_bucket = hour_time.strftime('%Y%m%d%H')
            
            # Aggregate request counts
            requests = self.redis_client.hgetall(f"{self.metrics_prefix}:requests:{hour_bucket}")
            for endpoint, count in requests.items():
                if endpoint not in summary['requests']:
                    summary['requests'][endpoint] = 0
                summary['requests'][endpoint] += int(count)
            
            # Aggregate AI tool usage
            ai_tools = self.redis_client.hgetall(f"{self.metrics_prefix}:ai_tools:{hour_bucket}")
            for tool, count in ai_tools.items():
                if tool not in summary['ai_tools']:
                    summary['ai_tools'][tool] = 0
                summary['ai_tools'][tool] += int(count)
            
            # Aggregate status codes
            status_codes = self.redis_client.hgetall(f"{self.metrics_prefix}:status:{hour_bucket}")
            for status, count in status_codes.items():
                if status not in summary['status_codes']:
                    summary['status_codes'][status] = 0
                summary['status_codes'][status] += int(count)
            
            # Cache hits
            cache_hits = self.redis_client.hgetall(f"{self.metrics_prefix}:cache_hits:{hour_bucket}")
            for tool, count in cache_hits.items():
                if tool not in summary['cache_stats']:
                    summary['cache_stats'][tool] = {'hits': 0, 'total': 0}
                summary['cache_stats'][tool]['hits'] += int(count)
        
        # Calculate cache hit rates
        for tool in summary['cache_stats']:
            if tool in summary['ai_tools']:
                summary['cache_stats'][tool]['total'] = summary['ai_tools'][tool]
                summary['cache_stats'][tool]['hit_rate'] = \
                    (summary['cache_stats'][tool]['hits'] / summary['ai_tools'][tool]) * 100
        
        # Calculate performance metrics (last hour only)
        last_hour_bucket = now.strftime('%Y%m%d%H')
        response_times = self.redis_client.zrange(
            f"{self.metrics_prefix}:response_times:{last_hour_bucket}",
            0, -1, withscores=True
        )
        
        if response_times:
            times = [score for _, score in response_times]
            summary['performance'] = {
                'avg_response_time': sum(times) / len(times),
                'min_response_time': min(times),
                'max_response_time': max(times),
                'p50_response_time': self._calculate_percentile(times, 50),
                'p95_response_time': self._calculate_percentile(times, 95),
                'p99_response_time': self._calculate_percentile(times, 99)
            }
        
        # Add system metrics
        summary['system'] = self.get_system_metrics()
        
        return summary
    
    def _calculate_percentile(self, values: list, percentile: int) -> float:
        """Calculate percentile value"""
        if not values:
            return 0
        
        sorted_values = sorted(values)
        index = int(len(sorted_values) * (percentile / 100))
        
        if index >= len(sorted_values):
            index = len(sorted_values) - 1
        
        return sorted_values[index]
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system resource metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory metrics
            memory = psutil.virtual_memory()
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            
            # Database connections
            db_connections = self._get_db_connections()
            
            # Redis info
            redis_info = self._get_redis_info()
            
            return {
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count
                },
                'memory': {
                    'total_gb': memory.total / (1024**3),
                    'used_gb': memory.used / (1024**3),
                    'percent': memory.percent
                },
                'disk': {
                    'total_gb': disk.total / (1024**3),
                    'used_gb': disk.used / (1024**3),
                    'percent': disk.percent
                },
                'database': db_connections,
                'redis': redis_info
            }
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {}
    
    def _get_db_connections(self) -> Dict[str, Any]:
        """Get database connection metrics"""
        try:
            with connection.cursor() as cursor:
                # PostgreSQL specific query
                cursor.execute("""
                    SELECT count(*) as total,
                           count(*) FILTER (WHERE state = 'active') as active,
                           count(*) FILTER (WHERE state = 'idle') as idle
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                """)
                result = cursor.fetchone()
                
                return {
                    'total': result[0],
                    'active': result[1],
                    'idle': result[2]
                }
        except:
            return {'error': 'Unable to fetch database metrics'}
    
    def _get_redis_info(self) -> Dict[str, Any]:
        """Get Redis metrics"""
        if not self.redis_client:
            return {'error': 'Redis not connected'}
        
        try:
            info = self.redis_client.info()
            return {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory_human': info.get('used_memory_human', 'N/A'),
                'used_memory_peak_human': info.get('used_memory_peak_human', 'N/A'),
                'total_commands_processed': info.get('total_commands_processed', 0)
            }
        except:
            return {'error': 'Unable to fetch Redis metrics'}


class AlertManager:
    """
    Manages alerts and notifications for critical events
    """
    
    def __init__(self):
        self.thresholds = {
            'error_rate': 0.05,  # 5% error rate
            'response_time_p95': 2000,  # 2 seconds
            'cpu_percent': 80,
            'memory_percent': 90,
            'disk_percent': 85,
            'api_key_failures': 5
        }
    
    def check_alerts(self, metrics: Dict[str, Any]) -> list:
        """Check metrics against thresholds and generate alerts"""
        alerts = []
        
        # Check error rate
        total_requests = sum(int(count) for count in metrics['status_codes'].values())
        error_requests = sum(
            int(count) for status, count in metrics['status_codes'].items()
            if status.startswith('5')
        )
        
        if total_requests > 0:
            error_rate = error_requests / total_requests
            if error_rate > self.thresholds['error_rate']:
                alerts.append({
                    'level': 'critical',
                    'type': 'error_rate',
                    'message': f"High error rate: {error_rate:.2%}",
                    'value': error_rate
                })
        
        # Check response time
        if 'performance' in metrics and metrics['performance']:
            p95 = metrics['performance'].get('p95_response_time', 0)
            if p95 > self.thresholds['response_time_p95']:
                alerts.append({
                    'level': 'warning',
                    'type': 'response_time',
                    'message': f"High P95 response time: {p95:.2f}ms",
                    'value': p95
                })
        
        # Check system resources
        if 'system' in metrics:
            system = metrics['system']
            
            if system.get('cpu', {}).get('percent', 0) > self.thresholds['cpu_percent']:
                alerts.append({
                    'level': 'warning',
                    'type': 'cpu',
                    'message': f"High CPU usage: {system['cpu']['percent']}%",
                    'value': system['cpu']['percent']
                })
            
            if system.get('memory', {}).get('percent', 0) > self.thresholds['memory_percent']:
                alerts.append({
                    'level': 'critical',
                    'type': 'memory',
                    'message': f"High memory usage: {system['memory']['percent']}%",
                    'value': system['memory']['percent']
                })
            
            if system.get('disk', {}).get('percent', 0) > self.thresholds['disk_percent']:
                alerts.append({
                    'level': 'warning',
                    'type': 'disk',
                    'message': f"High disk usage: {system['disk']['percent']}%",
                    'value': system['disk']['percent']
                })
        
        return alerts
    
    def send_alert(self, alert: Dict[str, Any]):
        """Send alert notification"""
        # This would integrate with your notification system
        # (email, Slack, PagerDuty, etc.)
        logger.warning(f"ALERT [{alert['level']}] {alert['type']}: {alert['message']}")
        
        # Store alert in cache for dashboard
        cache_key = f"alert:{datetime.now().timestamp()}"
        cache.set(cache_key, alert, 3600)  # Keep for 1 hour


# Singleton instances
_metrics_collector = None
_alert_manager = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create the singleton metrics collector"""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def get_alert_manager() -> AlertManager:
    """Get or create the singleton alert manager"""
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
    return _alert_manager