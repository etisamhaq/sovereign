"""
Bind every existing AI tool to the agent registry.

Each binding wraps a method on :class:`tools.ai_service.AIService` (or another
service) with:

- a JSON Schema parameter spec (so the LLM can call it with structured args);
- a ``category`` and ``is_premium`` flag matching the existing tool catalogue;
- a thin Python adapter that translates the model's flat arguments into the
  service method's signature.

Adding a new tool is a single decorator. Registration is idempotent — the
``ready`` hook can run multiple times across reloads without duplicating
entries.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .registry import register_tool

logger = logging.getLogger(__name__)


def _ai():
    """Lazy AIService factory — avoids import-time Groq client creation."""
    from tools.ai_service import AIService
    return AIService()


# ─── Writing tools ─────────────────────────────────────────────────────────


@register_tool(
    name='paraphrase_text',
    description=(
        'Rewrite a passage of text in a chosen style (standard, formal, creative, '
        'simple, expand, shorten). Use when the user wants the same idea expressed '
        'differently.'
    ),
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string', 'description': 'Text to paraphrase.'},
            'mode': {
                'type': 'string',
                'enum': ['standard', 'formal', 'creative', 'simple', 'expand', 'shorten'],
                'default': 'standard',
            },
        },
        'required': ['text'],
    },
    category='writing',
)
def paraphrase_text(text: str, mode: str = 'standard') -> str:
    return _ai().paraphrase(text=text, mode=mode)


@register_tool(
    name='check_grammar',
    description='Run a grammar / style check and return corrected text plus a list of errors and suggestions.',
    parameters={
        'type': 'object',
        'properties': {'text': {'type': 'string', 'description': 'Text to check.'}},
        'required': ['text'],
    },
    category='writing',
)
def check_grammar(text: str) -> Dict[str, Any]:
    return _ai().check_grammar(text=text)


@register_tool(
    name='improve_writing',
    description='Improve a passage focused on clarity, conciseness, engagement, or formality.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'focus': {
                'type': 'string',
                'enum': ['clarity', 'conciseness', 'engagement', 'formality', 'creativity'],
                'default': 'clarity',
            },
        },
        'required': ['text'],
    },
    category='writing',
)
def improve_writing(text: str, focus: str = 'clarity') -> str:
    return _ai().improve_writing(text=text, focus=focus)


@register_tool(
    name='summarize_text',
    description='Summarize text. Length: short, medium, long, or bullets.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'length': {'type': 'string', 'enum': ['short', 'medium', 'long', 'bullets'], 'default': 'medium'},
        },
        'required': ['text'],
    },
    category='writing',
)
def summarize_text(text: str, length: str = 'medium') -> str:
    return _ai().summarize(text=text, length=length)


@register_tool(
    name='translate_text',
    description='Translate text to a target language (any language name).',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'target_language': {'type': 'string'},
        },
        'required': ['text', 'target_language'],
    },
    category='writing',
)
def translate_text(text: str, target_language: str) -> str:
    return _ai().translate(text=text, target_language=target_language)


@register_tool(
    name='analyze_tone',
    description='Analyze the tone, style and sentiment of a passage and return a structured report.',
    parameters={
        'type': 'object',
        'properties': {'text': {'type': 'string'}},
        'required': ['text'],
    },
    category='writing',
)
def analyze_tone(text: str) -> Dict[str, Any]:
    return _ai().analyze_tone(text=text)


@register_tool(
    name='generate_outline',
    description='Generate a writing outline for an essay, blog post, presentation, or report.',
    parameters={
        'type': 'object',
        'properties': {
            'topic': {'type': 'string'},
            'outline_type': {
                'type': 'string',
                'enum': ['essay', 'blog_post', 'presentation', 'report', 'speech'],
                'default': 'essay',
            },
        },
        'required': ['topic'],
    },
    category='writing',
)
def generate_outline(topic: str, outline_type: str = 'essay') -> str:
    return _ai().generate_outline(topic=topic, outline_type=outline_type)


@register_tool(
    name='generate_titles',
    description='Generate catchy title suggestions for a piece of content.',
    parameters={
        'type': 'object',
        'properties': {
            'content': {'type': 'string'},
            'count': {'type': 'integer', 'minimum': 1, 'maximum': 20, 'default': 5},
        },
        'required': ['content'],
    },
    category='writing',
)
def generate_titles(content: str, count: int = 5) -> Any:
    return _ai().generate_titles(content=content, num_titles=count)


# ─── Education tools ───────────────────────────────────────────────────────


@register_tool(
    name='generate_essay',
    description='Write a full essay on a topic. Premium tool.',
    parameters={
        'type': 'object',
        'properties': {
            'topic': {'type': 'string'},
            'length': {'type': 'integer', 'minimum': 100, 'maximum': 4000, 'default': 500},
            'essay_type': {
                'type': 'string',
                'enum': ['argumentative', 'descriptive', 'narrative', 'expository', 'persuasive'],
                'default': 'argumentative',
            },
        },
        'required': ['topic'],
    },
    category='education',
    is_premium=True,
)
def generate_essay(topic: str, length: int = 500, essay_type: str = 'argumentative') -> str:
    return _ai().generate_essay(topic=topic, length=length, essay_type=essay_type)


@register_tool(
    name='generate_quiz',
    description='Generate quiz questions from supplied text. Premium tool.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'num_questions': {'type': 'integer', 'minimum': 1, 'maximum': 30, 'default': 5},
        },
        'required': ['text'],
    },
    category='education',
    is_premium=True,
)
def generate_quiz(text: str, num_questions: int = 5) -> Any:
    return _ai().generate_quiz(text=text, num_questions=num_questions)


@register_tool(
    name='generate_flashcards',
    description='Create study flashcards from supplied text or topic.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'count': {'type': 'integer', 'minimum': 1, 'maximum': 50, 'default': 10},
        },
        'required': ['text'],
    },
    category='education',
)
def generate_flashcards(text: str, count: int = 10) -> Any:
    ai = _ai()
    if hasattr(ai, 'generate_flashcards'):
        return ai.generate_flashcards(text=text, num_cards=count)
    # Fallback: synthesize a flashcard list via the generic chat path.
    msg = [
        {'role': 'system', 'content': 'Return JSON list of {question, answer} flashcards.'},
        {'role': 'user', 'content': f'Make {count} flashcards from:\n{text}'},
    ]
    return ai._generate_completion(msg)


@register_tool(
    name='generate_citation',
    description='Build a formatted citation (APA, MLA, Chicago, Harvard, IEEE) from source metadata.',
    parameters={
        'type': 'object',
        'properties': {
            'source_info': {
                'type': 'object',
                'description': 'Free-form metadata about the source (title, author, year, url, …).',
            },
            'style': {
                'type': 'string',
                'enum': ['apa', 'mla', 'chicago', 'harvard', 'ieee'],
                'default': 'apa',
            },
        },
        'required': ['source_info'],
    },
    category='education',
)
def generate_citation(source_info: Dict[str, Any], style: str = 'apa') -> str:
    return _ai().generate_citation(source_info=source_info, style=style)


# ─── SEO / marketing tools ─────────────────────────────────────────────────


@register_tool(
    name='generate_meta_description',
    description='Produce SEO meta-description options for a page.',
    parameters={
        'type': 'object',
        'properties': {
            'content': {'type': 'string'},
            'keywords': {'type': 'array', 'items': {'type': 'string'}},
            'tone': {'type': 'string', 'enum': ['professional', 'casual', 'urgent', 'friendly'], 'default': 'professional'},
            'target_length': {'type': 'integer', 'minimum': 80, 'maximum': 320, 'default': 155},
        },
        'required': ['content'],
    },
    category='seo',
)
def generate_meta_description(
    content: str, keywords: Optional[List[str]] = None,
    tone: str = 'professional', target_length: int = 155,
) -> Any:
    return _ai().generate_meta_description(
        content=content, keywords=keywords or [],
        tone=tone, target_length=target_length,
    )


@register_tool(
    name='extract_keywords',
    description='Extract SEO keywords and key phrases from a passage.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'max_keywords': {'type': 'integer', 'minimum': 1, 'maximum': 50, 'default': 10},
        },
        'required': ['text'],
    },
    category='seo',
)
def extract_keywords(text: str, max_keywords: int = 10) -> Any:
    return _ai().extract_keywords(text=text, max_keywords=max_keywords)


@register_tool(
    name='generate_blog_post',
    description='Generate a structured blog post with intro, sections, conclusion, SEO meta and social snippets. Premium.',
    parameters={
        'type': 'object',
        'properties': {
            'topic': {'type': 'string'},
            'tone': {'type': 'string', 'default': 'informative'},
            'length': {'type': 'string', 'enum': ['short', 'medium', 'long'], 'default': 'medium'},
            'target_audience': {'type': 'string', 'default': ''},
            'keywords': {'type': 'string', 'default': ''},
        },
        'required': ['topic'],
    },
    category='writing',
    is_premium=True,
    timeout_s=120,
)
def generate_blog_post(
    topic: str, tone: str = 'informative', length: str = 'medium',
    target_audience: str = '', keywords: str = '',
) -> Any:
    return _ai().generate_blog_post(
        topic=topic, tone=tone, length=length,
        target_audience=target_audience, keywords=keywords,
    )


@register_tool(
    name='generate_youtube_script',
    description='Generate a YouTube video script with hooks and CTAs. Premium.',
    parameters={
        'type': 'object',
        'properties': {
            'topic': {'type': 'string'},
            'duration': {'type': 'string', 'description': 'Approximate length in minutes.', 'default': '10'},
            'style': {'type': 'string', 'default': 'educational'},
            'target_audience': {'type': 'string', 'default': ''},
            'include_hooks': {'type': 'boolean', 'default': True},
        },
        'required': ['topic'],
    },
    category='writing',
    is_premium=True,
    timeout_s=120,
)
def generate_youtube_script(
    topic: str, duration: str = '10', style: str = 'educational',
    target_audience: str = '', include_hooks: bool = True,
) -> Any:
    return _ai().generate_youtube_script(
        topic=topic, duration=duration, style=style,
        target_audience=target_audience, include_hooks=include_hooks,
    )


@register_tool(
    name='generate_cover_letter',
    description='Generate a cover letter tailored to a job. Free tool.',
    parameters={
        'type': 'object',
        'properties': {
            'job_title': {'type': 'string'},
            'company_name': {'type': 'string'},
            'experience': {'type': 'string'},
            'skills': {'type': 'string', 'default': ''},
            'job_description': {'type': 'string', 'default': ''},
            'tone': {'type': 'string', 'default': 'professional'},
        },
        'required': ['job_title', 'company_name', 'experience'],
    },
    category='writing',
)
def generate_cover_letter(
    job_title: str, company_name: str, experience: str,
    skills: str = '', job_description: str = '', tone: str = 'professional',
) -> Any:
    return _ai().generate_cover_letter(
        job_title=job_title, company_name=company_name, experience=experience,
        skills=skills, job_description=job_description, tone=tone,
    )


@register_tool(
    name='generate_ad_copy',
    description='Generate ad copy variations for Google, Facebook, Instagram or LinkedIn. Premium.',
    parameters={
        'type': 'object',
        'properties': {
            'product_or_service': {'type': 'string'},
            'platform': {'type': 'string', 'enum': ['google', 'facebook', 'instagram', 'linkedin'], 'default': 'google'},
            'target_audience': {'type': 'string', 'default': ''},
            'unique_selling_points': {'type': 'string', 'default': ''},
            'tone': {'type': 'string', 'default': 'persuasive'},
            'num_variations': {'type': 'integer', 'minimum': 1, 'maximum': 10, 'default': 3},
        },
        'required': ['product_or_service'],
    },
    category='seo',
    is_premium=True,
)
def generate_ad_copy(
    product_or_service: str, platform: str = 'google',
    target_audience: str = '', unique_selling_points: str = '',
    tone: str = 'persuasive', num_variations: int = 3,
) -> Any:
    return _ai().generate_ad_copy(
        product_or_service=product_or_service, platform=platform,
        target_audience=target_audience, unique_selling_points=unique_selling_points,
        tone=tone, num_variations=num_variations,
    )


# ─── Discovery / utility tools ────────────────────────────────────────────


@register_tool(
    name='find_tool',
    description=(
        "Find Sovereign tools that match a user's stated goal. Returns a list of matching "
        'tools the user can be deep-linked to from the chat UI.'
    ),
    parameters={
        'type': 'object',
        'properties': {
            'query': {'type': 'string', 'description': 'What the user wants to do.'},
            'limit': {'type': 'integer', 'minimum': 1, 'maximum': 10, 'default': 5},
        },
        'required': ['query'],
    },
    category='utility',
)
def find_tool(query: str, limit: int = 5) -> Dict[str, Any]:
    """Match against the Tool catalogue using a simple lower-cased name+description scan.
    This intentionally avoids any external embedding service for now — callers
    can replace this with a vector search once pgvector is wired up.
    """
    from tools.models import Tool

    q_lower = (query or '').lower()
    if not q_lower:
        return {'tools': []}

    candidates = list(Tool.objects.filter(is_active=True).only('slug', 'name', 'description', 'category', 'is_premium'))

    def score(tool) -> float:
        haystack = f'{tool.name} {tool.description}'.lower()
        terms = [t for t in q_lower.split() if t]
        if not terms:
            return 0
        hits = sum(1 for t in terms if t in haystack)
        return hits / len(terms)

    ranked = sorted(((score(t), t) for t in candidates), key=lambda p: -p[0])
    out = []
    for s, tool in ranked[:limit]:
        if s <= 0:
            continue
        out.append({
            'slug': tool.slug,
            'name': tool.name,
            'description': tool.description,
            'category': tool.category,
            'is_premium': tool.is_premium,
            'url': f'/tools/{tool.slug}',
            'score': round(s, 3),
        })
    return {'tools': out}


@register_tool(
    name='research_topic',
    description=(
        'Run a multi-source research task: fetches Wikipedia + web sources and returns '
        'a structured research brief. Premium tool.'
    ),
    parameters={
        'type': 'object',
        'properties': {
            'topic': {'type': 'string'},
            'depth': {
                'type': 'string',
                'enum': ['quick', 'standard', 'deep'],
                'default': 'standard',
            },
        },
        'required': ['topic'],
    },
    category='utility',
    is_premium=True,
    timeout_s=180,
)
def research_topic(topic: str, depth: str = 'standard') -> Dict[str, Any]:
    """Best-effort wrapper. If the research service is unavailable we degrade
    to a single LLM-only summary so the agent can still progress."""
    try:
        from research.services import ResearchService
        rs = ResearchService()
        if hasattr(rs, 'quick_research'):
            return rs.quick_research(topic=topic, depth=depth)
    except Exception as exc:  # noqa: BLE001
        logger.info('Research service unavailable, falling back to LLM-only: %s', exc)
    ai = _ai()
    msg = [
        {'role': 'system', 'content': 'You are a research assistant. Produce a JSON brief with keys: summary, key_points (list), sources (list of {title,url}).'},
        {'role': 'user', 'content': f'Research topic: {topic}. Depth: {depth}.'},
    ]
    out = ai._generate_completion(msg, max_tokens=1500)
    return {'summary': out, 'key_points': [], 'sources': []}


def registered_tool_names() -> List[str]:
    """Used by tests / health checks."""
    from .registry import registry as _r
    return _r.names()
