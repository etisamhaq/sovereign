"""HTTP views for the streaming chat-runtime surface.

Mounted under ``/api/agents/chat/`` (see :mod:`agents.chat_urls`) so they live
side-by-side with HEAD's enterprise control plane (workspaces, templates,
runs, marketplace, …) without colliding on path names like ``runs/`` or
``tools/``.

Every endpoint here is JWT-authenticated. Throttles + per-user run quotas
defend against abuse; nginx adds an outer per-IP rate limit.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterator

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .chat_serializers import (
    AgentRunDetailSerializer,
    AgentRunListSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    ConversationWriteSerializer,
    OutputRatingSerializer,
    WorkflowRunListSerializer,
    WorkflowSerializer,
)
from .models import (
    AgentRun,
    Conversation,
    Message,
    OutputRating,
    Workflow,
    WorkflowRun,
)
from .permissions import IsConversationOwner, IsRunOwner
from .registry import registry
from .services.runner import AgentRunner
from .services.streaming import HeartbeatStream, safe_event_stream, sse_response
from .services.workflow_runner import WorkflowRunner, sync_builtin_workflows
from .throttles import AgentChatThrottle, WorkflowRunThrottle

logger = logging.getLogger(__name__)

# Truncate long titles auto-derived from a user message.
_AUTO_TITLE_MAX = 80


def _is_pro(user) -> bool:
    return bool(getattr(user, 'is_pro', False)) or bool(getattr(user, 'is_staff', False))


# ─── Conversations ────────────────────────────────────────────────────────


class ConversationListCreateView(generics.ListCreateAPIView):
    """List the caller's conversations and create new ones explicitly.

    Most clients let the streaming endpoint auto-create on first message;
    this view exists for the rare case where a UI wants an empty thread up
    front (e.g. the "New chat" button).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        archived = self.request.query_params.get('archived', 'false').lower() == 'true'
        qs = Conversation.objects.filter(user=self.request.user)
        if archived:
            qs = qs.exclude(archived_at__isnull=True)
        else:
            qs = qs.filter(archived_at__isnull=True)
        return qs.annotate(message_count=Count('messages')).order_by('-updated_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ConversationWriteSerializer
        return ConversationListSerializer

    def create(self, request, *args, **kwargs):
        serializer = ConversationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conv = Conversation.objects.create(
            user=request.user,
            title=serializer.validated_data.get('title', '') or 'New chat',
        )
        return Response(ConversationListSerializer(conv).data, status=status.HTTP_201_CREATED)


class ConversationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / rename / archive / delete a conversation."""

    permission_classes = [permissions.IsAuthenticated, IsConversationOwner]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user).prefetch_related('messages')

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return ConversationWriteSerializer
        return ConversationDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = ConversationWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ConversationListSerializer(instance).data)


class ConversationRunsView(generics.ListAPIView):
    """List the runs that happened inside one conversation."""

    serializer_class = AgentRunListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        conv = get_object_or_404(
            Conversation, id=self.kwargs['conversation_id'], user=self.request.user,
        )
        return conv.runs.all().order_by('-started_at')


# ─── Runs (audit trail) ───────────────────────────────────────────────────


class RunListView(generics.ListAPIView):
    serializer_class = AgentRunListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AgentRun.objects.filter(user=self.request.user).order_by('-started_at')


class RunDetailView(generics.RetrieveAPIView):
    serializer_class = AgentRunDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsRunOwner]

    def get_queryset(self):
        return AgentRun.objects.filter(user=self.request.user).prefetch_related('steps')


# ─── Tool catalogue ───────────────────────────────────────────────────────


class ToolCatalogueView(APIView):
    """Return every registered chat-runtime tool, with per-user availability.

    This is *not* the same as the enterprise ``/agents/tools/`` endpoint; that
    one serves :class:`AgentTool` model rows tied to workspaces. Here we
    expose the in-process function-calling registry consumed by the planner.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        is_pro = _is_pro(request.user)
        tools = []
        for tool in registry.all():
            tools.append({
                'name': tool.name,
                'description': tool.description,
                'category': tool.category,
                'is_premium': tool.is_premium,
                'parameters': tool.parameters,
                'available': bool(is_pro or not tool.is_premium),
            })
        # Sort by category then name for stable UI rendering.
        tools.sort(key=lambda t: (t['category'], t['name']))
        return Response({'tools': tools, 'total': len(tools)})


# ─── Workflows ────────────────────────────────────────────────────────────


class WorkflowListView(generics.ListAPIView):
    """List built-in + user-owned workflows visible to the caller."""

    serializer_class = WorkflowSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Lazily sync the YAML files into the DB on first call so a fresh
        # deploy doesn't require a manual migration step.
        try:
            if not Workflow.objects.filter(is_builtin=True).exists():
                sync_builtin_workflows()
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning('Failed to sync built-in workflows: %s', exc)
        from django.db.models import Q

        qs = Workflow.objects.filter(is_active=True).filter(
            Q(is_builtin=True) | Q(owner=self.request.user),
        )
        return qs.order_by('name')


class WorkflowDetailView(generics.RetrieveAPIView):
    serializer_class = WorkflowSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'slug'

    def get_queryset(self):
        from django.db.models import Q

        return Workflow.objects.filter(is_active=True).filter(
            Q(is_builtin=True) | Q(owner=self.request.user),
        )


class WorkflowRunListView(generics.ListAPIView):
    serializer_class = WorkflowRunListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkflowRun.objects.filter(user=self.request.user).select_related('workflow').order_by('-started_at')


class WorkflowRunDetailView(generics.RetrieveAPIView):
    serializer_class = WorkflowRunListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkflowRun.objects.filter(user=self.request.user).select_related('workflow')


# ─── Ratings ──────────────────────────────────────────────────────────────


class RatingListCreateView(generics.ListCreateAPIView):
    """Upsert a thumbs-up/down on an assistant message.

    A user can flip their rating but never duplicates it: ``unique_together
    (user, message)`` is enforced by the model.
    """

    serializer_class = OutputRatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return OutputRating.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        ser = OutputRatingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message: Message = ser.validated_data['message']
        if message.role != 'assistant':
            return Response(
                {'detail': 'Only assistant messages can be rated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Owner check: must be a message in one of the user's own conversations.
        if message.conversation.user_id != request.user.id:
            return Response({'detail': 'Not your message.'}, status=status.HTTP_403_FORBIDDEN)

        rating, _ = OutputRating.objects.update_or_create(
            user=request.user, message=message,
            defaults={
                'rating': ser.validated_data['rating'],
                'comment': ser.validated_data.get('comment', '') or '',
            },
        )
        return Response(OutputRatingSerializer(rating).data, status=status.HTTP_201_CREATED)


# ─── Streaming endpoints ──────────────────────────────────────────────────


class _StreamMixin:
    """Common helpers for SSE endpoints."""

    @staticmethod
    def _wrap(events: Iterator[Dict[str, Any]]):
        # ``safe_event_stream`` converts {type, data} dicts into proper SSE
        # frames and turns mid-stream exceptions into a final ``error`` frame.
        return HeartbeatStream(safe_event_stream(lambda: events))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AgentChatThrottle])
def stream_chat(request):
    """Run one user turn against the agent and stream events as SSE.

    Body: ``{"message": str, "conversation_id"?: str, "title"?: str}``

    Returns a ``text/event-stream`` response. A ``conversation`` event is
    emitted first so the client can persist the canonical conversation id.
    """
    data = request.data or {}
    message = (data.get('message') or '').strip()
    conversation_id = data.get('conversation_id')
    title = (data.get('title') or '').strip()

    if not message:
        return Response({'detail': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user

    # Resolve / create the conversation up-front so the first SSE frame has
    # a stable id even when the stream errors mid-flight.
    if conversation_id:
        conv = get_object_or_404(Conversation, id=conversation_id, user=user)
    else:
        conv = Conversation.objects.create(
            user=user, title=title or message[:_AUTO_TITLE_MAX],
        )

    runner = AgentRunner()

    def builder() -> Iterator[Dict[str, Any]]:
        yield {'type': 'conversation', 'data': {
            'id': str(conv.id), 'title': conv.title,
        }}
        yield from runner.run(
            user=user, conversation=conv, user_message=message, stream=True,
        )

    response = sse_response(
        HeartbeatStream(safe_event_stream(builder)),
        request=request,
    )
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([WorkflowRunThrottle])
def stream_workflow(request, slug):
    """Run a YAML workflow and stream progress events as SSE.

    Body: ``{"inputs": {...}}``
    """
    data = request.data or {}
    inputs = data.get('inputs') or {}
    if not isinstance(inputs, dict):
        return Response(
            {'detail': 'inputs must be an object'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    workflow = get_object_or_404(Workflow, slug=slug, is_active=True)
    if workflow.is_premium and not _is_pro(request.user):
        return Response(
            {'detail': 'This workflow requires a Pro subscription.'},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    # User-owned workflows must be visible to the caller.
    if not workflow.is_builtin and workflow.owner_id and workflow.owner_id != request.user.id:
        return Response({'detail': 'Workflow not found.'}, status=status.HTTP_404_NOT_FOUND)

    runner = WorkflowRunner()

    def builder() -> Iterator[Dict[str, Any]]:
        yield from runner.run(workflow=workflow, user=request.user, inputs=inputs)

    return sse_response(
        HeartbeatStream(safe_event_stream(builder)),
        request=request,
    )
