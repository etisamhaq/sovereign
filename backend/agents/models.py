import uuid
from django.conf import settings
from django.db import models


class AgentWorkspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_agent_workspaces',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workspaces'
        ordering = ['name']
        indexes = [
            models.Index(fields=['slug'], name='ag_ws_slug_idx'),
            models.Index(fields=['created_by', '-created_at'], name='ag_ws_user_created_idx'),
        ]

    def __str__(self):
        return self.slug


class AgentWorkspaceMembership(models.Model):
    ROLE_CHOICES = (
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('editor', 'Editor'),
        ('viewer', 'Viewer'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_workspace_memberships',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workspace_memberships'
        unique_together = [('workspace', 'user')]
        indexes = [
            models.Index(fields=['workspace', 'role'], name='ag_ws_mem_ws_role_idx'),
            models.Index(fields=['user', '-created_at'], name='ag_ws_mem_user_created_idx'),
        ]

    def __str__(self):
        return f"{self.workspace.slug}:{self.user_id}:{self.role}"


class AgentPolicyRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.CASCADE,
        related_name='policy_rules',
    )
    key = models.CharField(max_length=100)
    value_json = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_policy_rules',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_policy_rules'
        unique_together = [('workspace', 'key')]
        indexes = [
            models.Index(fields=['workspace', 'is_active'], name='ag_pol_ws_active_idx'),
        ]

    def __str__(self):
        return f"{self.workspace.slug}:{self.key}"


class AgentWorkflowTemplate(models.Model):
    TEMPLATE_TYPES = (
        ('content_repurpose', 'Content Repurpose'),
        ('revenue_ops', 'Revenue Operations'),
        ('seo_execution', 'SEO Execution'),
        ('custom', 'Custom'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES, default='custom')
    version = models.PositiveIntegerField(default=1)

    definition_json = models.JSONField(default=dict)
    default_config_json = models.JSONField(default=dict, blank=True)

    is_public = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_agent_templates',
    )
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workflow_templates'
        ordering = ['template_type', 'name', '-version']
        indexes = [
            models.Index(fields=['slug'], name='ag_wf_tpl_slug_idx'),
            models.Index(fields=['template_type', 'is_active'], name='ag_wf_tpl_type_act_idx'),
            models.Index(fields=['is_public', 'is_active'], name='ag_wf_tpl_pub_act_idx'),
        ]

    def __str__(self):
        return f"{self.name} v{self.version}"


class AgentWorkflowTemplateVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    snapshot_json = models.JSONField(default=dict)
    change_note = models.CharField(max_length=255, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_template_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_workflow_template_versions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['template', '-created_at'], name='ag_tpl_ver_tpl_created_idx'),
            models.Index(fields=['template', 'version_number'], name='ag_tpl_ver_tpl_ver_idx'),
        ]
        unique_together = [('template', 'version_number')]

    def __str__(self):
        return f"{self.template.slug}@v{self.version_number}"


class AgentWorkflowTrigger(models.Model):
    TRIGGER_TYPE_CHOICES = (
        ('webhook', 'Webhook'),
        ('schedule', 'Schedule'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='triggers',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_workflow_triggers',
    )

    name = models.CharField(max_length=200)
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPE_CHOICES)
    is_active = models.BooleanField(default=True)

    webhook_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    webhook_secret = models.CharField(max_length=255, blank=True)

    schedule_every_minutes = models.PositiveIntegerField(null=True, blank=True)
    input_defaults_json = models.JSONField(default=dict, blank=True)

    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workflow_triggers'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', '-created_at'], name='ag_trg_owner_created_idx'),
            models.Index(fields=['trigger_type', 'is_active'], name='ag_trg_type_active_idx'),
            models.Index(fields=['template', '-created_at'], name='ag_trg_tpl_created_idx'),
        ]

    def __str__(self):
        return f"{self.name} ({self.trigger_type})"


