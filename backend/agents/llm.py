"""
Multi-provider LLM abstraction.

Goals
-----
- One interface for chat completions across providers (Groq today,
  OpenAI / Anthropic / Ollama as fallbacks). Adding a provider is a
  one-class change.
- Tool calling parity. The runner uses the OpenAI-compatible
  ``messages + tools + tool_choice`` schema; each provider adapts to it.
- Predictable failure modes. ``LLMError`` is the only exception propagated
  to the runner; failures cascade through the configured fallback chain.

The default provider is selected via ``settings.AGENTS_DEFAULT_PROVIDER``
and the ordered fallback chain via ``settings.AGENTS_FALLBACK_PROVIDERS``.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence

from django.conf import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when no provider in the chain can serve a request."""


# ─── Cost table (USD per 1K tokens) ───────────────────────────────────────
# Source: provider pricing pages as of 2026-04. Conservative estimates; the
# important property is *consistency* rather than perfect accuracy. Update via
# settings if you negotiate enterprise pricing.
_COST_TABLE: Dict[str, Dict[str, Dict[str, Decimal]]] = {
    'groq': {
        'llama-3.3-70b-versatile':       {'input': Decimal('0.00059'), 'output': Decimal('0.00079')},
        'llama-3.1-70b-versatile':       {'input': Decimal('0.00059'), 'output': Decimal('0.00079')},
        'llama-3.1-8b-instant':          {'input': Decimal('0.00005'), 'output': Decimal('0.00008')},
        'mixtral-8x7b-32768':            {'input': Decimal('0.00024'), 'output': Decimal('0.00024')},
        '__default__':                   {'input': Decimal('0.0006'),  'output': Decimal('0.0008')},
    },
    'openai': {
        'gpt-4o':                        {'input': Decimal('0.0025'),  'output': Decimal('0.01')},
        'gpt-4o-mini':                   {'input': Decimal('0.00015'), 'output': Decimal('0.0006')},
        '__default__':                   {'input': Decimal('0.001'),   'output': Decimal('0.003')},
    },
    'anthropic': {
        'claude-3-5-sonnet-latest':      {'input': Decimal('0.003'),   'output': Decimal('0.015')},
        'claude-3-5-haiku-latest':       {'input': Decimal('0.0008'),  'output': Decimal('0.004')},
        '__default__':                   {'input': Decimal('0.003'),   'output': Decimal('0.015')},
    },
    'ollama': {
        '__default__':                   {'input': Decimal('0'),       'output': Decimal('0')},
    },
}


def estimate_cost_usd(provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
    table = _COST_TABLE.get(provider, {})
    rates = table.get(model) or table.get('__default__') or {'input': Decimal('0'), 'output': Decimal('0')}
    return (
        rates['input'] * Decimal(prompt_tokens) / Decimal(1000)
        + rates['output'] * Decimal(completion_tokens) / Decimal(1000)
    )


# ─── Result types ────────────────────────────────────────────────────────


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'type': 'function',
            'function': {'name': self.name, 'arguments': json.dumps(self.arguments)},
        }


@dataclass
class LLMResponse:
    """Result of a non-streaming chat call."""

    content: str = ''
    tool_calls: List[ToolCall] = field(default_factory=list)
    finish_reason: str = 'stop'
    prompt_tokens: int = 0
    completion_tokens: int = 0
    provider: str = ''
    model: str = ''

    @property
    def cost_usd(self) -> Decimal:
        return estimate_cost_usd(self.provider, self.model, self.prompt_tokens, self.completion_tokens)


@dataclass
class LLMStreamEvent:
    """One event from a streaming response.

    ``delta`` carries the incremental token chunk for ``content`` events.
    Tool-call deltas are aggregated by the runner from the raw provider
    stream and emitted as a final ``tool_calls`` event when the model has
    finished generating them.
    """

    type: str  # 'delta' | 'tool_calls' | 'usage' | 'done' | 'error'
    delta: str = ''
    tool_calls: List[ToolCall] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    finish_reason: str = ''
    error: str = ''


# ─── Provider interface ──────────────────────────────────────────────────


