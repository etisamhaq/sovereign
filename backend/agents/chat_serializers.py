"""DRF serializers for the chat-runtime surface.

Kept in their own module (instead of stuffed into the main ``serializers.py``)
so the enterprise control-plane serializers and the chat-runtime serializers
can evolve independently.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import (
    AgentRun,
    AgentRunStep,
    Conversation,
    Message,
    OutputRating,
    Workflow,
    WorkflowRun,
)


class MessageSerializer(serializers.ModelSerializer):
    is_archived = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'role', 'content', 'tool_calls',
            'tool_call_id', 'tool_name', 'is_error',
            'prompt_tokens', 'completion_tokens', 'cost_usd',
            'provider', 'model', 'is_archived', 'created_at',
        ]
        read_only_fields = fields

    def get_is_archived(self, obj):
        return False  # Messages aren't individually archivable yet.


class ConversationListSerializer(serializers.ModelSerializer):
    is_archived = serializers.SerializerMethodField()
    message_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'is_archived', 'message_count',
            'last_message_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at']

    def get_is_archived(self, obj):
        return obj.archived_at is not None


class ConversationDetailSerializer(ConversationListSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ['messages']


class ConversationWriteSerializer(serializers.ModelSerializer):
    """For create / partial-update.

    ``is_archived`` is exposed as a write-only boolean that toggles
    ``archived_at`` server-side.
    """

    is_archived = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Conversation
        fields = ['title', 'is_archived']

    def update(self, instance, validated_data):
        from django.utils import timezone

        archived = validated_data.pop('is_archived', None)
        if archived is True and instance.archived_at is None:
            instance.archived_at = timezone.now()
        elif archived is False:
            instance.archived_at = None
        return super().update(instance, validated_data)


class AgentRunStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRunStep
        fields = [
            'id', 'index', 'kind', 'tool_name', 'payload',
            'duration_ms', 'is_error', 'created_at',
        ]
        read_only_fields = fields


class AgentRunListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRun
        fields = [
            'id', 'conversation', 'status', 'user_input', 'final_output',
            'total_steps', 'total_prompt_tokens', 'total_completion_tokens',
            'total_cost_usd', 'provider', 'model',
            'started_at', 'finished_at', 'error_message',
        ]
        read_only_fields = fields


class AgentRunDetailSerializer(AgentRunListSerializer):
    steps = AgentRunStepSerializer(many=True, read_only=True)

    class Meta(AgentRunListSerializer.Meta):
        fields = AgentRunListSerializer.Meta.fields + ['steps']


class WorkflowSerializer(serializers.ModelSerializer):
    """Read serializer that flattens the YAML spec into UI-friendly fields."""

    inputs_schema = serializers.SerializerMethodField()
    steps = serializers.SerializerMethodField()
    output_template = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = Workflow
        fields = [
            'id', 'slug', 'name', 'description',
            'is_premium', 'is_builtin', 'is_active',
            'category', 'inputs_schema', 'steps', 'output_template',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_inputs_schema(self, obj):
        return (obj.spec or {}).get('inputs') or {}

    def get_steps(self, obj):
        return (obj.spec or {}).get('steps') or []

    def get_output_template(self, obj):
        return (obj.spec or {}).get('output')

    def get_category(self, obj):
        return (obj.spec or {}).get('category', 'general')


class WorkflowRunListSerializer(serializers.ModelSerializer):
    workflow_slug = serializers.CharField(source='workflow.slug', read_only=True)
    final_output = serializers.SerializerMethodField()
    total_cost_usd = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowRun
        fields = [
            'id', 'workflow', 'workflow_slug', 'status',
            'inputs', 'outputs', 'final_output', 'total_cost_usd',
            'current_step', 'progress', 'started_at', 'finished_at',
            'error_message',
        ]
        read_only_fields = fields

    def get_final_output(self, obj):
        out = obj.outputs or {}
        if isinstance(out, dict) and 'final' in out:
            value = out['final']
            return value if isinstance(value, str) else (value or '')
        return ''

    def get_total_cost_usd(self, obj):
        # Workflow runs don't currently track cost — placeholder for parity
        # with AgentRun's total_cost_usd field on the frontend.
        return '0'


class OutputRatingSerializer(serializers.ModelSerializer):
    """Persists a thumbs-up/down on an assistant message.

    The ``message`` FK is required and is enforced to belong to the calling
    user via the view's ``perform_create``.
    """

    class Meta:
        model = OutputRating
        fields = ['id', 'message', 'rating', 'comment', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if value not in (-1, 1):
            raise serializers.ValidationError('rating must be -1 or 1')
        return value
