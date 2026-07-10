"""
Thin wrapper around the existing ``tools.api_key_manager.GroqClientPool``.

The wrapper exists so that:

1. The agents app does not import the pool at module import time (which can
   trigger Redis connection attempts in test environments).
2. Tests can swap the pool for a fake by calling ``set_groq_pool``.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_pool: Optional[Any] = None


class _Pool:
    """Adapter exposing ``execute(callable)`` to the LLM provider."""

    def __init__(self, inner: Any) -> None:
        self._inner = inner

    def execute(self, func: Callable[[Any], Any]) -> Any:
        # Delegate to the existing retry/circuit-breaker logic in tools.
        return self._inner.execute_with_retry(func)


def get_groq_pool() -> _Pool:
    global _pool
    if _pool is None:
        from tools.api_key_manager import get_client_pool
        _pool = _Pool(get_client_pool())
    return _pool


def set_groq_pool(pool: Any) -> None:
    """Test hook: install a replacement pool that exposes ``execute``."""
    global _pool
    _pool = pool
