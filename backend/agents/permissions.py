"""Permission helpers for the agents API."""

from __future__ import annotations

from rest_framework import permissions


class IsConversationOwner(permissions.BasePermission):
    """Conversation-level access check.

    Staff users can read any conversation; everyone else can only access
    their own. Assumes the view exposes a ``Conversation`` queryset.
    """

    message = 'You do not have access to this conversation.'

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        if request.user.is_staff:
            return True
        return obj.user_id == request.user.id


class IsRunOwner(permissions.BasePermission):
    message = 'You do not have access to this run.'

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        if request.user.is_staff:
            return True
        return obj.user_id == request.user.id


class IsWorkflowAccessible(permissions.BasePermission):
    """Built-in workflows are readable by anyone authenticated; user-owned
    workflows are private."""

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        if request.method in permissions.SAFE_METHODS:
            if obj.is_builtin:
                return True
            return obj.owner_id == request.user.id or request.user.is_staff
        return obj.owner_id == request.user.id or request.user.is_staff
