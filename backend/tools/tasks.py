"""
Celery tasks for async AI processing
"""
import logging
import time
from typing import Dict, Any, Optional
from celery import shared_task, Task
from celery.exceptions import MaxRetriesExceededError, SoftTimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from .cache_service import get_cache_service, get_quota_cache
from .api_key_manager import get_client_pool

logger = logging.getLogger(__name__)


class AITask(Task):
    """Base task class with automatic retry and error handling"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        logger.error(f"Task {task_id} failed: {exc}")
        # Could send alert or update monitoring here
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Handle task retry"""
        logger.warning(f"Task {task_id} retrying: {exc}")
        super().on_retry(exc, task_id, args, kwargs, einfo)


@shared_task(base=AITask, name='tools.process_ai_request',
             soft_time_limit=30, time_limit=60)
def process_ai_request(tool_name: str, user_id: Optional[int], 
                       params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process AI request asynchronously with caching and rate limiting
    
    Args:
        tool_name: Name of the AI tool
        user_id: User ID for quota tracking
        params: Parameters for the AI tool
    
    Returns:
        Dict containing the AI response or error
    """
    try:
        # Check cache first
        cache_service = get_cache_service()
        cached_response = cache_service.get(tool_name, params)
        if cached_response:
            logger.info(f"Cache hit for {tool_name}")
            return {
                'success': True,
                'data': cached_response,
                'cached': True
            }
        
        # Check user quota if user_id provided
        if user_id:
            quota_cache = get_quota_cache()
            daily_limit = getattr(settings, 'USAGE_LIMIT_PRO', 2000)
            if quota_cache.check_quota_exceeded(user_id, limit=daily_limit, period='daily'):
                return {
                    'success': False,
                    'error': 'Daily quota exceeded. Please upgrade your plan.',
                    'quota_exceeded': True
                }
        
        # Get AI client from pool
        client_pool = get_client_pool()
        
        # Process based on tool type
        result = None
        if tool_name == 'paraphrase':
            result = _process_paraphrase(client_pool, params)
        elif tool_name == 'grammar_check':
            result = _process_grammar_check(client_pool, params)
        elif tool_name == 'essay_generator':
            result = _process_essay_generator(client_pool, params)
        elif tool_name == 'summarizer':
            result = _process_summarizer(client_pool, params)
        elif tool_name == 'translator':
            result = _process_translator(client_pool, params)
        else:
            # Generic AI processing
            result = _process_generic_ai(client_pool, tool_name, params)
        
        # Cache the successful result
        if result:
            cache_service.set(tool_name, params, result, ttl=3600*24)  # 24 hour cache
        
        # Update user usage
        if user_id:
            quota_cache.increment_user_usage(user_id, 'daily')
            quota_cache.increment_user_usage(user_id, 'hourly')
        
        return {
            'success': True,
            'data': result,
            'cached': False
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"Task timeout for {tool_name}")
        return {
            'success': False,
            'error': 'Request timeout. Please try with shorter input.',
            'timeout': True
        }
    except Exception as e:
        logger.error(f"Task error for {tool_name}: {e}", exc_info=True)
        error_str = str(e).lower()
        if any(kw in error_str for kw in ('rate_limit', 'timeout', 'connection', '503', '502', '429')):
            raise
        return {
            'success': False,
            'error': str(e)
        }


def _process_paraphrase(client_pool, params: Dict[str, Any]) -> str:
    """Process paraphrase request"""
    text = params.get('text', '')
    mode = params.get('mode', 'standard')
    
    # Build prompt based on mode
    prompts = {
        'standard': "Paraphrase the following text while maintaining its meaning:",
        'formal': "Rewrite the following text in a formal, professional tone:",
        'casual': "Rewrite the following text in a casual, conversational tone:",
        'creative': "Creatively rewrite the following text with vivid language:",
        'simple': "Simplify the following text for better understanding:",
        'expand': "Expand the following text with more detail:",
        'shorten': "Shorten the following text while keeping key points:"
    }
    
    prompt = prompts.get(mode, prompts['standard'])
    
    def execute(client):
        return client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.7,
            max_tokens=2000
        ).choices[0].message.content
    
    return client_pool.execute_with_retry(execute)


def _process_grammar_check(client_pool, params: Dict[str, Any]) -> Dict:
    """Process grammar check request"""
    text = params.get('text', '')
    
    def execute(client):
        response = client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a grammar and style checker. Analyze the text and:
                    1. Identify and correct grammar errors
                    2. Suggest style improvements
                    3. Return a JSON response with:
                       - corrected_text: The corrected version
                       - errors: List of errors found
                       - suggestions: List of style suggestions"""
                },
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=2000
        ).choices[0].message.content
        
        # Parse response to ensure it's valid JSON
        try:
            import json
            return json.loads(response)
        except:
            return {
                'corrected_text': response,
                'errors': [],
                'suggestions': []
            }
    
    return client_pool.execute_with_retry(execute)


