"""Shared fixtures for the agents app tests.

Most tests stub out the LLM router with :class:`FakeRouter` so they never
hit a real provider. The fake speaks the same ``LLMResponse`` /
``LLMStreamEvent`` API as the real router and is fully scriptable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, Iterator, List, Optional

import pytest
from django.contrib.auth import get_user_model

from agents.llm import LLMResponse, LLMStreamEvent, ToolCall


@dataclass
class FakeRouterScript:
    """One scripted LLM turn."""

    content: str = ''
    tool_calls: List[ToolCall] = field(default_factory=list)
    prompt_tokens: int = 10
    completion_tokens: int = 10
    finish_reason: str = 'stop'
    error: Optional[str] = None


@dataclass
class FakeRouter:
    """Drop-in replacement for ``agents.llm.LLMRouter``.

    Pop scripts off ``script`` in order. Raises if exhausted.
    """

    script: List[FakeRouterScript] = field(default_factory=list)
    chain: List[str] = field(default_factory=lambda: ['groq'])
    seen_calls: List[Dict[str, Any]] = field(default_factory=list)

    def configured_chain(self) -> List[Any]:
        return [object()]

    def _next(self) -> FakeRouterScript:
        if not self.script:
            raise AssertionError('FakeRouter ran out of scripted turns')
        return self.script.pop(0)

    def chat(self, **kwargs) -> LLMResponse:
        self.seen_calls.append(kwargs)
        s = self._next()
        if s.error:
            from agents.llm import LLMError
            raise LLMError(s.error)
        return LLMResponse(
            content=s.content,
            tool_calls=list(s.tool_calls),
            finish_reason=s.finish_reason,
            prompt_tokens=s.prompt_tokens,
            completion_tokens=s.completion_tokens,
            provider='groq',
            model='fake-model',
        )

    def stream_chat(self, **kwargs) -> Iterator[LLMStreamEvent]:
        self.seen_calls.append(kwargs)
        s = self._next()
        if s.error:
            yield LLMStreamEvent(type='error', error=s.error)
            return
        if s.content:
            for ch in s.content:
                yield LLMStreamEvent(type='delta', delta=ch)
        if s.tool_calls:
            yield LLMStreamEvent(type='tool_calls', tool_calls=list(s.tool_calls))
        yield LLMStreamEvent(type='usage', prompt_tokens=s.prompt_tokens, completion_tokens=s.completion_tokens)
        yield LLMStreamEvent(type='done', finish_reason=s.finish_reason)


@pytest.fixture
def fake_router(monkeypatch):
    router = FakeRouter()
    monkeypatch.setattr('agents.services.runner.get_router', lambda: router)
    monkeypatch.setattr('agents.llm.get_router', lambda: router)
    return router


@pytest.fixture
def user(db, django_user_model):
    User = get_user_model()
    return User.objects.create_user(email='alice@example.com', password='pw12345!')


@pytest.fixture
def pro_user(db, django_user_model):
    from datetime import timedelta
    from django.utils import timezone

    User = get_user_model()
    u = User.objects.create_user(email='bob@example.com', password='pw12345!')
    u.subscription_tier = 'pro'
    u.subscription_end_date = timezone.now() + timedelta(days=30)
    u.save()
    return u


@pytest.fixture(autouse=True)
def isolate_registry(request):
    """Snapshot/restore the global tool registry around each test.

    Several tests register ad-hoc tools; we must not leak them into other
    tests because the registry is process-wide.
    """
    from agents.registry import registry

    snapshot = list(registry.all())
    yield
    registry.clear()
    for tool in snapshot:
        registry.register(tool)


@pytest.fixture(autouse=True)
def disable_moderation(monkeypatch):
    """Most tests don't care about the moderation backend — keep it offline."""
    monkeypatch.setattr('agents.services.runner.moderate_input',
                        lambda text: __import__('agents.services.moderation', fromlist=['ModerationResult']).ModerationResult(flagged=False))
