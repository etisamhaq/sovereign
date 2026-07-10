"""App configuration for the agents app.

The ``ready()`` hook registers the chat-runtime tool bindings exactly once
per process. We import the bindings module for its side-effects only — every
``@register_tool`` decorator inserts a new entry into the global
:class:`ToolRegistry`.
"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class AgentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'agents'
    verbose_name = 'AI Agents'

    def ready(self) -> None:  # type: ignore[override]
        # Tool bindings — register the function-calling tools at import time.
        # Wrapped in try/except so an import failure (e.g. during a partial
        # migration where downstream apps aren't ready yet) doesn't kill
        # ``manage.py``.
        try:
            from . import tool_bindings  # noqa: F401
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning('Failed to load agents.tool_bindings: %s', exc)
