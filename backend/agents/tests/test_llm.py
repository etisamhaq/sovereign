"""Tests for the multi-provider router and cost estimation."""

from __future__ import annotations

from decimal import Decimal

from django.test import override_settings

from agents import llm as llm_module
from agents.llm import LLMError, LLMResponse, LLMRouter, estimate_cost_usd


class _StubProvider:
    """Minimal stand-in implementing the provider interface."""

    def __init__(self, *, name='stub', configured=True, raises=None, response=None):
        self.name = name
        self._configured = configured
        self._raises = raises
        self._response = response or LLMResponse(content='ok', provider=name, model='m')

    def is_configured(self):
        return self._configured

    def chat(self, **kwargs):
        if self._raises:
            raise self._raises
        return self._response

    def stream_chat(self, **kwargs):
        # Minimal compliance — converted into events.
        if self._raises:
            raise self._raises
        from agents.llm import LLMStreamEvent
        yield LLMStreamEvent(type='delta', delta=self._response.content)
        yield LLMStreamEvent(type='done', finish_reason='stop')


def test_estimate_cost_usd_uses_table():
    cost = estimate_cost_usd('groq', 'llama-3.3-70b-versatile', 1000, 1000)
    # Expect (0.00059 + 0.00079)
    assert cost == Decimal('0.00059') + Decimal('0.00079')


def test_estimate_cost_usd_falls_back_to_default():
    cost = estimate_cost_usd('groq', 'never-heard-of-this-model', 1000, 1000)
    assert cost > Decimal('0')


def test_router_falls_back_to_next_provider(monkeypatch):
    primary = _StubProvider(name='groq', raises=RuntimeError('boom'))
    secondary = _StubProvider(name='openai', response=LLMResponse(content='2nd ok', provider='openai', model='gpt'))
    router = LLMRouter(chain=['groq', 'openai'])
    router._cache = {'groq': primary, 'openai': secondary}
    monkeypatch.setattr(router, '_provider', lambda name: router._cache[name])
    res = router.chat(messages=[{'role': 'user', 'content': 'hi'}])
    assert res.content == '2nd ok'
    assert res.provider == 'openai'


def test_router_raises_when_all_fail(monkeypatch):
    primary = _StubProvider(name='groq', raises=RuntimeError('boom'))
    router = LLMRouter(chain=['groq'])
    router._cache = {'groq': primary}
    monkeypatch.setattr(router, '_provider', lambda name: primary)
    import pytest
    with pytest.raises(LLMError):
        router.chat(messages=[{'role': 'user', 'content': 'hi'}])
