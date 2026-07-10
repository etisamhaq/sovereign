"""DRF throttles for agents endpoints.

These complement the nginx-level rate-limit zones: nginx kills the obvious
abuse, DRF enforces *per-user* fairness once the request reaches Django.
"""

from __future__ import annotations

from rest_framework.throttling import UserRateThrottle


class AgentChatThrottle(UserRateThrottle):
    """Per-user throttle for the streaming chat endpoint."""

    scope = 'agent_chat'


class WorkflowRunThrottle(UserRateThrottle):
    scope = 'agent_workflow'