class BaseLLMProvider:
    """Interface every provider must implement.

    Implementations are responsible only for the *protocol*; the runner
    handles persistence, accounting and retries.
    """

    name: str = ''
    default_model: str = ''

    def is_configured(self) -> bool:
        raise NotImplementedError

    def chat(
        self,
        *,
        messages: Sequence[Dict[str, Any]],
        tools: Optional[Sequence[Dict[str, Any]]] = None,
        tool_choice: str = 'auto',
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: Optional[str] = None,
    ) -> LLMResponse:
        raise NotImplementedError

    def stream_chat(
        self,
        *,
        messages: Sequence[Dict[str, Any]],
        tools: Optional[Sequence[Dict[str, Any]]] = None,
        tool_choice: str = 'auto',
        temperature: float = 0.7,
        max_tokens: int = 2048,
        model: Optional[str] = None,
    ) -> Iterator[LLMStreamEvent]:
        # Default: synthesize a stream from a non-streaming response.
        result = self.chat(
            messages=messages, tools=tools, tool_choice=tool_choice,
            temperature=temperature, max_tokens=max_tokens, model=model,
        )
        if result.content:
            yield LLMStreamEvent(type='delta', delta=result.content)
        if result.tool_calls:
            yield LLMStreamEvent(type='tool_calls', tool_calls=result.tool_calls)
        yield LLMStreamEvent(
            type='usage',
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
        )
        yield LLMStreamEvent(type='done', finish_reason=result.finish_reason)


# ─── Groq ────────────────────────────────────────────────────────────────


class GroqProvider(BaseLLMProvider):
    name = 'groq'

    def __init__(self) -> None:
        from .pool import get_groq_pool

        self._pool = get_groq_pool()
        self.default_model = getattr(settings, 'AGENTS_PLANNER_MODEL', 'llama-3.3-70b-versatile')

    def is_configured(self) -> bool:
        return bool(getattr(settings, 'GROQ_API_KEY', None))

    def _kwargs(self, *, messages, tools, tool_choice, temperature, max_tokens, model, stream=False):
        kwargs: Dict[str, Any] = {
            'model': model or self.default_model,
            'messages': list(messages),
            'temperature': temperature,
            'max_tokens': max_tokens,
        }
        if tools:
            kwargs['tools'] = list(tools)
            kwargs['tool_choice'] = tool_choice
        if stream:
            kwargs['stream'] = True
        return kwargs

    def chat(self, **kwargs) -> LLMResponse:
        params = self._kwargs(**kwargs)

        def _execute(client):
            return client.chat.completions.create(**params)

        completion = self._pool.execute(_execute)
        choice = completion.choices[0]
        msg = choice.message
        tool_calls: List[ToolCall] = []
        for tc in (getattr(msg, 'tool_calls', None) or []):
            try:
                args = json.loads(tc.function.arguments) if tc.function.arguments else {}
            except json.JSONDecodeError:
                args = {'__raw__': tc.function.arguments}
            tool_calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))
        usage = getattr(completion, 'usage', None)
        return LLMResponse(
            content=msg.content or '',
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or 'stop',
            prompt_tokens=getattr(usage, 'prompt_tokens', 0) or 0,
            completion_tokens=getattr(usage, 'completion_tokens', 0) or 0,
            provider=self.name,
            model=params['model'],
        )

    def stream_chat(self, **kwargs) -> Iterator[LLMStreamEvent]:
        params = self._kwargs(stream=True, **kwargs)

        def _execute(client):
            return client.chat.completions.create(**params)

        stream = self._pool.execute(_execute)

        # Aggregate streamed tool-call deltas keyed by index.
        tool_buffer: Dict[int, Dict[str, Any]] = {}
        prompt_tokens = 0
        completion_tokens = 0
        finish_reason = ''

        for chunk in stream:
            try:
                delta = chunk.choices[0].delta
            except (AttributeError, IndexError):
                continue
            if getattr(delta, 'content', None):
                yield LLMStreamEvent(type='delta', delta=delta.content)
            for tc in (getattr(delta, 'tool_calls', None) or []):
                buf = tool_buffer.setdefault(tc.index, {'id': '', 'name': '', 'arguments': ''})
                if getattr(tc, 'id', None):
                    buf['id'] = tc.id
                fn = getattr(tc, 'function', None)
                if fn:
                    if getattr(fn, 'name', None):
                        buf['name'] = fn.name
                    if getattr(fn, 'arguments', None):
                        buf['arguments'] += fn.arguments
            fr = getattr(chunk.choices[0], 'finish_reason', None)
            if fr:
                finish_reason = fr
            usage = getattr(chunk, 'usage', None)
            if usage:
                prompt_tokens = getattr(usage, 'prompt_tokens', prompt_tokens) or prompt_tokens
                completion_tokens = getattr(usage, 'completion_tokens', completion_tokens) or completion_tokens

        if tool_buffer:
            calls: List[ToolCall] = []
            for entry in tool_buffer.values():
                try:
                    arguments = json.loads(entry['arguments']) if entry['arguments'] else {}
                except json.JSONDecodeError:
                    arguments = {'__raw__': entry['arguments']}
                calls.append(ToolCall(id=entry['id'], name=entry['name'], arguments=arguments))
            yield LLMStreamEvent(type='tool_calls', tool_calls=calls)

        yield LLMStreamEvent(
            type='usage',
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        yield LLMStreamEvent(type='done', finish_reason=finish_reason or 'stop')


# ─── OpenAI ──────────────────────────────────────────────────────────────


class OpenAIProvider(BaseLLMProvider):
    name = 'openai'

    def __init__(self) -> None:
        self.default_model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
        self._client = None
        if self.is_configured():
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as exc:  # pragma: no cover - SDK optional
                logger.info('OpenAI SDK unavailable: %s', exc)

    def is_configured(self) -> bool:
        return bool(getattr(settings, 'OPENAI_API_KEY', ''))

    def chat(self, **kwargs) -> LLMResponse:
        if self._client is None:
            raise LLMError('OpenAI provider not configured')
        model = kwargs.get('model') or self.default_model
        payload = {
            'model': model,
            'messages': list(kwargs['messages']),
            'temperature': kwargs.get('temperature', 0.7),
            'max_tokens': kwargs.get('max_tokens', 2048),
        }
        if kwargs.get('tools'):
            payload['tools'] = list(kwargs['tools'])
            payload['tool_choice'] = kwargs.get('tool_choice', 'auto')
        completion = self._client.chat.completions.create(**payload)
        choice = completion.choices[0]
        msg = choice.message
        tool_calls: List[ToolCall] = []
        for tc in (getattr(msg, 'tool_calls', None) or []):
            try:
                args = json.loads(tc.function.arguments) if tc.function.arguments else {}
            except json.JSONDecodeError:
                args = {'__raw__': tc.function.arguments}
            tool_calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))
        usage = getattr(completion, 'usage', None)
        return LLMResponse(
            content=msg.content or '',
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or 'stop',
            prompt_tokens=getattr(usage, 'prompt_tokens', 0) or 0,
            completion_tokens=getattr(usage, 'completion_tokens', 0) or 0,
            provider=self.name,
            model=model,
        )


