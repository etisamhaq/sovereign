from rest_framework import serializers
from .models import (
    AgentWorkspace,
    AgentWorkspaceMembership,
    AgentPolicyRule,
    AgentWorkflowTemplate,
    AgentWorkflowTemplateVersion,
    AgentWorkflowTrigger,
    AgentWorkflowRun,
    AgentWorkflowStepRun,
    AgentWorkflowApproval,
    AgentMemory,
    AgentRunMetric,
    AgentConnectorAccount,
    AgentExternalAction,
    AgentReliabilityAlert,
    AgentOrchestrationJob,
    AgentOrchestrationJobStep,
    AgentMarketplaceListing,
    AgentMarketplacePurchase,
    AgentMarketplaceSettlement,
    AgentWorkspaceSSOProvider,
    AgentWorkspaceAuditEvent,
    AgentTemplateMemoryPolicy,
    AgentTemplateEditLock,
)


class AgentWorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkspace
        fields = [
            'id', 'name', 'slug', 'created_by', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AgentWorkspaceMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = AgentWorkspaceMembership
        fields = [
            'id', 'workspace', 'user', 'user_email', 'role', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AgentPolicyRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentPolicyRule
        fields = [
            'id', 'workspace', 'key', 'value_json', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AgentWorkspaceSSOProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkspaceSSOProvider
        fields = [
            'id', 'workspace', 'name', 'slug', 'provider_type', 'assertion_secret',
            'config_json', 'is_active', 'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AgentWorkspaceAuditEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True)

    class Meta:
        model = AgentWorkspaceAuditEvent
        fields = [
            'id', 'workspace', 'actor', 'actor_email', 'event_type', 'severity',
            'object_type', 'object_id', 'ip_address', 'user_agent', 'metadata_json', 'created_at',
        ]


class AgentTemplateMemoryPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentTemplateMemoryPolicy
        fields = [
            'id', 'template', 'key', 'value_json', 'is_active', 'updated_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['updated_by', 'created_at', 'updated_at']


class AgentTemplateEditLockSerializer(serializers.ModelSerializer):
    locked_by_email = serializers.EmailField(source='locked_by.email', read_only=True)

    class Meta:
        model = AgentTemplateEditLock
        fields = [
            'id', 'template', 'locked_by', 'locked_by_email', 'base_version', 'expires_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['locked_by', 'created_at', 'updated_at']


class AgentWorkflowTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkflowTemplate
        fields = [
            'id', 'name', 'slug', 'description', 'template_type', 'version',
            'definition_json', 'default_config_json', 'is_public', 'is_active', 'workspace',
            'created_at', 'updated_at',
        ]


class AgentWorkflowTemplateCreateSerializer(serializers.ModelSerializer):
    ALLOWED_STEP_TYPES = {'tool', 'llm', 'api_call', 'transform', 'approval'}

    class Meta:
        model = AgentWorkflowTemplate
        fields = [
            'name', 'slug', 'description', 'template_type',
            'definition_json', 'default_config_json', 'is_public', 'is_active', 'workspace',
        ]
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
            'is_public': {'required': False},
            'is_active': {'required': False},
        }

    def validate_definition_json(self, value):
        steps = value.get('steps', []) if isinstance(value, dict) else []
        if not isinstance(steps, list):
            raise serializers.ValidationError('definition_json.steps must be a list.')

        seen = set()
        available_prior_steps = set()
        allowed_providers = {choice[0] for choice in AgentConnectorAccount.PROVIDER_CHOICES}

        for index, step in enumerate(steps):
            if not isinstance(step, dict):
                raise serializers.ValidationError(f'Step {index + 1}: each step must be an object.')

            key = step.get('key')
            if not key:
                raise serializers.ValidationError(f'Step {index + 1}: each step requires a non-empty key.')
            if key in seen:
                raise serializers.ValidationError(f'Duplicate step key: {key}')
            seen.add(key)

            step_type = step.get('type')
            if step_type not in self.ALLOWED_STEP_TYPES:
                raise serializers.ValidationError(
                    f"Step '{key}': unsupported type '{step_type}'. Allowed types: {sorted(self.ALLOWED_STEP_TYPES)}"
                )

            action = step.get('action')
            if not isinstance(action, str) or not action.strip():
                raise serializers.ValidationError(f"Step '{key}': action must be a non-empty string.")

            config = step.get('config', {})
            if config is None:
                config = {}
                step['config'] = config
            if not isinstance(config, dict):
                raise serializers.ValidationError(f"Step '{key}': config must be an object.")

            requires_approval = step.get('requires_approval', False)
            if not isinstance(requires_approval, bool):
                raise serializers.ValidationError(f"Step '{key}': requires_approval must be boolean.")

            input_from = step.get('input_from')
            if input_from is not None:
                if not isinstance(input_from, str):
                    raise serializers.ValidationError(f"Step '{key}': input_from must be a string or null.")
                if input_from.startswith('step:'):
                    source_key = input_from.replace('step:', '', 1)
                    if source_key not in available_prior_steps:
                        raise serializers.ValidationError(
                            f"Step '{key}': input_from references unknown or future step '{source_key}'."
                        )
                elif input_from not in ('previous_output',):
                    raise serializers.ValidationError(
                        f"Step '{key}': input_from must be null, 'previous_output', or 'step:<key>'."
                    )

            if step_type == 'api_call':
                provider = step.get('provider')
                if not isinstance(provider, str) or not provider:
                    raise serializers.ValidationError(f"Step '{key}': api_call steps require provider.")
                if provider not in allowed_providers:
                    raise serializers.ValidationError(
                        f"Step '{key}': provider '{provider}' is not supported."
                    )

            if step_type == 'approval':
                if action != 'approval_checkpoint':
                    raise serializers.ValidationError(
                        f"Step '{key}': approval steps must use action 'approval_checkpoint'."
                    )
                if not requires_approval:
                    raise serializers.ValidationError(
                        f"Step '{key}': approval steps must set requires_approval=true."
                    )

            available_prior_steps.add(key)

        return value


class AgentWorkflowTemplateListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkflowTemplate
        fields = [
            'id', 'name', 'slug', 'description', 'template_type', 'version',
            'is_public', 'is_active', 'updated_at',
        ]


class AgentWorkflowTemplateVersionSerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source='changed_by.email', read_only=True)

    class Meta:
        model = AgentWorkflowTemplateVersion
        fields = [
            'id', 'version_number', 'snapshot_json', 'change_note',
            'changed_by_email', 'created_at',
        ]


class AgentWorkflowStepRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentWorkflowStepRun
        fields = [
            'id', 'step_key', 'step_type', 'status',
            'input_json', 'output_json', 'model_used', 'prompt_version',
            'tokens_input', 'tokens_output', 'latency_ms', 'retry_count',
            'error_message', 'started_at', 'finished_at', 'created_at',
        ]


class AgentRunMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRunMetric
        fields = [
            'total_tokens', 'estimated_cost_usd', 'steps_total',
            'steps_failed', 'steps_retried', 'quality_score', 'roi_proxy_json',
            'created_at',
        ]


class AgentWorkflowApprovalSerializer(serializers.ModelSerializer):
    step_key = serializers.CharField(source='step_run.step_key', read_only=True)

    class Meta:
        model = AgentWorkflowApproval
        fields = [
            'id', 'run', 'step_run', 'step_key', 'status',
            'review_notes', 'requested_at', 'reviewed_at',
        ]
        read_only_fields = ['requested_at', 'reviewed_at']


class AgentWorkflowRunSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)
    step_runs = AgentWorkflowStepRunSerializer(many=True, read_only=True)
    approvals = AgentWorkflowApprovalSerializer(many=True, read_only=True)
    metrics = AgentRunMetricSerializer(read_only=True)

    class Meta:
        model = AgentWorkflowRun
        fields = [
            'id', 'template', 'template_slug', 'status', 'trigger_type',
            'input_payload_json', 'output_payload_json', 'error_summary',
            'run_context_json', 'started_at', 'finished_at', 'duration_ms',
            'created_at', 'updated_at', 'step_runs', 'approvals', 'metrics',
        ]
        read_only_fields = [
            'status', 'output_payload_json', 'error_summary', 'run_context_json',
            'started_at', 'finished_at', 'duration_ms', 'created_at', 'updated_at',
        ]


class AgentWorkflowRunCreateSerializer(serializers.Serializer):
    template_slug = serializers.CharField(max_length=200)
    trigger_type = serializers.ChoiceField(choices=['manual', 'schedule', 'api'], default='manual')
    input_payload_json = serializers.JSONField(required=False, default=dict)


class AgentWorkflowRunListSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = AgentWorkflowRun
        fields = [
            'id', 'template_slug', 'status', 'trigger_type',
            'created_by_email', 'created_at', 'started_at', 'finished_at', 'duration_ms',
        ]


class AgentApprovalDecisionSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True, default='')


class AgentMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMemory
        fields = [
            'id', 'owner_type', 'owner_id', 'memory_type', 'key', 'value_json',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AgentConnectorAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConnectorAccount
        fields = [
            'id', 'provider', 'status', 'external_account_id', 'base_url',
            'scopes_json', 'metadata_json', 'last_sync_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['status', 'last_sync_at', 'created_at', 'updated_at']


class AgentConnectorUpsertSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=[
        'hubspot', 'pipedrive', 'gmail', 'outlook', 'google_calendar', 'custom_api'
    ])
    external_account_id = serializers.CharField(required=False, allow_blank=True)
    base_url = serializers.URLField(required=False)
    token = serializers.CharField(required=False, allow_blank=True)
    refresh_token = serializers.CharField(required=False, allow_blank=True)
    scopes = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    metadata = serializers.JSONField(required=False, default=dict)


class AgentWorkflowTriggerSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)

    class Meta:
        model = AgentWorkflowTrigger
        fields = [
            'id', 'name', 'trigger_type', 'is_active',
            'template', 'template_slug',
            'webhook_key', 'schedule_every_minutes',
            'input_defaults_json', 'last_triggered_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['webhook_key', 'last_triggered_at', 'created_at', 'updated_at']


class AgentWorkflowTriggerCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    template_slug = serializers.CharField(max_length=200)
    trigger_type = serializers.ChoiceField(choices=['webhook', 'schedule'])
    is_active = serializers.BooleanField(default=True)
    schedule_every_minutes = serializers.IntegerField(required=False, min_value=1)
    input_defaults_json = serializers.JSONField(required=False, default=dict)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        trigger_type = attrs.get('trigger_type')
        every = attrs.get('schedule_every_minutes')
        if trigger_type == 'schedule' and not every:
            raise serializers.ValidationError({'schedule_every_minutes': 'Required for schedule trigger.'})
        return attrs


class AgentExternalActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentExternalAction
        fields = [
            'id', 'provider', 'action_type', 'request_json', 'response_json',
            'status', 'error_message', 'created_at',
        ]


class AgentDashboardSerializer(serializers.Serializer):
    total_runs = serializers.IntegerField()
    success_runs = serializers.IntegerField()
    failed_runs = serializers.IntegerField()
    avg_duration_ms = serializers.FloatField()
    total_tokens = serializers.IntegerField()
    estimated_cost_usd = serializers.FloatField()
    pending_approvals = serializers.IntegerField()


class AgentSLODashboardSerializer(serializers.Serializer):
    window_hours = serializers.IntegerField()
    total_runs = serializers.IntegerField()
    success_runs = serializers.IntegerField()
    failed_runs = serializers.IntegerField()
    success_rate = serializers.FloatField()
    target_success_rate = serializers.FloatField()
    error_budget_remaining_percent = serializers.FloatField()
    p95_duration_ms = serializers.FloatField()
    mean_time_to_resolve_minutes = serializers.FloatField()
    open_alerts_total = serializers.IntegerField()
    open_critical_alerts = serializers.IntegerField()
    delivered_alert_notifications = serializers.IntegerField()
    notification_delivery_rate = serializers.FloatField()
    uptime_timeseries = serializers.ListField(child=serializers.DictField())


class AgentTraceItemSerializer(serializers.Serializer):
    run_id = serializers.UUIDField()
    template_slug = serializers.CharField()
    status = serializers.CharField()
    trigger_type = serializers.CharField()
    created_at = serializers.DateTimeField()
    trigger_id = serializers.CharField(allow_blank=True, allow_null=True)
    orchestration_job_id = serializers.CharField(allow_blank=True, allow_null=True)
    orchestration_step_id = serializers.CharField(allow_blank=True, allow_null=True)
    retrieved_memory_count = serializers.IntegerField()
    external_actions_count = serializers.IntegerField()
    error_summary = serializers.CharField(allow_blank=True)


class AgentTraceDashboardSerializer(serializers.Serializer):
    total_runs = serializers.IntegerField()
    failed_runs = serializers.IntegerField()
    waiting_approval_runs = serializers.IntegerField()
    traces = AgentTraceItemSerializer(many=True)


class AgentReliabilityAlertSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    delivered_channels = serializers.SerializerMethodField()

    def get_delivered_channels(self, obj):
        context = obj.context_json or {}
        return context.get('delivered_channels', [])

    class Meta:
        model = AgentReliabilityAlert
        fields = [
            'id', 'dedupe_key', 'alert_type', 'severity', 'status',
            'message', 'user', 'user_email', 'trigger', 'run',
            'context_json', 'delivered_channels', 'resolved_at', 'created_at', 'updated_at',
        ]


class AgentOrchestrationJobStepSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)
    run_id = serializers.UUIDField(source='run.id', read_only=True)
    approved_by_email = serializers.EmailField(source='approved_by.email', read_only=True)

    class Meta:
        model = AgentOrchestrationJobStep
        fields = [
            'id', 'job', 'sequence', 'name', 'template', 'template_slug',
            'status', 'input_payload_json', 'depends_on_json', 'run_if_json',
            'requires_approval', 'run', 'run_id', 'approved_by', 'approved_by_email', 'approved_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['status', 'run', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class AgentOrchestrationJobSerializer(serializers.ModelSerializer):
    steps = AgentOrchestrationJobStepSerializer(many=True, read_only=True)

    class Meta:
        model = AgentOrchestrationJob
        fields = [
            'id', 'name', 'status', 'definition_json', 'workspace',
            'created_by', 'started_at', 'finished_at', 'created_at', 'updated_at', 'steps',
        ]
        read_only_fields = ['created_by', 'status', 'started_at', 'finished_at', 'created_at', 'updated_at']


class AgentMarketplaceListingSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)

    class Meta:
        model = AgentMarketplaceListing
        fields = [
            'id', 'template', 'template_slug', 'published_by', 'title', 'summary',
            'price_usd', 'billing_cycle', 'status', 'installs_count',
            'rating_avg', 'rating_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['published_by', 'installs_count', 'rating_avg', 'rating_count', 'created_at', 'updated_at']


class AgentMarketplaceListingDetailSerializer(serializers.ModelSerializer):
    template_slug = serializers.CharField(source='template.slug', read_only=True)
    template_type = serializers.CharField(source='template.template_type', read_only=True)
    template_description = serializers.CharField(source='template.description', read_only=True)
    template_definition_json = serializers.JSONField(source='template.definition_json', read_only=True)
    seller_email = serializers.EmailField(source='published_by.email', read_only=True)
    seller_name = serializers.SerializerMethodField()

    class Meta:
        model = AgentMarketplaceListing
        fields = [
            'id', 'template', 'template_slug', 'template_type', 'template_description',
            'template_definition_json', 'published_by', 'seller_email', 'seller_name',
            'title', 'summary', 'price_usd', 'billing_cycle', 'status',
            'installs_count', 'rating_avg', 'rating_count', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_seller_name(self, obj):
        u = obj.published_by
        return u.get_full_name() or u.email if u else ''


class AgentMarketplacePurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMarketplacePurchase
        fields = [
            'id', 'listing', 'buyer', 'purchased_template', 'amount_usd',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['buyer', 'purchased_template', 'amount_usd', 'status', 'created_at', 'updated_at']


class AgentMarketplaceSettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMarketplaceSettlement
        fields = [
            'id', 'purchase', 'status', 'amount_gross_usd', 'platform_fee_usd', 'amount_net_usd',
            'payout_provider', 'payout_reference', 'refunded_at', 'settled_at', 'metadata_json',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
