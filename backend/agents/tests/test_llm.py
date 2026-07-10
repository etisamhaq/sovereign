"""Tests for the multi-provider router and cost estimation."""

from __future__ import annotations

from decimal import Decimal

from django.test import override_settings

from agents import llm as llm_module
from agents.llm import (
    AMDvLLMProvider,
    FireworksProvider,
    LLMError,
    LLMResponse,
    LLMRouter,
    estimate_cost_usd,
)


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


# ── AMD + Fireworks providers (the hackathon delta) ────────────────────────


def test_amd_and_fireworks_are_registered():
    """Both new providers must be resolvable by the router."""
    assert llm_module._PROVIDER_CLASSES['amd'] is AMDvLLMProvider
    assert llm_module._PROVIDER_CLASSES['fireworks'] is FireworksProvider


@override_settings(AMD_VLLM_BASE_URL='')
def test_amd_unconfigured_without_base_url():
    assert AMDvLLMProvider().is_configured() is False


@override_settings(AMD_VLLM_BASE_URL='http://instinct-host:8000/v1', AMD_VLLM_API_KEY='EMPTY')
def test_amd_configured_with_base_url_only():
    """A self-hosted vLLM box needs only a base_url — no real API key."""
    provider = AMDvLLMProvider()
    assert provider.is_configured() is True
    assert provider.base_url == 'http://instinct-host:8000/v1'


@override_settings(FIREWORKS_API_KEY='', FIREWORKS_BASE_URL='https://api.fireworks.ai/inference/v1')
def test_fireworks_requires_api_key():
    assert FireworksProvider().is_configured() is False


@override_settings(FIREWORKS_API_KEY='fw-secret', FIREWORKS_BASE_URL='https://api.fireworks.ai/inference/v1')
def test_fireworks_configured_with_key():
    assert FireworksProvider().is_configured() is True


def test_amd_self_hosted_is_zero_cost():
    """The whole pitch: running on your own AMD GPUs has no per-token cost."""
    assert estimate_cost_usd('amd', 'meta-llama/Llama-3.1-8B-Instruct', 10_000, 10_000) == Decimal('0')


def test_fireworks_cost_uses_table():
    cost = estimate_cost_usd('fireworks', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 1000, 1000)
    assert cost == Decimal('0.0002') + Decimal('0.0002')