# ─── Anthropic ───────────────────────────────────────────────────────────


class AnthropicProvider(BaseLLMProvider):
    name = 'anthropic'

    def __init__(self) -> None:
        self.default_model = getattr(settings, 'ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest')
        self._client = None
        if self.is_configured():
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            except Exception as exc:  # pragma: no cover - SDK optional
                logger.info('Anthropic SDK unavailable: %s', exc)

    def is_configured(self) -> bool:
        return bool(getattr(settings, 'ANTHROPIC_API_KEY', ''))

    def _convert_messages(self, messages: Sequence[Dict[str, Any]]) -> tuple[Optional[str], List[Dict[str, Any]]]:
        """Anthropic uses a top-level system + role=user/assistant scheme."""
        system_parts: List[str] = []
        out: List[Dict[str, Any]] = []
        for m in messages:
            if m['role'] == 'system':
                system_parts.append(m.get('content') or '')
            elif m['role'] == 'tool':
                out.append({
                    'role': 'user',
                    'content': [{
                        'type': 'tool_result',
                        'tool_use_id': m.get('tool_call_id'),
                        'content': m.get('content', ''),
                    }],
                })
            else:
                out.append({'role': m['role'], 'content': m.get('content') or ''})
        return ('\n\n'.join(s for s in system_parts if s) or None, out)

    def chat(self, **kwargs) -> LLMResponse:
        if self._client is None:
            raise LLMError('Anthropic provider not configured')
        model = kwargs.get('model') or self.default_model
        system, messages = self._convert_messages(kwargs['messages'])
        params: Dict[str, Any] = {
            'model': model,
            'messages': messages,
            'max_tokens': kwargs.get('max_tokens', 2048),
            'temperature': kwargs.get('temperature', 0.7),
        }
        if system:
            params['system'] = system
        if kwargs.get('tools'):
            params['tools'] = [
                {'name': t['function']['name'], 'description': t['function']['description'],
                 'input_schema': t['function']['parameters']}
                for t in kwargs['tools']
            ]
        result = self._client.messages.create(**params)
        text_chunks: List[str] = []
        tool_calls: List[ToolCall] = []
        for block in result.content:
            if block.type == 'text':
                text_chunks.append(block.text)
            elif block.type == 'tool_use':
                tool_calls.append(ToolCall(id=block.id, name=block.name, arguments=block.input or {}))
        usage = getattr(result, 'usage', None)
        return LLMResponse(
            content='\n'.join(text_chunks),
            tool_calls=tool_calls,
            finish_reason=getattr(result, 'stop_reason', 'stop') or 'stop',
            prompt_tokens=getattr(usage, 'input_tokens', 0) or 0,
            completion_tokens=getattr(usage, 'output_tokens', 0) or 0,
            provider=self.name,
            model=model,
        )


# ─── Ollama (local fallback) ─────────────────────────────────────────────


