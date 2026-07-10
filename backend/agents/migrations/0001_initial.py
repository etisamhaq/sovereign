from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


def seed_default_templates(apps, schema_editor):
    AgentWorkflowTemplate = apps.get_model('agents', 'AgentWorkflowTemplate')

    templates = [
        {
            'name': 'Content Repurposing Agent',
            'slug': 'content-repurposing-agent',
            'description': 'Process source content, extract insights, and generate cross-platform assets.',
            'template_type': 'content_repurpose',
            'version': 1,
            'definition_json': {
                'steps': [
                    {
                        'key': 'process_source',
                        'type': 'tool',
                        'action': 'content_repurposer_process',
                        'input_from': None,
                        'config': {},
                    },
                    {
                        'key': 'generate_content',
                        'type': 'tool',
                        'action': 'content_repurposer_generate',
                        'input_from': 'step:process_source',
                        'config': {
                            'platforms': ['linkedin', 'twitter', 'newsletter']
                        },
                        'requires_approval': True,
                    },
                ]
            },
            'default_config_json': {'platforms': ['linkedin', 'twitter', 'newsletter']},
            'is_public': True,
            'is_active': True,
        },
        {
            'name': 'Revenue Ops Follow-up Agent',
            'slug': 'revenue-ops-followup-agent',
            'description': 'Detect stale deals, prepare followups, draft email copy, and push to external endpoint.',
            'template_type': 'revenue_ops',
            'version': 1,
            'definition_json': {
                'steps': [
                    {
                        'key': 'detect_stale_deals',
                        'type': 'transform',
                        'action': 'detect_stale_deals',
                        'input_from': None,
                        'config': {'stale_days': 7},
                    },
                    {
                        'key': 'prepare_followups',
                        'type': 'transform',
                        'action': 'prepare_followup_payloads',
                        'input_from': 'step:detect_stale_deals',
                        'config': {},
                    },
                    {
                        'key': 'draft_followup',
                        'type': 'tool',
                        'action': 'draft_followup_email',
                        'input_from': 'step:prepare_followups',
                        'config': {},
                        'requires_approval': True,
                    },
                    {
                        'key': 'send_to_webhook',
                        'type': 'api_call',
                        'provider': 'custom_api',
                        'action': 'custom_webhook_post',
                        'input_from': 'step:draft_followup',
                        'config': {},
                    },
                ]
            },
            'default_config_json': {'stale_days': 7},
            'is_public': True,
            'is_active': True,
        },
        {
            'name': 'SEO Execution Agent',
            'slug': 'seo-execution-agent',
            'description': 'Generate SEO content plan and social amplification prompts.',
            'template_type': 'seo_execution',
            'version': 1,
            'definition_json': {
                'steps': [
                    {
                        'key': 'seo_ideation',
                        'type': 'llm',
                        'action': 'llm_generate',
                        'input_from': None,
                        'config': {},
                    },
                    {
                        'key': 'approve_plan',
                        'type': 'approval',
                        'action': 'approval_checkpoint',
                        'input_from': 'step:seo_ideation',
                        'config': {},
                        'requires_approval': True,
                    },
                ]
            },
            'default_config_json': {},
            'is_public': True,
            'is_active': True,
        },
    ]

    for template in templates:
        AgentWorkflowTemplate.objects.update_or_create(
            slug=template['slug'],
            version=template['version'],
            defaults=template,
        )


