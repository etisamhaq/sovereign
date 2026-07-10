"""URL routes for the chat-runtime surface.

Mounted under ``/api/agents/chat/`` from :mod:`agents.urls`. Keeps the chat
runtime endpoints (conversations, runs, streaming, ratings, workflows) cleanly
namespaced so they never collide with HEAD's enterprise control plane.
"""

from django.urls import path

from . import chat_views as v

app_name = 'agents-chat'

urlpatterns = [
    # Conversations
    path('conversations/', v.ConversationListCreateView.as_view(), name='conversation-list'),
    path('conversations/<uuid:pk>/', v.ConversationDetailView.as_view(), name='conversation-detail'),
    path(
        'conversations/<uuid:conversation_id>/runs/',
        v.ConversationRunsView.as_view(),
        name='conversation-runs',
    ),

    # Runs (audit trail of one-turn agent runs)
    path('runs/', v.RunListView.as_view(), name='run-list'),
    path('runs/<uuid:pk>/', v.RunDetailView.as_view(), name='run-detail'),

    # Tool catalogue (function-calling registry, not the marketplace tools)
    path('tools/', v.ToolCatalogueView.as_view(), name='tool-catalogue'),

    # Workflows (YAML pipelines)
    path('workflows/', v.WorkflowListView.as_view(), name='workflow-list'),
    path('workflows/<slug:slug>/', v.WorkflowDetailView.as_view(), name='workflow-detail'),
    path('workflows/<slug:slug>/run/', v.stream_workflow, name='workflow-run'),
    path('workflow-runs/', v.WorkflowRunListView.as_view(), name='workflow-run-list'),
    path('workflow-runs/<uuid:pk>/', v.WorkflowRunDetailView.as_view(), name='workflow-run-detail'),

    # Ratings (thumbs up/down)
    path('ratings/', v.RatingListCreateView.as_view(), name='rating-list'),

    # Streaming (SSE) — long-lived; nginx has a dedicated location block.
    path('stream/', v.stream_chat, name='stream-chat'),
]