class OllamaProvider(BaseLLMProvider):
    name = 'ollama'

    def __init__(self) -> None:
        self.default_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.1:8b')
        self.base_url = getattr(settings, 'OLLAMA_BASE_URL', '') or ''

    def is_configured(self) -> bool:
        return bool(self.base_url)

    def chat(self, **kwargs) -> LLMResponse:
        if not self.is_configured():
            raise LLMError('Ollama provider not configured')
        import requests  # already in requirements

        model = kwargs.get('model') or self.default_model
        payload: Dict[str, Any] = {
            'model': model,
            'messages': list(kwargs['messages']),
            'options': {
                'temperature': kwargs.get('temperature', 0.7),
                'num_predict': kwargs.get('max_tokens', 2048),
            },
            'stream': False,
        }
        if kwargs.get('tools'):
            payload['tools'] = list(kwargs['tools'])
        url = self.base_url.rstrip('/') + '/api/chat'
        try:
            r = requests.post(url, json=payload, timeout=getattr(settings, 'AI_TIMEOUT', 60))
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            raise LLMError(f'Ollama request failed: {exc}') from exc
        msg = data.get('message') or {}
        tool_calls: List[ToolCall] = []
        for tc in msg.get('tool_calls') or []:
            fn = tc.get('function') or {}
            tool_calls.append(ToolCall(
                id=tc.get('id') or f'ollama_{len(tool_calls)}',
                name=fn.get('name') or '',
                arguments=fn.get('arguments') or {},
            ))
        return LLMResponse(
            content=msg.get('content') or '',
            tool_calls=tool_calls,
            finish_reason=data.get('done_reason') or 'stop',
            prompt_tokens=int(data.get('prompt_eval_count') or 0),
            completion_tokens=int(data.get('eval_count') or 0),
            provider=self.name,
            model=model,
        )


# ─── Router with fallback chain ──────────────────────────────────────────


_PROVIDER_CLASSES: Dict[str, type] = {
    'groq': GroqProvider,
    'openai': OpenAIProvider,
    'anthropic': AnthropicProvider,
    'ollama': OllamaProvider,
}


class LLMRouter:
    """Tries each provider in order and falls back on transient failures.

    The router does *not* retry the same provider — each provider is
    expected to handle its own retries (Groq does so via the api-key pool).
    """

    def __init__(self, chain: Optional[Iterable[str]] = None) -> None:
        self._cache: Dict[str, BaseLLMProvider] = {}
        if chain is None:
            default = getattr(settings, 'AGENTS_DEFAULT_PROVIDER', 'groq')
            fallback = getattr(settings, 'AGENTS_FALLBACK_PROVIDERS', ['groq']) or ['groq']
            ordered: List[str] = []
            for name in [default, *fallback]:
                if name and name not in ordered:
                    ordered.append(name)
            chain = ordered
        self.chain = list(chain)

    def _provider(self, name: str) -> BaseLLMProvider:
        if name not in self._cache:
            cls = _PROVIDER_CLASSES.get(name)
            if cls is None:
                raise LLMError(f'Unknown provider: {name}')
            self._cache[name] = cls()
        return self._cache[name]

    def configured_chain(self) -> List[BaseLLMProvider]:
        return [self._provider(n) for n in self.chain if self._provider(n).is_configured()]

    def chat(self, **kwargs) -> LLMResponse:
        last_exc: Optional[Exception] = None
        chain = self.configured_chain()
        if not chain:
            raise LLMError('No LLM providers are configured')
        for provider in chain:
            try:
                t0 = time.monotonic()
                res = provider.chat(**kwargs)
                logger.info(
                    'LLM chat ok provider=%s model=%s ms=%d',
                    provider.name, res.model, int((time.monotonic() - t0) * 1000),
                )
                return res
            except Exception as exc:
                logger.warning('LLM provider %s failed: %s', provider.name, exc)
                last_exc = exc
        raise LLMError(f'All LLM providers failed: {last_exc}')

    def stream_chat(self, **kwargs) -> Iterator[LLMStreamEvent]:
        chain = self.configured_chain()
        if not chain:
            raise LLMError('No LLM providers are configured')
        last_exc: Optional[Exception] = None
        for provider in chain:
            try:
                yield from provider.stream_chat(**kwargs)
                return
            except Exception as exc:
                logger.warning('LLM stream provider %s failed: %s', provider.name, exc)
                last_exc = exc
                # Restart on next provider — but only if we haven't yielded yet.
                # We can't safely retry mid-stream, so the caller sees an error event.
                yield LLMStreamEvent(type='error', error=str(exc))
                return
        raise LLMError(f'All LLM providers failed: {last_exc}')


_router: Optional[LLMRouter] = None


def get_router() -> LLMRouter:
    global _router
    if _router is None:
        _router = LLMRouter()
    return _router


def reset_router() -> None:
    """Used in tests to pick up settings changes."""
    global _router
    _router = None
