"""
Global registry of agent tools.

A *tool* is anything the planner can call by name with structured arguments.
We deliberately keep the data model small and decoupled from Django models so
tools can be registered from anywhere (including third-party plugins later).

Each tool exposes:

- ``name``        — unique snake_case identifier passed to the LLM.
- ``description`` — human-readable + LLM-readable purpose statement.
- ``parameters``  — JSON Schema describing the arguments object.
- ``handler``     — Python callable executed by the runner.
- ``category``    — used for grouping in the UI.
- ``is_premium``  — whether the tool requires a Pro subscription.
- ``timeout_s``   — per-call timeout (default 60s).

The registry is lock-protected so registration can happen during app boot
from multiple gunicorn workers without races.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional


@dataclass(frozen=True)
class ToolContext:
    """Runtime context passed to every tool handler.

    Handlers should never reach for global state — everything they need to
    serve a request is in this immutable object.
    """

    user: Any  # auth User instance, or None for system runs
    conversation_id: Optional[str] = None
    run_id: Optional[str] = None
    request_id: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentTool:
    name: str
    description: str
    parameters: Dict[str, Any]
    handler: Callable[..., Any]
    category: str = 'general'
    is_premium: bool = False
    timeout_s: int = 60
    requires_auth: bool = True

    def to_openai_function(self) -> Dict[str, Any]:
        """Render the tool in the OpenAI/Groq function-calling schema."""
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters,
            },
        }


class ToolRegistry:
    """Thread-safe in-process tool registry."""

    def __init__(self) -> None:
        self._tools: Dict[str, AgentTool] = {}
        self._lock = threading.RLock()

    # ─── mutation ─────────────────────────────────────────────────────
    def register(self, tool: AgentTool) -> AgentTool:
        with self._lock:
            self._tools[tool.name] = tool
        return tool

    def unregister(self, name: str) -> None:
        with self._lock:
            self._tools.pop(name, None)

    def clear(self) -> None:
        """Empty the registry — used in tests."""
        with self._lock:
            self._tools.clear()

    # ─── access ───────────────────────────────────────────────────────
    def get(self, name: str) -> Optional[AgentTool]:
        with self._lock:
            return self._tools.get(name)

    def __contains__(self, name: str) -> bool:
        with self._lock:
            return name in self._tools

    def names(self) -> List[str]:
        with self._lock:
            return sorted(self._tools.keys())

    def all(self) -> List[AgentTool]:
        with self._lock:
            return list(self._tools.values())

    def filter(self, *, allow_premium: bool = True, category: Optional[str] = None) -> List[AgentTool]:
        """Return tools matching the gating criteria.

        ``allow_premium=False`` is used for free-tier users.
        """
        with self._lock:
            tools = list(self._tools.values())
        if not allow_premium:
            tools = [t for t in tools if not t.is_premium]
        if category:
            tools = [t for t in tools if t.category == category]
        return tools

    def to_openai_functions(self, *, allow_premium: bool = True) -> List[Dict[str, Any]]:
        return [t.to_openai_function() for t in self.filter(allow_premium=allow_premium)]


# ─── module-level singleton ───────────────────────────────────────────────
registry = ToolRegistry()


def register_tool(
    name: str,
    description: str,
    parameters: Dict[str, Any],
    *,
    category: str = 'general',
    is_premium: bool = False,
    timeout_s: int = 60,
    requires_auth: bool = True,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator for declaring a new tool.

    Example::

        @register_tool(
            name='paraphrase_text',
            description='Rewrite text in a given style.',
            parameters={...},
            category='writing',
        )
        def paraphrase(text: str, mode: str = 'standard', *, ctx: ToolContext) -> str:
            ...
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        tool = AgentTool(
            name=name,
            description=description,
            parameters=parameters,
            handler=func,
            category=category,
            is_premium=is_premium,
            timeout_s=timeout_s,
            requires_auth=requires_auth,
        )
        registry.register(tool)
        func.__agent_tool__ = tool  # type: ignore[attr-defined]
        return func

    return decorator
