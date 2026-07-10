from django.contrib import admin
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
    # Chat-runtime models (separate from the enterprise control plane above).
    Conversation,
    Message,
    AgentRun,
    AgentRunStep,
    Workflow,
    WorkflowRun,
    OutputRating,
)


@admin.register(AgentWorkspace)
class AgentWorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_by', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug', 'created_by__email')


@admin.register(AgentWorkspaceMembership)
class AgentWorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'user', 'role', 'updated_at')
    list_filter = ('role',)
    search_fields = ('workspace__slug', 'user__email')


@admin.register(AgentPolicyRule)
class AgentPolicyRuleAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'key', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('workspace__slug', 'key')


@admin.register(AgentWorkflowTemplate)
class AgentWorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'template_type', 'version', 'is_public', 'is_active', 'updated_at')
    list_filter = ('template_type', 'is_public', 'is_active')
    search_fields = ('name', 'slug', 'description')


@admin.register(AgentWorkflowTrigger)
class AgentWorkflowTriggerAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_type', 'template', 'owner', 'is_active', 'last_triggered_at', 'updated_at')
    list_filter = ('trigger_type', 'is_active')
    search_fields = ('name', 'template__slug', 'owner__email')


@admin.register(AgentWorkflowTemplateVersion)
class AgentWorkflowTemplateVersionAdmin(admin.ModelAdmin):
    list_display = ('template', 'version_number', 'changed_by', 'created_at')
    list_filter = ('template',)
    search_fields = ('template__slug', 'changed_by__email', 'change_note')


class AgentWorkflowStepRunInline(admin.TabularInline):
    model = AgentWorkflowStepRun
    extra = 0
    readonly_fields = ('step_key', 'step_type', 'status', 'retry_count', 'latency_ms', 'started_at', 'finished_at')


@admin.register(AgentWorkflowRun)
class AgentWorkflowRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'template', 'status', 'trigger_type', 'created_by', 'created_at', 'duration_ms')
    list_filter = ('status', 'trigger_type', 'template')
    search_fields = ('id', 'template__slug', 'created_by__email')
    inlines = [AgentWorkflowStepRunInline]


@admin.register(AgentWorkflowStepRun)
class AgentWorkflowStepRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'run', 'step_key', 'step_type', 'status', 'retry_count', 'latency_ms')
    list_filter = ('step_type', 'status')
    search_fields = ('step_key', 'run__id')


@admin.register(AgentWorkflowApproval)
class AgentWorkflowApprovalAdmin(admin.ModelAdmin):
    list_display = ('id', 'run', 'step_run', 'status', 'requested_by', 'reviewed_by', 'requested_at')
    list_filter = ('status',)
    search_fields = ('run__id', 'step_run__step_key', 'requested_by__email')


@admin.register(AgentMemory)
class AgentMemoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner_type', 'owner_id', 'memory_type', 'key', 'is_active', 'updated_at')
    list_filter = ('owner_type', 'memory_type', 'is_active')
    search_fields = ('key',)


@admin.register(AgentRunMetric)
class AgentRunMetricAdmin(admin.ModelAdmin):
    list_display = ('run', 'total_tokens', 'estimated_cost_usd', 'steps_total', 'steps_failed', 'created_at')
    search_fields = ('run__id',)


@admin.register(AgentConnectorAccount)
class AgentConnectorAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'provider', 'status', 'external_account_id', 'updated_at')
    list_filter = ('provider', 'status')
    search_fields = ('user__email', 'external_account_id')