def reverse_seed_default_templates(apps, schema_editor):
    AgentWorkflowTemplate = apps.get_model('agents', 'AgentWorkflowTemplate')
    AgentWorkflowTemplate.objects.filter(
        slug__in=['content-repurposing-agent', 'revenue-ops-followup-agent', 'seo-execution-agent']
    ).delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentWorkflowTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=200, unique=True)),
                ('description', models.TextField(blank=True)),
                ('template_type', models.CharField(choices=[('content_repurpose', 'Content Repurpose'), ('revenue_ops', 'Revenue Operations'), ('seo_execution', 'SEO Execution'), ('custom', 'Custom')], default='custom', max_length=50)),
                ('version', models.PositiveIntegerField(default=1)),
                ('definition_json', models.JSONField(default=dict)),
                ('default_config_json', models.JSONField(blank=True, default=dict)),
                ('is_public', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_agent_templates', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'agent_workflow_templates',
                'ordering': ['template_type', 'name', '-version'],
            },
        ),
        migrations.CreateModel(
            name='AgentWorkflowRun',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('running', 'Running'), ('waiting_approval', 'Waiting Approval'), ('succeeded', 'Succeeded'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='queued', max_length=20)),
                ('trigger_type', models.CharField(choices=[('manual', 'Manual'), ('schedule', 'Schedule'), ('api', 'API')], default='manual', max_length=20)),
                ('input_payload_json', models.JSONField(default=dict)),
                ('output_payload_json', models.JSONField(blank=True, default=dict)),
                ('error_summary', models.TextField(blank=True)),
                ('run_context_json', models.JSONField(blank=True, default=dict)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('duration_ms', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_workflow_runs', to=settings.AUTH_USER_MODEL)),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='runs', to='agents.agentworkflowtemplate')),
            ],
            options={
                'db_table': 'agent_workflow_runs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AgentWorkflowStepRun',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('step_key', models.CharField(max_length=200)),
                ('step_type', models.CharField(choices=[('llm', 'LLM'), ('tool', 'Tool'), ('api_call', 'API Call'), ('transform', 'Transform'), ('approval', 'Approval')], default='tool', max_length=20)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('running', 'Running'), ('succeeded', 'Succeeded'), ('failed', 'Failed'), ('skipped', 'Skipped'), ('awaiting_approval', 'Awaiting Approval')], default='queued', max_length=20)),
                ('input_json', models.JSONField(blank=True, default=dict)),
                ('output_json', models.JSONField(blank=True, default=dict)),
                ('model_used', models.CharField(blank=True, max_length=100)),
                ('prompt_version', models.CharField(blank=True, max_length=50)),
                ('tokens_input', models.PositiveIntegerField(default=0)),
                ('tokens_output', models.PositiveIntegerField(default=0)),
                ('latency_ms', models.PositiveIntegerField(default=0)),
                ('retry_count', models.PositiveIntegerField(default=0)),
                ('error_message', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='step_runs', to='agents.agentworkflowrun')),
            ],
            options={
                'db_table': 'agent_workflow_step_runs',
                'ordering': ['created_at'],
                'unique_together': {('run', 'step_key')},
            },
        ),
        migrations.CreateModel(
            name='AgentMemory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_type', models.CharField(choices=[('user', 'User'), ('workspace', 'Workspace')], default='user', max_length=20)),
                ('owner_id', models.UUIDField()),
                ('memory_type', models.CharField(choices=[('brand_voice', 'Brand Voice'), ('sales_policy', 'Sales Policy'), ('seo_rules', 'SEO Rules'), ('custom', 'Custom')], default='custom', max_length=30)),
                ('key', models.CharField(max_length=200)),
                ('value_json', models.JSONField(default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_memories', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'agent_memories',
                'ordering': ['memory_type', 'key'],
                'unique_together': {('owner_type', 'owner_id', 'memory_type', 'key')},
            },
        ),
        migrations.CreateModel(
            name='AgentRunMetric',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('total_tokens', models.PositiveIntegerField(default=0)),
                ('estimated_cost_usd', models.DecimalField(decimal_places=6, default=0, max_digits=10)),
                ('steps_total', models.PositiveIntegerField(default=0)),
                ('steps_failed', models.PositiveIntegerField(default=0)),
                ('steps_retried', models.PositiveIntegerField(default=0)),
                ('quality_score', models.FloatField(blank=True, null=True)),
                ('roi_proxy_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('run', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='metrics', to='agents.agentworkflowrun')),
            ],
            options={
                'db_table': 'agent_run_metrics',
            },
        ),
        migrations.CreateModel(
            name='AgentConnectorAccount',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(choices=[('hubspot', 'HubSpot'), ('pipedrive', 'Pipedrive'), ('gmail', 'Gmail'), ('outlook', 'Outlook'), ('google_calendar', 'Google Calendar'), ('custom_api', 'Custom API')], max_length=50)),
                ('status', models.CharField(choices=[('connected', 'Connected'), ('expired', 'Expired'), ('error', 'Error')], default='connected', max_length=20)),
                ('external_account_id', models.CharField(blank=True, max_length=200)),
                ('base_url', models.URLField(blank=True, max_length=500)),
                ('scopes_json', models.JSONField(blank=True, default=list)),
                ('encrypted_tokens_json', models.TextField(blank=True)),
                ('metadata_json', models.JSONField(blank=True, default=dict)),
                ('last_sync_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_connector_accounts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'agent_connector_accounts',
                'ordering': ['provider', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AgentWorkflowApproval',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('review_notes', models.TextField(blank=True)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_approvals_requested', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='agent_approvals_reviewed', to=settings.AUTH_USER_MODEL)),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='approvals', to='agents.agentworkflowrun')),
                ('step_run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='approvals', to='agents.agentworkflowsteprun')),
            ],
            options={
                'db_table': 'agent_workflow_approvals',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.CreateModel(
            name='AgentExternalAction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(max_length=50)),
                ('action_type', models.CharField(max_length=100)),
                ('request_json', models.JSONField(default=dict)),
                ('response_json', models.JSONField(blank=True, default=dict)),
                ('idempotency_key', models.CharField(max_length=255, unique=True)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('succeeded', 'Succeeded'), ('failed', 'Failed')], default='queued', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='external_actions', to='agents.agentworkflowrun')),
                ('step_run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='external_actions', to='agents.agentworkflowsteprun')),
            ],
            options={
                'db_table': 'agent_external_actions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(model_name='agentworkflowtemplate', index=models.Index(fields=['slug'], name='ag_wf_tpl_slug_idx')),
        migrations.AddIndex(model_name='agentworkflowtemplate', index=models.Index(fields=['template_type', 'is_active'], name='ag_wf_tpl_type_act_idx')),
        migrations.AddIndex(model_name='agentworkflowtemplate', index=models.Index(fields=['is_public', 'is_active'], name='ag_wf_tpl_pub_act_idx')),

        migrations.AddIndex(model_name='agentworkflowrun', index=models.Index(fields=['created_by', '-created_at'], name='ag_wf_run_user_created_idx')),
        migrations.AddIndex(model_name='agentworkflowrun', index=models.Index(fields=['status', '-created_at'], name='ag_wf_run_status_created_ix')),
        migrations.AddIndex(model_name='agentworkflowrun', index=models.Index(fields=['template', '-created_at'], name='ag_wf_run_tpl_created_idx')),

        migrations.AddIndex(model_name='agentworkflowsteprun', index=models.Index(fields=['run', 'created_at'], name='ag_wf_step_run_created_idx')),
        migrations.AddIndex(model_name='agentworkflowsteprun', index=models.Index(fields=['step_key'], name='ag_wf_step_key_idx')),
        migrations.AddIndex(model_name='agentworkflowsteprun', index=models.Index(fields=['status', '-created_at'], name='ag_wf_step_status_creat_ix')),

        migrations.AddIndex(model_name='agentworkflowapproval', index=models.Index(fields=['run', '-requested_at'], name='ag_wf_appr_run_req_idx')),
        migrations.AddIndex(model_name='agentworkflowapproval', index=models.Index(fields=['status', '-requested_at'], name='ag_wf_appr_status_req_idx')),

        migrations.AddIndex(model_name='agentmemory', index=models.Index(fields=['owner_type', 'owner_id'], name='ag_mem_owner_idx')),
        migrations.AddIndex(model_name='agentmemory', index=models.Index(fields=['memory_type', 'is_active'], name='ag_mem_type_active_idx')),
        migrations.AddIndex(model_name='agentmemory', index=models.Index(fields=['created_by', '-created_at'], name='ag_mem_user_created_idx')),

        migrations.AddIndex(model_name='agentrunmetric', index=models.Index(fields=['created_at'], name='ag_metric_created_idx')),

        migrations.AddIndex(model_name='agentconnectoraccount', index=models.Index(fields=['user', 'provider'], name='ag_conn_user_provider_idx')),
        migrations.AddIndex(model_name='agentconnectoraccount', index=models.Index(fields=['status', '-updated_at'], name='ag_conn_status_upd_idx')),

        migrations.AddIndex(model_name='agentexternalaction', index=models.Index(fields=['run', '-created_at'], name='ag_ext_run_created_idx')),
        migrations.AddIndex(model_name='agentexternalaction', index=models.Index(fields=['provider', '-created_at'], name='ag_ext_provider_created_ix')),

        migrations.RunPython(seed_default_templates, reverse_seed_default_templates),
    ]
