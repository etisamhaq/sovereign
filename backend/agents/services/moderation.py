"""
Lightweight content moderation.

This is *not* a full safety stack — we keep the surface minimal and easy to
swap out for a hosted moderation API (OpenAI Moderation, Mistral guard,
Llama-Guard, etc.) when the project graduates to one.

The current implementation:

1. Quick keyword/heuristic check covering the categories we have actively
   rejected via support tickets so far (CSAM, violence-incitement, plain
   prompt injection markers).
2. Optional OpenAI Moderation backend, gated on ``OPENAI_API_KEY`` being
   configured. Even when configured the keyword check runs first to short-
   circuit obvious cases without an extra round-trip.

The function is fail-open on backend errors: if the OpenAI moderation API
is down we don't 5xx the user — we just log and let the request through,
because hard-failing here would be worse than letting through an edge
case for one request.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class ModerationResult:
    flagged: bool
    category: str = ''
    detail: str = ''


# Conservative, narrow keyword list. The aim is to catch obvious abuse while
# keeping false positives near zero (the LLM itself is much better at nuance).
_BLOCKED_PATTERNS = [
    (re.compile(r'\b(child|minor|underage)\b.{0,40}\b(sexual|sex|explicit|porn)\b', re.I), 'csam'),
    (re.compile(r'\bhow\s+to\s+(make|build|synthesize)\s+(a\s+)?(bomb|nerve\s+agent|sarin|ricin|anthrax)\b', re.I), 'violence'),
    (re.compile(r'\bbomb\s+(school|hospital|airport|mosque|church)\b', re.I), 'violence'),
    (re.compile(r'\bcredit\s+card\s+number\s+(generator|valid|test)\b', re.I), 'fraud'),
]

# Common direct prompt-injection markers that should always be stripped /
# refused (prevents jailbreaks via copy-paste of attacker text).
_INJECTION_PATTERNS = [
    re.compile(r'ignore\s+(all\s+)?previous\s+instructions', re.I),
    re.compile(r'disregard\s+the\s+system\s+prompt', re.I),
    re.compile(r'developer\s+mode\s+enabled', re.I),
]


def heuristic_check(text: str) -> ModerationResult:
    if not text:
        return ModerationResult(flagged=False)
    for pattern, category in _BLOCKED_PATTERNS:
        if pattern.search(text):
            return ModerationResult(flagged=True, category=category, detail='heuristic_match')
    return ModerationResult(flagged=False)


def detect_prompt_injection(text: str) -> bool:
    return any(p.search(text or '') for p in _INJECTION_PATTERNS)


def _openai_moderation(text: str) -> Optional[ModerationResult]:
    if not getattr(settings, 'OPENAI_API_KEY', ''):
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        result = client.moderations.create(model='omni-moderation-latest', input=text)
        flagged = bool(result.results and result.results[0].flagged)
        if flagged:
            categories = [k for k, v in result.results[0].categories.model_dump().items() if v]
            return ModerationResult(flagged=True, category=','.join(categories), detail='openai_moderation')
        return ModerationResult(flagged=False)
    except Exception as exc:  # pragma: no cover - external API
        logger.warning('OpenAI moderation failed (fail-open): %s', exc)
        return None


def moderate_input(text: str) -> ModerationResult:
    """Run all configured checks. Returns the first ``flagged`` result, else
    a clean result.
    """
    if not getattr(settings, 'AGENTS_ENABLE_MODERATION', True):
        return ModerationResult(flagged=False)

    h = heuristic_check(text)
    if h.flagged:
        return h

    o = _openai_moderation(text)
    if o is not None and o.flagged:
        return o

    return ModerationResult(flagged=False)
