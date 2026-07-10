"""
Extensible tool registry for the agent workflow engine.

Register tools with @register_tool, then dispatch via execute_tool(action, payload).
"""
import logging
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

_TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}


def register_tool(
    action: str,
    description: str = '',
    input_schema: Optional[Dict] = None,
    output_schema: Optional[Dict] = None,
):
    """Decorator to register a tool handler function."""
    def decorator(func: Callable[[Dict[str, Any]], Dict[str, Any]]):
        _TOOL_REGISTRY[action] = {
            'handler': func,
            'description': description,
            'input_schema': input_schema or {},
            'output_schema': output_schema or {},
        }
        return func
    return decorator


def execute_tool(action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Look up and execute a registered tool by action name."""
    entry = _TOOL_REGISTRY.get(action)
    if entry is None:
        raise ValueError(f'Unsupported tool action: {action}. Available: {list(_TOOL_REGISTRY.keys())}')
    return entry['handler'](payload)


def list_tools() -> list:
    """Return metadata for all registered tools (for builder UI)."""
    return [
        {
            'action': action,
            'description': entry['description'],
            'input_schema': entry['input_schema'],
            'output_schema': entry['output_schema'],
        }
        for action, entry in _TOOL_REGISTRY.items()
    ]


# ── Built-in tools ────────────────────────────────────────────

@register_tool(
    action='content_repurposer_process',
    description='Process a YouTube video or audio file and extract transcript + insights.',
    input_schema={'url': 'string'},
    output_schema={'transcript': 'string', 'insights': 'object'},
)
def _tool_content_repurposer_process(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.content_repurposer_service import ContentRepurposerService
    service = ContentRepurposerService()
    result = service.process(youtube_url=payload.get('url', ''), audio_file=None)
    if not result.get('success'):
        raise ValueError(result.get('error', 'Content processing failed'))
    return result


@register_tool(
    action='content_repurposer_generate',
    description='Generate multi-platform content from a transcript.',
    input_schema={'transcript': 'string', 'platforms': 'array'},
    output_schema={'posts': 'object'},
)
def _tool_content_repurposer_generate(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.content_repurposer_service import ContentRepurposerService
    service = ContentRepurposerService()
    result = service.generate(
        transcript=payload.get('transcript', ''),
        insights=payload.get('insights', {}),
        source_title=payload.get('source_title', ''),
        platforms=payload.get('platforms', ['linkedin', 'twitter', 'newsletter']),
    )
    if not result.get('success'):
        raise ValueError(result.get('error', 'Content generation failed'))
    return result


@register_tool(
    action='draft_followup_email',
    description='Draft a professional follow-up email using AI.',
    input_schema={'recipient': 'string', 'context': 'string'},
    output_schema={'email_draft': 'string'},
)
def _tool_draft_followup_email(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    text = ai.generate_email(
        email_type='follow-up',
        recipient=payload.get('recipient', 'Customer'),
        subject_context=payload.get('context', ''),
        tone='professional',
    )
    return {'email_draft': text}


@register_tool(
    action='http_request',
    description='Make an HTTP request to an external URL.',
    input_schema={'url': 'string', 'method': 'string', 'headers': 'object', 'body': 'object'},
    output_schema={'status_code': 'integer', 'body': 'object'},
)
def _tool_http_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    import requests
    method = payload.get('method', 'GET').upper()
    url = payload.get('url', '')
    if not url:
        raise ValueError('url is required for http_request tool')
    headers = payload.get('headers', {})
    body = payload.get('body')
    timeout = int(payload.get('timeout', 30))

    resp = requests.request(method, url, headers=headers, json=body, timeout=timeout)
    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text[:2000]
    return {'status_code': resp.status_code, 'body': resp_body}


@register_tool(
    action='ai_summarize',
    description='Summarize text using AI.',
    input_schema={'text': 'string', 'max_length': 'integer'},
    output_schema={'summary': 'string'},
)
def _tool_ai_summarize(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    text = payload.get('text', '')
    max_tokens = int(payload.get('max_length', 500))
    result = ai._generate_completion(
        messages=[
            {"role": "system", "content": "Summarize the following text concisely."},
            {"role": "user", "content": text},
        ],
        max_tokens=max_tokens,
        use_cache=False,
    )
    return {'summary': result}


# ── Content tools ─────────────────────────────────────────────

@register_tool(
    action='generate_blog_post',
    description='Generate a full blog post on a given topic with SEO optimization.',
    input_schema={'topic': 'string', 'tone': 'string', 'length': 'string', 'target_audience': 'string', 'keywords': 'string'},
    output_schema={'title': 'string', 'content': 'string', 'meta_description': 'string'},
)
def _tool_generate_blog_post(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_blog_post(
        topic=payload.get('topic', ''),
        tone=payload.get('tone', 'informative'),
        length=payload.get('length', 'medium'),
        target_audience=payload.get('target_audience', ''),
        keywords=payload.get('keywords', ''),
    )


@register_tool(
    action='generate_social_posts',
    description='Generate social media posts for multiple platforms from a topic or content.',
    input_schema={'topic': 'string', 'platforms': 'array', 'tone': 'string', 'include_hashtags': 'boolean'},
    output_schema={'posts': 'object'},
)
def _tool_generate_social_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_social_media_posts(
        topic=payload.get('topic', ''),
        platforms=payload.get('platforms', ['linkedin', 'twitter']),
        tone=payload.get('tone', 'casual'),
        include_hashtags=payload.get('include_hashtags', True),
    )


@register_tool(
    action='generate_meta_description',
    description='Generate an SEO-optimized meta description for content.',
    input_schema={'content': 'string', 'keywords': 'array', 'tone': 'string'},
    output_schema={'meta_description': 'string', 'character_count': 'integer'},
)
def _tool_generate_meta_description(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_meta_description(
        content=payload.get('content', ''),
        keywords=payload.get('keywords'),
        tone=payload.get('tone', 'professional'),
    )


@register_tool(
    action='extract_keywords',
    description='Extract relevant keywords and key phrases from text.',
    input_schema={'text': 'string', 'max_keywords': 'integer'},
    output_schema={'keywords': 'array', 'density': 'object'},
)
def _tool_extract_keywords(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.extract_keywords(
        text=payload.get('text', ''),
        max_keywords=int(payload.get('max_keywords', 10)),
    )


# ── Communication tools ───────────────────────────────────────

@register_tool(
    action='generate_email',
    description='Generate a professional email of any type (cold-outreach, follow-up, introduction, etc.).',
    input_schema={'email_type': 'string', 'recipient': 'string', 'subject_context': 'string', 'key_points': 'string', 'tone': 'string'},
    output_schema={'subject': 'string', 'body': 'string'},
)
def _tool_generate_email(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_email(
        email_type=payload.get('email_type', 'professional'),
        recipient=payload.get('recipient', ''),
        subject_context=payload.get('subject_context', ''),
        key_points=payload.get('key_points', ''),
        tone=payload.get('tone', 'professional'),
    )


@register_tool(
    action='generate_cover_letter',
    description='Generate a tailored cover letter for a job application.',
    input_schema={'job_title': 'string', 'company_name': 'string', 'experience': 'string', 'skills': 'string', 'job_description': 'string', 'tone': 'string'},
    output_schema={'cover_letter': 'string'},
)
def _tool_generate_cover_letter(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_cover_letter(
        job_title=payload.get('job_title', ''),
        company_name=payload.get('company_name', ''),
        experience=payload.get('experience', ''),
        skills=payload.get('skills', ''),
        job_description=payload.get('job_description', ''),
        tone=payload.get('tone', 'professional'),
    )


@register_tool(
    action='generate_ad_copy',
    description='Generate advertising copy for multiple platforms (Google, Facebook, LinkedIn, etc.).',
    input_schema={'product_or_service': 'string', 'platform': 'string', 'target_audience': 'string', 'unique_selling_points': 'string', 'tone': 'string', 'num_variations': 'integer'},
    output_schema={'ad_copies': 'array'},
)
def _tool_generate_ad_copy(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_ad_copy(
        product_or_service=payload.get('product_or_service', ''),
        platform=payload.get('platform', 'google'),
        target_audience=payload.get('target_audience', ''),
        unique_selling_points=payload.get('unique_selling_points', ''),
        tone=payload.get('tone', 'persuasive'),
        num_variations=int(payload.get('num_variations', 3)),
    )


# ── Analysis tools ────────────────────────────────────────────

@register_tool(
    action='analyze_document',
    description='Analyze a document to extract key themes, sentiment, structure, and actionable insights.',
    input_schema={'text': 'string', 'analysis_type': 'string', 'questions': 'string'},
    output_schema={'analysis': 'object', 'key_points': 'array'},
)
def _tool_analyze_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.analyze_document(
        text=payload.get('text', ''),
        analysis_type=payload.get('analysis_type', 'comprehensive'),
        questions=payload.get('questions', ''),
    )


@register_tool(
    action='check_grammar',
    description='Check text for grammar, spelling, and style issues with corrections.',
    input_schema={'text': 'string'},
    output_schema={'corrected_text': 'string', 'issues': 'array'},
)
def _tool_check_grammar(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.check_grammar(text=payload.get('text', ''))


@register_tool(
    action='generate_outline',
    description='Generate a structured outline for an essay, article, report, or presentation.',
    input_schema={'topic': 'string', 'outline_type': 'string'},
    output_schema={'outline': 'string', 'sections': 'array'},
)
def _tool_generate_outline(payload: Dict[str, Any]) -> Dict[str, Any]:
    from tools.ai_service import AIService
    ai = AIService()
    return ai.generate_outline(
        topic=payload.get('topic', ''),
        outline_type=payload.get('outline_type', 'article'),
    )