class AgentWorkflowRun(models.Model):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('waiting_approval', 'Waiting Approval'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    TRIGGER_CHOICES = (
        ('manual', 'Manual'),
        ('schedule', 'Schedule'),
        ('api', 'API'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.PROTECT,
        related_name='runs',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='manual')

    input_payload_json = models.JSONField(default=dict)
    output_payload_json = models.JSONField(default=dict, blank=True)

    error_summary = models.TextField(blank=True)
    run_context_json = models.JSONField(default=dict, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_workflow_runs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workflow_runs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_by', '-created_at'], name='ag_wf_run_user_created_idx'),
            models.Index(fields=['status', '-created_at'], name='ag_wf_run_status_created_ix'),
            models.Index(fields=['template', '-created_at'], name='ag_wf_run_tpl_created_idx'),
        ]

    def __str__(self):
        return f"{self.template.slug} [{self.status}]"


class AgentWorkflowStepRun(models.Model):
    STEP_STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
        ('awaiting_approval', 'Awaiting Approval'),
    )

    STEP_TYPE_CHOICES = (
        ('llm', 'LLM'),
        ('tool', 'Tool'),
        ('api_call', 'API Call'),
        ('transform', 'Transform'),
        ('approval', 'Approval'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AgentWorkflowRun,
        on_delete=models.CASCADE,
        related_name='step_runs',
    )
    step_key = models.CharField(max_length=200)
    step_type = models.CharField(max_length=20, choices=STEP_TYPE_CHOICES, default='tool')
    status = models.CharField(max_length=20, choices=STEP_STATUS_CHOICES, default='queued')

    input_json = models.JSONField(default=dict, blank=True)
    output_json = models.JSONField(default=dict, blank=True)

    model_used = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=50, blank=True)

    tokens_input = models.PositiveIntegerField(default=0)
    tokens_output = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)

    retry_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_workflow_step_runs'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['run', 'created_at'], name='ag_wf_step_run_created_idx'),
            models.Index(fields=['step_key'], name='ag_wf_step_key_idx'),
            models.Index(fields=['status', '-created_at'], name='ag_wf_step_status_creat_ix'),
        ]
        unique_together = [('run', 'step_key')]

    def __str__(self):
        return f"{self.run_id}:{self.step_key} ({self.status})"


class AgentWorkflowApproval(models.Model):
    APPROVAL_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AgentWorkflowRun,
        on_delete=models.CASCADE,
        related_name='approvals',
    )
    step_run = models.ForeignKey(
        AgentWorkflowStepRun,
        on_delete=models.CASCADE,
        related_name='approvals',
    )
    status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='pending')

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_approvals_requested',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_approvals_reviewed',
    )
    review_notes = models.TextField(blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'agent_workflow_approvals'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['run', '-requested_at'], name='ag_wf_appr_run_req_idx'),
            models.Index(fields=['status', '-requested_at'], name='ag_wf_appr_status_req_idx'),
        ]

    def __str__(self):
        return f"approval:{self.step_run.step_key} ({self.status})"