def _process_essay_generator(client_pool, params: Dict[str, Any]) -> str:
    """Process essay generation request"""
    topic = params.get('topic', '')
    essay_type = params.get('essay_type', 'argumentative')
    length = params.get('length', 500)
    
    prompts = {
        'argumentative': f"Write an argumentative essay about {topic}",
        'descriptive': f"Write a descriptive essay about {topic}",
        'narrative': f"Write a narrative essay about {topic}",
        'expository': f"Write an expository essay about {topic}",
        'persuasive': f"Write a persuasive essay about {topic}"
    }
    
    prompt = prompts.get(essay_type, prompts['argumentative'])
    prompt += f" (approximately {length} words)"
    
    def execute(client):
        return client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {"role": "system", "content": "You are an expert essay writer."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=min(length * 2, 4000)
        ).choices[0].message.content
    
    return client_pool.execute_with_retry(execute)


def _process_summarizer(client_pool, params: Dict[str, Any]) -> str:
    """Process text summarization request"""
    text = params.get('text', '')
    length = params.get('length', 'medium')
    
    length_instructions = {
        'short': "in 2-3 sentences",
        'medium': "in 4-5 sentences",
        'long': "in a detailed paragraph"
    }
    
    instruction = length_instructions.get(length, length_instructions['medium'])
    
    def execute(client):
        return client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system", 
                    "content": f"Summarize the following text {instruction}:"
                },
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            max_tokens=500
        ).choices[0].message.content
    
    return client_pool.execute_with_retry(execute)


def _process_translator(client_pool, params: Dict[str, Any]) -> str:
    """Process translation request"""
    text = params.get('text', '')
    target_language = params.get('target_language', 'Spanish')
    
    def execute(client):
        return client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system", 
                    "content": f"Translate the following text to {target_language}:"
                },
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=2000
        ).choices[0].message.content
    
    return client_pool.execute_with_retry(execute)


def _process_generic_ai(client_pool, tool_name: str, params: Dict[str, Any]) -> Any:
    """Process generic AI request"""
    prompt = params.get('prompt', '')
    system_prompt = params.get('system_prompt', f"You are a helpful AI assistant for {tool_name}")
    
    def execute(client):
        return client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=params.get('temperature', 0.7),
            max_tokens=params.get('max_tokens', 2000)
        ).choices[0].message.content
    
    return client_pool.execute_with_retry(execute)


@shared_task(name='tools.batch_process_requests')
def batch_process_requests(requests: list) -> list:
    """
    Process multiple AI requests in batch for efficiency
    
    Args:
        requests: List of request dictionaries
    
    Returns:
        List of results
    """
    results = []
    
    for request in requests:
        result = process_ai_request.apply_async(
            args=[
                request.get('tool_name'),
                request.get('user_id'),
                request.get('params')
            ]
        )
        results.append(result.id)
    
    return results


@shared_task(name='tools.cleanup_old_cache')
def cleanup_old_cache():
    """
    Periodic task to clean up old cache entries
    """
    cache_service = get_cache_service()
    
    # This would typically identify and remove old cache entries
    # Implementation depends on your specific needs
    logger.info("Running cache cleanup task")
    
    # Get cache stats for monitoring
    stats = cache_service.get_stats()
    logger.info(f"Cache stats: {stats}")
    
    return stats


@shared_task(name='tools.monitor_api_keys')
def monitor_api_keys():
    """
    Monitor API key usage and health
    """
    client_pool = get_client_pool()
    stats = client_pool.key_manager.get_stats()
    
    # Check for issues
    issues = []
    for key_id, key_stats in stats['keys'].items():
        if key_stats.get('is_rate_limited'):
            issues.append(f"Key {key_id} is rate limited")
        if key_stats.get('circuit_breaker_open'):
            issues.append(f"Key {key_id} circuit breaker is open")
        if key_stats.get('errors', 0) > 10:
            issues.append(f"Key {key_id} has {key_stats['errors']} errors")
    
    if issues:
        logger.warning(f"API key issues detected: {issues}")
        # Could send alerts here
    
    logger.info(f"API key stats: {stats}")
    return stats


@shared_task(name='tools.warm_cache')
def warm_cache_task(tool_name: str, queries: list):
    """
    Warm the cache with common queries.

    Dispatches each query as an async subtask so warming a long list does not
    block the beat scheduler / worker that picked up the parent task. The parent
    returns the count of successfully *enqueued* subtasks.
    """
    enqueued = 0
    for query in queries:
        try:
            process_ai_request.delay(tool_name, None, query)
            enqueued += 1
        except Exception as e:
            logger.error(f"Cache warming enqueue error for {tool_name}: {e}")

    logger.info(f"Cache warming for {tool_name}: enqueued {enqueued}/{len(queries)} subtasks")
    return enqueued