@admin.register(AgentExternalAction)
class AgentExternalActionAdmin(admin.ModelAdmin):
    list_display = ('id', 'provider', 'action_type', 'status', 'run', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('idempotency_key', 'run__id')


@admin.register(AgentReliabilityAlert)
class AgentReliabilityAlertAdmin(admin.ModelAdmin):
    list_display = ('alert_type', 'severity', 'status', 'user', 'trigger', 'created_at')
    list_filter = ('alert_type', 'severity', 'status')
    search_fields = ('dedupe_key', 'message', 'user__email')


@admin.register(AgentOrchestrationJob)
class AgentOrchestrationJobAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'workspace', 'created_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'created_by__email')


@admin.register(AgentOrchestrationJobStep)
class AgentOrchestrationJobStepAdmin(admin.ModelAdmin):
    list_display = ('job', 'sequence', 'template', 'status', 'run', 'updated_at')
    list_filter = ('status',)
    search_fields = ('job__name', 'template__slug')


@admin.register(AgentMarketplaceListing)
class AgentMarketplaceListingAdmin(admin.ModelAdmin):
    list_display = ('title', 'template', 'status', 'price_usd', 'billing_cycle', 'installs_count')
    list_filter = ('status', 'billing_cycle')
    search_fields = ('title', 'template__slug', 'published_by__email')


@admin.register(AgentMarketplacePurchase)
class AgentMarketplacePurchaseAdmin(admin.ModelAdmin):
    list_display = ('listing', 'buyer', 'amount_usd', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('buyer__email', 'listing__template__slug')


@admin.register(AgentMarketplaceSettlement)
class AgentMarketplaceSettlementAdmin(admin.ModelAdmin):
    list_display = ('purchase', 'status', 'amount_gross_usd', 'amount_net_usd', 'settled_at', 'refunded_at')
    list_filter = ('status',)
    search_fields = ('purchase__buyer__email', 'purchase__listing__template__slug', 'payout_reference')


@admin.register(AgentWorkspaceSSOProvider)
class AgentWorkspaceSSOProviderAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'name', 'slug', 'provider_type', 'is_active', 'updated_at')
    list_filter = ('provider_type', 'is_active')
    search_fields = ('workspace__slug', 'name', 'slug')


@admin.register(AgentWorkspaceAuditEvent)
class AgentWorkspaceAuditEventAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'event_type', 'severity', 'actor', 'created_at')
    list_filter = ('severity', 'event_type')
    search_fields = ('workspace__slug', 'event_type', 'object_type', 'object_id', 'actor__email')


@admin.register(AgentTemplateMemoryPolicy)
class AgentTemplateMemoryPolicyAdmin(admin.ModelAdmin):
    list_display = ('template', 'key', 'is_active', 'updated_by', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('template__slug', 'key')


@admin.register(AgentTemplateEditLock)
class AgentTemplateEditLockAdmin(admin.ModelAdmin):
    list_display = ('template', 'locked_by', 'base_version', 'expires_at', 'updated_at')
    search_fields = ('template__slug', 'locked_by__email')


# ── Chat runtime ──────────────────────────────────────────────────────────
# These are read-mostly: most edits happen through the API, but admin access
# is useful for support / debugging.


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('role', 'content', 'tool_name', 'tool_call_id', 'is_error', 'created_at')
    fields = ('role', 'content', 'tool_name', 'tool_call_id', 'is_error', 'created_at')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'last_message_at', 'archived_at', 'updated_at')
    list_filter = ('archived_at',)
    search_fields = ('title', 'user__email')
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_message_at')
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'role', 'tool_name', 'is_error', 'created_at')
    list_filter = ('role', 'is_error')
    search_fields = ('conversation__id', 'tool_name', 'tool_call_id')
    readonly_fields = ('id', 'created_at')


class AgentRunStepInline(admin.TabularInline):
    model = AgentRunStep
    extra = 0
    readonly_fields = ('index', 'kind', 'tool_name', 'duration_ms', 'is_error', 'created_at')
    fields = ('index', 'kind', 'tool_name', 'duration_ms', 'is_error', 'created_at')


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'conversation', 'status', 'provider', 'model',
        'total_steps', 'total_cost_usd', 'started_at', 'finished_at',
    )
    list_filter = ('status', 'provider')
    search_fields = ('id', 'user__email', 'conversation__id')
    readonly_fields = ('id', 'started_at', 'finished_at')
    inlines = [AgentRunStepInline]


@admin.register(AgentRunStep)
class AgentRunStepAdmin(admin.ModelAdmin):
    list_display = ('id', 'run', 'index', 'kind', 'tool_name', 'duration_ms', 'is_error', 'created_at')
    list_filter = ('kind', 'is_error')
    search_fields = ('run__id', 'tool_name')


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ('slug', 'name', 'is_builtin', 'is_premium', 'is_active', 'owner', 'updated_at')
    list_filter = ('is_builtin', 'is_premium', 'is_active')
    search_fields = ('slug', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'workflow', 'user', 'status', 'progress', 'started_at', 'finished_at')
    list_filter = ('status',)
    search_fields = ('id', 'workflow__slug', 'user__email')
    readonly_fields = ('id', 'started_at', 'finished_at')


@admin.register(OutputRating)
class OutputRatingAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'message', 'rating', 'created_at', 'updated_at')
    list_filter = ('rating',)
    search_fields = ('user__email', 'message__id')
    readonly_fields = ('id', 'created_at', 'updated_at')