class AgentMemory(models.Model):
    OWNER_TYPE_CHOICES = (
        ('user', 'User'),
        ('workspace', 'Workspace'),
    )

    MEMORY_TYPE_CHOICES = (
        ('brand_voice', 'Brand Voice'),
        ('sales_policy', 'Sales Policy'),
        ('seo_rules', 'SEO Rules'),
        ('custom', 'Custom'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_type = models.CharField(max_length=20, choices=OWNER_TYPE_CHOICES, default='user')
    owner_id = models.UUIDField()

    memory_type = models.CharField(max_length=30, choices=MEMORY_TYPE_CHOICES, default='custom')
    key = models.CharField(max_length=200)
    value_json = models.JSONField(default=dict)

    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_memories',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_memories'
        ordering = ['memory_type', 'key']
        indexes = [
            models.Index(fields=['owner_type', 'owner_id'], name='ag_mem_owner_idx'),
            models.Index(fields=['memory_type', 'is_active'], name='ag_mem_type_active_idx'),
            models.Index(fields=['created_by', '-created_at'], name='ag_mem_user_created_idx'),
        ]
        unique_together = [('owner_type', 'owner_id', 'memory_type', 'key')]

    def __str__(self):
        return f"{self.owner_type}:{self.owner_id}:{self.memory_type}:{self.key}"


class AgentRunMetric(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.OneToOneField(
        AgentWorkflowRun,
        on_delete=models.CASCADE,
        related_name='metrics',
    )

    total_tokens = models.PositiveIntegerField(default=0)
    estimated_cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)

    steps_total = models.PositiveIntegerField(default=0)
    steps_failed = models.PositiveIntegerField(default=0)
    steps_retried = models.PositiveIntegerField(default=0)

    quality_score = models.FloatField(null=True, blank=True)
    roi_proxy_json = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_run_metrics'
        indexes = [
            models.Index(fields=['created_at'], name='ag_metric_created_idx'),
        ]

    def __str__(self):
        return f"metrics:{self.run_id}"


class AgentConnectorAccount(models.Model):
    PROVIDER_CHOICES = (
        ('hubspot', 'HubSpot'),
        ('pipedrive', 'Pipedrive'),
        ('gmail', 'Gmail'),
        ('outlook', 'Outlook'),
        ('google_calendar', 'Google Calendar'),
        ('custom_api', 'Custom API'),
    )

    STATUS_CHOICES = (
        ('connected', 'Connected'),
        ('expired', 'Expired'),
        ('error', 'Error'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_connector_accounts',
    )
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='connected')

    external_account_id = models.CharField(max_length=200, blank=True)
    base_url = models.URLField(max_length=500, blank=True)
    scopes_json = models.JSONField(default=list, blank=True)

    encrypted_tokens_json = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    last_sync_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_connector_accounts'
        ordering = ['provider', '-created_at']
        indexes = [
            models.Index(fields=['user', 'provider'], name='ag_conn_user_provider_idx'),
            models.Index(fields=['status', '-updated_at'], name='ag_conn_status_upd_idx'),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.provider}"


class AgentExternalAction(models.Model):
    STATUS_CHOICES = (
        ('queued', 'Queued'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AgentWorkflowRun,
        on_delete=models.CASCADE,
        related_name='external_actions',
    )
    step_run = models.ForeignKey(
        AgentWorkflowStepRun,
        on_delete=models.CASCADE,
        related_name='external_actions',
    )

    provider = models.CharField(max_length=50)
    action_type = models.CharField(max_length=100)
    request_json = models.JSONField(default=dict)
    response_json = models.JSONField(default=dict, blank=True)

    idempotency_key = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_external_actions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['run', '-created_at'], name='ag_ext_run_created_idx'),
            models.Index(fields=['provider', '-created_at'], name='ag_ext_provider_created_ix'),
        ]

    def __str__(self):
        return f"{self.provider}:{self.action_type} ({self.status})"


class AgentReliabilityAlert(models.Model):
    ALERT_TYPES = (
        ('failed_run_ratio', 'Failed Run Ratio'),
        ('trigger_dispatch_failure', 'Trigger Dispatch Failure'),
        ('schedule_trigger_stalled', 'Schedule Trigger Stalled'),
        ('connector_auth_failure', 'Connector Auth Failure'),
    )

    SEVERITY_CHOICES = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    )

    STATUS_CHOICES = (
        ('open', 'Open'),
        ('resolved', 'Resolved'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dedupe_key = models.CharField(max_length=255, unique=True)
    alert_type = models.CharField(max_length=40, choices=ALERT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    message = models.TextField()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_reliability_alerts',
        null=True,
        blank=True,
    )
    trigger = models.ForeignKey(
        AgentWorkflowTrigger,
        on_delete=models.SET_NULL,
        related_name='alerts',
        null=True,
        blank=True,
    )
    run = models.ForeignKey(
        AgentWorkflowRun,
        on_delete=models.SET_NULL,
        related_name='alerts',
        null=True,
        blank=True,
    )

    context_json = models.JSONField(default=dict, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_reliability_alerts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='ag_alert_status_created_idx'),
            models.Index(fields=['alert_type', '-created_at'], name='ag_alert_type_created_idx'),
            models.Index(fields=['user', '-created_at'], name='ag_alert_user_created_idx'),
        ]

    def __str__(self):
        return f"{self.alert_type}:{self.status}"


class AgentOrchestrationJob(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('waiting_approval', 'Waiting Approval'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    definition_json = models.JSONField(default=dict)
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orchestration_jobs',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_orchestration_jobs',
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_orchestration_jobs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_by', '-created_at'], name='ag_orch_user_created_idx'),
            models.Index(fields=['status', '-created_at'], name='ag_orch_status_created_idx'),
        ]

    def __str__(self):
        return f"{self.name}:{self.status}"


class AgentOrchestrationJobStep(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('awaiting_approval', 'Awaiting Approval'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        AgentOrchestrationJob,
        on_delete=models.CASCADE,
        related_name='steps',
    )
    sequence = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=200)
    template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.PROTECT,
        related_name='orchestration_steps',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    input_payload_json = models.JSONField(default=dict)
    depends_on_json = models.JSONField(default=list, blank=True)
    run_if_json = models.JSONField(default=dict, blank=True)
    requires_approval = models.BooleanField(default=False)
    run = models.ForeignKey(
        AgentWorkflowRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orchestration_steps',
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_orchestration_steps',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_orchestration_job_steps'
        ordering = ['sequence', 'created_at']
        unique_together = [('job', 'sequence')]
        indexes = [
            models.Index(fields=['job', 'status'], name='ag_orch_step_job_status_idx'),
        ]

    def __str__(self):
        return f"{self.job_id}:{self.sequence}:{self.status}"


class AgentMarketplaceListing(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    )
    BILLING_CHOICES = (
        ('one_time', 'One-time'),
        ('monthly', 'Monthly'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.OneToOneField(
        AgentWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='marketplace_listing',
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_marketplace_listings',
    )
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CHOICES, default='one_time')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    installs_count = models.PositiveIntegerField(default=0)
    rating_avg = models.FloatField(default=0)
    rating_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_marketplace_listings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='ag_mkt_status_created_idx'),
            models.Index(fields=['published_by', '-created_at'], name='ag_mkt_user_created_idx'),
        ]

    def __str__(self):
        return f"{self.template.slug}:{self.status}"


class AgentMarketplacePurchase(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        AgentMarketplaceListing,
        on_delete=models.PROTECT,
        related_name='purchases',
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_marketplace_purchases',
    )
    purchased_template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marketplace_purchases',
    )
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_marketplace_purchases'
        ordering = ['-created_at']
        unique_together = [('listing', 'buyer')]
        indexes = [
            models.Index(fields=['buyer', '-created_at'], name='ag_mkt_buy_user_created_idx'),
            models.Index(fields=['listing', '-created_at'], name='ag_mkt_buy_listing_created_idx'),
        ]

    def __str__(self):
        return f"{self.buyer_id}:{self.listing_id}:{self.status}"


class AgentMarketplaceSettlement(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('settled', 'Settled'),
        ('refunded', 'Refunded'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase = models.OneToOneField(
        AgentMarketplacePurchase,
        on_delete=models.CASCADE,
        related_name='settlement',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    amount_gross_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount_net_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payout_provider = models.CharField(max_length=50, blank=True, default='internal')
    payout_reference = models.CharField(max_length=255, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_marketplace_settlements'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='ag_mkt_set_status_created_idx'),
        ]

    def __str__(self):
        return f"{self.purchase_id}:{self.status}"


class AgentWorkspaceSSOProvider(models.Model):
    PROVIDER_CHOICES = (
        ('oidc', 'OIDC'),
        ('saml', 'SAML'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.CASCADE,
        related_name='sso_providers',
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120)
    provider_type = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='oidc')
    assertion_secret = models.CharField(max_length=255)
    config_json = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_sso_providers',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_workspace_sso_providers'
        unique_together = [('workspace', 'slug')]
        ordering = ['workspace', 'name']
        indexes = [
            models.Index(fields=['workspace', 'is_active'], name='ag_sso_ws_active_idx'),
        ]

    def __str__(self):
        return f"{self.workspace.slug}:{self.slug}"


class AgentWorkspaceAuditEvent(models.Model):
    SEVERITY_CHOICES = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        AgentWorkspace,
        on_delete=models.CASCADE,
        related_name='audit_events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_audit_events',
    )
    event_type = models.CharField(max_length=120)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='info')
    object_type = models.CharField(max_length=80, blank=True)
    object_id = models.CharField(max_length=80, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_workspace_audit_events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', '-created_at'], name='ag_audit_ws_created_idx'),
            models.Index(fields=['event_type', '-created_at'], name='ag_audit_type_created_idx'),
        ]

    def __str__(self):
        return f"{self.workspace.slug}:{self.event_type}"


class AgentTemplateMemoryPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        AgentWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='memory_policies',
    )
    key = models.CharField(max_length=120)
    value_json = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_template_memory_policies',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_template_memory_policies'
        unique_together = [('template', 'key')]
        indexes = [
            models.Index(fields=['template', 'is_active'], name='ag_mem_pol_tpl_active_idx'),
        ]

    def __str__(self):
        return f"{self.template.slug}:{self.key}"


class AgentTemplateEditLock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.OneToOneField(
        AgentWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='edit_lock',
    )
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='template_edit_locks',
    )
    base_version = models.PositiveIntegerField(default=1)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_template_edit_locks'
        indexes = [
            models.Index(fields=['expires_at'], name='ag_tpl_lock_expires_idx'),
        ]

    def __str__(self):
        return f"{self.template.slug}:{self.locked_by_id}"


# ─────────────────────────────────────────────────────────────────────────────
# Chat runtime models
# ─────────────────────────────────────────────────────────────────────────────
#
# These power the streaming /api/agents/chat/* surface (the function-calling
# planner + YAML workflows). They are intentionally separate from the
# enterprise control-plane models above (AgentWorkspace, AgentWorkflowTemplate,
# AgentWorkflowRun, AgentMarketplaceListing, …) which manage long-running
# background workflows, marketplace listings, OAuth connectors, etc.
#
# Naming + table-prefix policy:
#   * Class names here are short (Conversation, Message, AgentRun, …) because
#     they are the user-facing chat surface.
#   * Table names use the ``agent_chat_*`` prefix to keep them visually
#     distinct in the database.
# ─────────────────────────────────────────────────────────────────────────────


class Conversation(models.Model):
    """A user-owned chat thread with the streaming agent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_chat_conversations',
    )
    title = models.CharField(max_length=200, blank=True)
    system_prompt = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_chat_conversations'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at'], name='ag_chat_conv_user_idx'),
            models.Index(fields=['archived_at'], name='ag_chat_conv_arch_idx'),
        ]

    def __str__(self):
        return self.title or f'conversation:{self.id}'

    def touch(self) -> None:
        """Bump ``last_message_at``/``updated_at`` after a new message lands."""
        from django.utils import timezone

        self.last_message_at = timezone.now()
        self.save(update_fields=['last_message_at', 'updated_at'])

    def to_messages_payload(self):
        """Render the conversation as an OpenAI-style messages list."""
        out = []
        for m in self.messages.order_by('created_at'):
            entry = {'role': m.role}
            if m.role == 'tool':
                entry['tool_call_id'] = m.tool_call_id
                entry['name'] = m.tool_name
                entry['content'] = m.content or ''
            else:
                entry['content'] = m.content or ''
                if m.tool_calls:
                    entry['tool_calls'] = m.tool_calls
            out.append(entry)
        return out


class Message(models.Model):
    """One message inside a Conversation.

    Roles follow the OpenAI chat-completions vocabulary so payloads round-trip
    cleanly through the LLM.
    """

    ROLE_CHOICES = (
        ('system', 'system'),
        ('user', 'user'),
        ('assistant', 'assistant'),
        ('tool', 'tool'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField(blank=True, default='')

    # Assistant-only fields
    tool_calls = models.JSONField(default=list, blank=True)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    provider = models.CharField(max_length=32, blank=True, default='')
    model = models.CharField(max_length=64, blank=True, default='')

    # Tool-only fields
    tool_call_id = models.CharField(max_length=128, blank=True, default='')
    tool_name = models.CharField(max_length=128, blank=True, default='')
    is_error = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at'], name='ag_chat_msg_conv_idx'),
            models.Index(fields=['role'], name='ag_chat_msg_role_idx'),
        ]

    def __str__(self):
        return f'{self.role}:{self.id}'


class AgentRun(models.Model):
    """One end-to-end execution of the chat AgentRunner for one user turn.

    Distinct from :class:`AgentWorkflowRun` (control-plane orchestration runs).
    """

    STATUS_CHOICES = (
        ('running', 'running'),
        ('completed', 'completed'),
        ('failed', 'failed'),
        ('moderation_blocked', 'moderation_blocked'),
        ('cancelled', 'cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_chat_runs',
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='runs',
    )
    user_input = models.TextField(blank=True, default='')
    final_output = models.TextField(blank=True, default='')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='running')
    error_message = models.TextField(blank=True, default='')

    provider = models.CharField(max_length=32, blank=True, default='')
    model = models.CharField(max_length=64, blank=True, default='')
    total_steps = models.PositiveIntegerField(default=0)
    total_prompt_tokens = models.PositiveIntegerField(default=0)
    total_completion_tokens = models.PositiveIntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'agent_chat_runs'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at'], name='ag_chat_run_user_idx'),
            models.Index(fields=['conversation'], name='ag_chat_run_conv_idx'),
            models.Index(fields=['status'], name='ag_chat_run_status_idx'),
        ]

    def __str__(self):
        return f'AgentRun({self.id}, {self.status})'

    def mark_finished(self, status: str, *, error: str = '') -> None:
        from django.utils import timezone

        self.status = status
        if error:
            self.error_message = error
        self.finished_at = timezone.now()
        self.save(update_fields=['status', 'error_message', 'finished_at'])


class AgentRunStep(models.Model):
    """One step of an :class:`AgentRun` (LLM call or tool execution)."""

    KIND_CHOICES = (
        ('llm', 'llm'),
        ('tool_call', 'tool_call'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AgentRun,
        on_delete=models.CASCADE,
        related_name='steps',
    )
    index = models.PositiveIntegerField(default=0)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    tool_name = models.CharField(max_length=128, blank=True, default='')
    payload = models.JSONField(default=dict, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    is_error = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_chat_run_steps'
        ordering = ['index']
        indexes = [
            models.Index(fields=['run', 'index'], name='ag_chat_step_run_idx'),
            models.Index(fields=['kind'], name='ag_chat_step_kind_idx'),
        ]

    def __str__(self):
        return f'AgentRunStep({self.run_id}#{self.index} {self.kind})'


class Workflow(models.Model):
    """A YAML-defined chat-runtime workflow (planner-as-pipeline).

    This is an intentionally simpler, deterministic alternative to the
    control-plane :class:`AgentWorkflowTemplate`/:class:`AgentWorkflowRun`
    models. Built-in workflows are loaded from ``backend/agents/workflows/*.yaml``;
    user-owned workflows are an upgrade path for power users.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    spec = models.JSONField(default=dict, blank=True)
    is_builtin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_premium = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_chat_workflows',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_chat_workflows'
        ordering = ['name']
        indexes = [
            models.Index(fields=['slug'], name='ag_chat_wf_slug_idx'),
            models.Index(fields=['owner', 'is_active'], name='ag_chat_wf_owner_idx'),
        ]

    def __str__(self):
        return self.slug


class WorkflowRun(models.Model):
    """One execution of a :class:`Workflow`."""

    STATUS_CHOICES = (
        ('running', 'running'),
        ('completed', 'completed'),
        ('failed', 'failed'),
        ('cancelled', 'cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='runs',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_chat_workflow_runs',
    )
    inputs = models.JSONField(default=dict, blank=True)
    outputs = models.JSONField(default=dict, blank=True)
    current_step = models.CharField(max_length=120, blank=True, default='')
    progress = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='running')
    error_message = models.TextField(blank=True, default='')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'agent_chat_workflow_runs'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at'], name='ag_chat_wfrun_user_idx'),
            models.Index(fields=['workflow'], name='ag_chat_wfrun_wf_idx'),
            models.Index(fields=['status'], name='ag_chat_wfrun_status_idx'),
        ]

    def __str__(self):
        return f'WorkflowRun({self.workflow_id}/{self.status})'


class OutputRating(models.Model):
    """User feedback on a single assistant :class:`Message`.

    A user can rate a message at most once; subsequent rating posts overwrite
    the previous rating + comment.
    """

    RATING_CHOICES = (
        (1, 'thumbs_up'),
        (-1, 'thumbs_down'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_chat_ratings',
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='ratings',
    )
    rating = models.SmallIntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_chat_output_ratings'
        unique_together = (('user', 'message'),)
        indexes = [
            models.Index(fields=['message'], name='ag_chat_rating_msg_idx'),
            models.Index(fields=['user', '-created_at'], name='ag_chat_rating_user_idx'),
        ]

    def __str__(self):
        return f'rating({self.message_id}, {self.rating})'
