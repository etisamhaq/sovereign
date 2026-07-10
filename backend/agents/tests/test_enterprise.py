from unittest.mock import patch
from datetime import timedelta

from django.utils import timezone
from django.urls import reverse
from django.test import override_settings
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from accounts.models import User
from agents.models import (
    AgentWorkspace,
    AgentWorkspaceMembership,
    AgentPolicyRule,
    AgentWorkflowTemplate,
    AgentWorkflowRun,
    AgentWorkflowApproval,
    AgentMemory,
    AgentWorkflowTemplateVersion,
    AgentConnectorAccount,
    AgentReliabilityAlert,
    AgentOrchestrationJob,
    AgentMarketplaceListing,
    AgentMarketplacePurchase,
    AgentWorkspaceSSOProvider,
    AgentWorkspaceAuditEvent,
    AgentTemplateMemoryPolicy,
    AgentTemplateEditLock,
    AgentMarketplaceSettlement,
)
from agents.tasks import check_agent_connector_health, evaluate_agent_reliability_alerts
from agents.services.workflow_engine import WorkflowEngine
from agents.services.crypto import TokenCipher
from agents.services.reliability_notifications import notify_reliability_alert
from payments.models import UsageQuota


class AgentsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='agents@example.com', password='Passw0rd!')
        self.client.force_authenticate(self.user)
        WorkflowEngine.ensure_default_templates(self.user)

    def test_list_templates(self):
        url = reverse('agents:template-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_custom_template(self):
        url = reverse('agents:template-list')
        payload = {
            'name': 'Custom Support Agent',
            'description': 'A custom support workflow.',
            'template_type': 'custom',
            'is_public': False,
            'definition_json': {
                'steps': [
                    {
                        'key': 'draft_reply',
                        'type': 'llm',
                        'action': 'llm_generate',
                        'config': {},
                    }
                ]
            },
            'default_config_json': {},
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['template_type'], 'custom')
        self.assertTrue(response.data['slug'].startswith('custom-support-agent'))

    def test_create_custom_template_rejects_invalid_step_contract(self):
        url = reverse('agents:template-list')
        payload = {
            'name': 'Bad Contract Template',
            'description': 'Should fail validation.',
            'template_type': 'custom',
            'is_public': False,
            'definition_json': {
                'steps': [
                    {
                        'key': 'send_api',
                        'type': 'api_call',
                        'action': 'custom_webhook_post',
                        'config': {},
                    }
                ]
            },
            'default_config_json': {},
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('provider', str(response.data).lower())

    def test_update_template_with_bump_version(self):
        create_url = reverse('agents:template-list')
        create_payload = {
            'name': 'Versioned Template',
            'description': 'Initial.',
            'template_type': 'custom',
            'is_public': False,
            'definition_json': {
                'steps': [
                    {
                        'key': 'draft_reply',
                        'type': 'llm',
                        'action': 'llm_generate',
                        'config': {},
                    }
                ]
            },
            'default_config_json': {},
        }
        create_response = self.client.post(create_url, create_payload, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        slug = create_response.data['slug']
        self.assertEqual(create_response.data['version'], 1)

        update_url = f"{reverse('agents:template-detail', kwargs={'slug': slug})}?bump_version=true"
        update_payload = {
            'description': 'Updated.',
            'definition_json': {
                'steps': [
                    {
                        'key': 'draft_reply',
                        'type': 'llm',
                        'action': 'llm_generate',
                        'config': {'tone': 'professional'},
                    }
                ]
            },
        }
        update_response = self.client.patch(update_url, update_payload, format='json')
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['version'], 2)

        versions_url = reverse('agents:template-versions', kwargs={'slug': slug})
        versions_response = self.client.get(versions_url)
        self.assertEqual(versions_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(versions_response.data), 2)

        rollback_url = reverse('agents:template-rollback', kwargs={'slug': slug, 'version_number': 1})
        rollback_response = self.client.post(rollback_url, {}, format='json')
        self.assertEqual(rollback_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(rollback_response.data['version'], 3)

    @patch('agents.views.execute_agent_workflow_run.delay')
    def test_create_run(self, mocked_delay):
        url = reverse('agents:run-list-create')
        payload = {
            'template_slug': 'seo-execution-agent',
            'input_payload_json': {
                'prompt': 'Create an SEO strategy for a B2B SaaS analytics product.'
            }
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        mocked_delay.assert_called_once()

    def test_memory_crud(self):
        create_url = reverse('agents:memory-list-create')
        payload = {
            'owner_type': 'user',
            'owner_id': str(self.user.id),
            'memory_type': 'brand_voice',
            'key': 'tone',
            'value_json': {'style': 'professional', 'constraints': ['no hype']},
            'is_active': True,
        }
        create_resp = self.client.post(create_url, payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)

        memory_id = create_resp.data['id']
        detail_url = reverse('agents:memory-detail', kwargs={'id': memory_id})
        patch_resp = self.client.patch(detail_url, {'value_json': {'style': 'friendly'}}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['value_json']['style'], 'friendly')

    @patch('agents.services.workflow_engine.WorkflowEngine.execute')
    def test_approval_approve_resumes_run(self, mocked_execute):
        mocked_execute.return_value = {'outputs': {}, 'errors': []}

        template = AgentWorkflowTemplate.objects.get(slug='seo-execution-agent')
        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            status='waiting_approval',
            input_payload_json={'prompt': 'x'},
        )
        step = run.step_runs.create(
            step_key='approve_plan',
            step_type='approval',
            status='awaiting_approval',
        )
        approval = AgentWorkflowApproval.objects.create(
            run=run,
            step_run=step,
            requested_by=self.user,
            status='pending',
        )

        with patch('agents.views.resume_agent_workflow_after_approval.delay') as delay_mock:
            url = reverse('agents:approval-approve', kwargs={'approval_id': approval.id})
            response = self.client.post(url, {'review_notes': 'Looks good'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            delay_mock.assert_called_once()

    @patch('agents.views.dispatch_agent_trigger.delay')
    def test_webhook_trigger_invocation(self, mocked_dispatch):
        trigger_url = reverse('agents:trigger-list-create')
        payload = {
            'name': 'Inbound Lead Hook',
            'template_slug': 'seo-execution-agent',
            'trigger_type': 'webhook',
            'webhook_secret': 'super-secret',
            'input_defaults_json': {'prompt': 'Default prompt'},
        }
        create_response = self.client.post(trigger_url, payload, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        webhook_key = create_response.data['webhook_key']
        invoke_url = reverse('agents:hook-invoke', kwargs={'webhook_key': webhook_key})

        anonymous_client = APIClient()
        invoke_response = anonymous_client.post(
            invoke_url,
            {'prompt': 'Triggered prompt'},
            format='json',
            HTTP_X_SOVEREIGN_WEBHOOK_SECRET='super-secret',
        )
        self.assertEqual(invoke_response.status_code, status.HTTP_200_OK)
        mocked_dispatch.assert_called_once()

    def test_run_completion_records_usage_meter_once(self):
        template = AgentWorkflowTemplate.objects.create(
            name='Billing Meter Test Agent',
            slug='billing-meter-test-agent',
            template_type='custom',
            definition_json={'steps': []},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=self.user,
        )
        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            input_payload_json={},
            run_context_json={},
        )

        quota, _ = UsageQuota.objects.get_or_create(user=self.user)
        start_usage = quota.current_usage
        start_bonus = quota.bonus_credits

        WorkflowEngine(run).execute()
        quota.refresh_from_db()

        usage_delta = quota.current_usage - start_usage
        bonus_delta = start_bonus - quota.bonus_credits
        self.assertEqual(usage_delta + bonus_delta, 1)

        # Re-executing same run should not double-charge.
        WorkflowEngine(run).execute()
        quota.refresh_from_db()
        usage_delta_2 = quota.current_usage - start_usage
        bonus_delta_2 = start_bonus - quota.bonus_credits
        self.assertEqual(usage_delta_2 + bonus_delta_2, 1)

    def test_rag_memory_retrieval_context_injected_into_run(self):
        AgentMemory.objects.create(
            owner_type='user',
            owner_id=self.user.id,
            memory_type='brand_voice',
            key='tone',
            value_json={'style': 'concise'},
            is_active=True,
            created_by=self.user,
        )

        template = AgentWorkflowTemplate.objects.create(
            name='Memory Context Agent',
            slug='memory-context-agent',
            template_type='custom',
            definition_json={'steps': []},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=self.user,
        )
        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            input_payload_json={},
            run_context_json={},
        )

        WorkflowEngine(run).execute()
        run.refresh_from_db()
        self.assertGreaterEqual(run.run_context_json.get('retrieved_memory_count', 0), 1)
        self.assertTrue(any('brand_voice:tone' == key for key in run.run_context_json.get('retrieved_memory_keys', [])))

    def test_semantic_memory_ranking_prefers_relevant_memory(self):
        AgentMemory.objects.create(
            owner_type='user',
            owner_id=self.user.id,
            memory_type='seo_rules',
            key='keyword_density',
            value_json={'rule': 'Keep keyword density between 1-2% for blog SEO'},
            is_active=True,
            created_by=self.user,
        )
        AgentMemory.objects.create(
            owner_type='user',
            owner_id=self.user.id,
            memory_type='sales_policy',
            key='discount_limit',
            value_json={'rule': 'Never discount above 20% without approval'},
            is_active=True,
            created_by=self.user,
        )

        template = AgentWorkflowTemplate.objects.create(
            name='Semantic Memory Agent',
            slug='semantic-memory-agent',
            template_type='custom',
            definition_json={'steps': []},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=self.user,
        )
        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            input_payload_json={'prompt': 'Generate SEO blog strategy with keyword optimization'},
            run_context_json={},
        )

        WorkflowEngine(run).execute()
        run.refresh_from_db()
        keys = run.run_context_json.get('retrieved_memory_keys', [])
        self.assertTrue(keys)
        self.assertEqual(keys[0], 'seo_rules:keyword_density')
        self.assertEqual(run.run_context_json.get('memory_retrieval_strategy'), 'vector_semantic_ranked')

    def test_connector_health_marks_expired_without_refresh(self):
        connector = AgentConnectorAccount.objects.create(
            user=self.user,
            provider='custom_api',
            status='connected',
            base_url='https://example.com/webhook',
            encrypted_tokens_json=TokenCipher.encrypt('{"access_token": "x"}'),
            metadata_json={
                'access_token_expires_at': (timezone.now() - timedelta(minutes=5)).isoformat(),
                'refresh_token_present': False,
            },
        )

        check_agent_connector_health.run()
        connector.refresh_from_db()
        self.assertEqual(connector.status, 'expired')

    @patch('agents.services.oauth_refresh.httpx.post')
    def test_connector_health_refreshes_google_provider_token(self, mocked_post):
        class _Resp:
            status_code = 200

            @staticmethod
            def json():
                return {
                    'access_token': 'new-google-token',
                    'refresh_token': 'new-refresh-token',
                    'expires_in': 3600,
                    'token_type': 'Bearer',
                }

        mocked_post.return_value = _Resp()

        connector = AgentConnectorAccount.objects.create(
            user=self.user,
            provider='gmail',
            status='connected',
            encrypted_tokens_json=TokenCipher.encrypt('{"access_token":"old","refresh_token":"old-refresh"}'),
            metadata_json={
                'access_token_expires_at': (timezone.now() - timedelta(minutes=5)).isoformat(),
                'refresh_token_present': True,
                'client_id': 'client-id',
                'client_secret': 'client-secret',
            },
        )

        result = check_agent_connector_health.run()
        connector.refresh_from_db()

        self.assertEqual(connector.status, 'connected')
        self.assertEqual(result.get('refreshed', 0), 1)
        decrypted = TokenCipher.decrypt(connector.encrypted_tokens_json)
        self.assertIn('new-google-token', decrypted)

    def test_reliability_alert_failed_ratio_signal(self):
        template = AgentWorkflowTemplate.objects.get(slug='seo-execution-agent')
        for _ in range(10):
            AgentWorkflowRun.objects.create(
                template=template,
                created_by=self.user,
                status='failed',
                input_payload_json={'prompt': 'x'},
            )

        evaluate_agent_reliability_alerts.run()
        self.assertTrue(
            AgentReliabilityAlert.objects.filter(
                user=self.user,
                alert_type='failed_run_ratio',
                status='open',
            ).exists()
        )

    @override_settings(
        AGENT_ALERT_NOTIFY_EMAIL_ENABLED=True,
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_reliability_alert_notification_email_delivery(self):
        alert = AgentReliabilityAlert.objects.create(
            dedupe_key=f'test-email-alert:{self.user.id}',
            alert_type='failed_run_ratio',
            severity='critical',
            status='open',
            message='Failure ratio exceeded threshold.',
            user=self.user,
            context_json={},
        )

        notify_reliability_alert(alert)
        alert.refresh_from_db()

        delivered = (alert.context_json or {}).get('delivered_channels', [])
        self.assertIn('email', delivered)
        self.assertGreaterEqual(len(mail.outbox), 1)

    @override_settings(
        AGENT_ALERT_NOTIFY_EMAIL_ENABLED=False,
        AGENT_ALERT_NOTIFY_SLACK_WEBHOOK_URL='https://hooks.slack.example/services/a/b/c',
    )
    @patch('agents.services.reliability_notifications.httpx.post')
    def test_reliability_alert_notification_slack_delivery(self, mocked_post):
        class _Resp:
            status_code = 200

        mocked_post.return_value = _Resp()

        alert = AgentReliabilityAlert.objects.create(
            dedupe_key=f'test-slack-alert:{self.user.id}',
            alert_type='trigger_dispatch_failure',
            severity='critical',
            status='open',
            message='Trigger dispatch failed.',
            user=self.user,
            context_json={},
        )

        notify_reliability_alert(alert)
        alert.refresh_from_db()

        delivered = (alert.context_json or {}).get('delivered_channels', [])
        self.assertIn('slack', delivered)
        mocked_post.assert_called_once()

    def test_slo_dashboard_endpoint(self):
        template = AgentWorkflowTemplate.objects.get(slug='seo-execution-agent')
        for _ in range(3):
            AgentWorkflowRun.objects.create(
                template=template,
                created_by=self.user,
                status='succeeded',
                duration_ms=1200,
                input_payload_json={'prompt': 'x'},
            )
        AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            status='failed',
            duration_ms=2400,
            input_payload_json={'prompt': 'x'},
        )

        url = reverse('agents:dashboard-slo')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('success_rate', response.data)
        self.assertIn('error_budget_remaining_percent', response.data)
        self.assertIn('p95_duration_ms', response.data)
        self.assertIn('uptime_timeseries', response.data)

    def test_trace_dashboard_endpoint(self):
        template = AgentWorkflowTemplate.objects.get(slug='seo-execution-agent')
        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=self.user,
            status='failed',
            trigger_type='api',
            input_payload_json={'prompt': 'x'},
            run_context_json={
                'trigger_id': 'trigger-123',
                'orchestration_job_id': 'job-123',
                'orchestration_step_id': 'step-2',
                'retrieved_memory_count': 3,
            },
            error_summary='Sample failure',
        )
        step = run.step_runs.create(step_key='api_step', step_type='api_call', status='failed')
        run.external_actions.create(
            step_run=step,
            provider='custom_api',
            action_type='custom_webhook_post',
            request_json={'a': 1},
            response_json={'status_code': 500},
            idempotency_key=f'{run.id}:api_step:custom_webhook_post:test',
            status='failed',
            error_message='boom',
        )

        response = self.client.get(reverse('agents:dashboard-traces'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('traces', response.data)
        self.assertGreaterEqual(len(response.data['traces']), 1)
        first = response.data['traces'][0]
        self.assertIn('run_id', first)
        self.assertIn('external_actions_count', first)

    def test_workspace_policy_enforces_max_steps_on_template_create(self):
        ws_resp = self.client.post(reverse('agents:workspace-list-create'), {
            'name': 'Acme Workspace',
            'slug': 'acme-workspace',
            'is_active': True,
        }, format='json')
        self.assertEqual(ws_resp.status_code, status.HTTP_201_CREATED)

        policy_resp = self.client.post(
            reverse('agents:workspace-policies', kwargs={'workspace_slug': 'acme-workspace'}),
            {'key': 'max_steps_per_template', 'value_json': {'value': 1}, 'is_active': True},
            format='json',
        )
        self.assertEqual(policy_resp.status_code, status.HTTP_201_CREATED)

        create_resp = self.client.post(
            reverse('agents:template-list') + '?workspace=acme-workspace',
            {
                'name': 'Policy Limited Template',
                'template_type': 'custom',
                'is_public': False,
                'definition_json': {
                    'steps': [
                        {'key': 's1', 'type': 'transform', 'action': 'noop', 'config': {}},
                        {'key': 's2', 'type': 'transform', 'action': 'noop', 'config': {}},
                    ]
                },
                'default_config_json': {},
            },
            format='json',
        )
        self.assertEqual(create_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Policy max_steps_per_template exceeded', str(create_resp.data))

    @patch('agents.views.execute_agent_orchestration_job.delay')
    def test_create_and_execute_orchestration_job(self, mocked_delay):
        create_resp = self.client.post(
            reverse('agents:orchestration-list-create'),
            {
                'name': 'Chained Agent Job',
                'steps': [
                    {'name': 'first', 'template_slug': 'seo-execution-agent', 'input_payload_json': {'prompt': 'a'}},
                    {'name': 'second', 'template_slug': 'seo-execution-agent', 'input_payload_json': {'prompt': 'b'}},
                ],
            },
            format='json',
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        job_id = create_resp.data['id']
        self.assertEqual(AgentOrchestrationJob.objects.filter(id=job_id).count(), 1)

        execute_resp = self.client.post(reverse('agents:orchestration-execute', kwargs={'id': job_id}), {}, format='json')
        self.assertEqual(execute_resp.status_code, status.HTTP_200_OK)
        mocked_delay.assert_called_once()

    def test_marketplace_publish_and_purchase_clones_template(self):
        seller = User.objects.create_user(email='seller@example.com', password='Passw0rd!')
        seller_template = AgentWorkflowTemplate.objects.create(
            name='Seller Agent',
            slug='seller-agent-template',
            template_type='custom',
            definition_json={'steps': [{'key': 's1', 'type': 'transform', 'action': 'noop', 'config': {}}]},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=seller,
        )

        seller_client = APIClient()
        seller_client.force_authenticate(seller)
        publish_resp = seller_client.post(
            reverse('agents:marketplace-listings'),
            {
                'template_slug': seller_template.slug,
                'title': 'Seller Agent Listing',
                'summary': 'A reusable listing',
                'price_usd': '12.00',
                'billing_cycle': 'one_time',
                'status': 'published',
            },
            format='json',
        )
        self.assertEqual(publish_resp.status_code, status.HTTP_201_CREATED)
        listing_id = publish_resp.data['id']

        buy_resp = self.client.post(reverse('agents:marketplace-purchase', kwargs={'id': listing_id}), {}, format='json')
        self.assertEqual(buy_resp.status_code, status.HTTP_201_CREATED)

        purchase = AgentMarketplacePurchase.objects.get(id=buy_resp.data['id'])
        self.assertEqual(purchase.buyer_id, self.user.id)
        self.assertIsNotNone(purchase.purchased_template_id)
        purchased_template = AgentWorkflowTemplate.objects.get(id=purchase.purchased_template_id)
        self.assertEqual(purchased_template.created_by_id, self.user.id)
        self.assertFalse(purchased_template.is_public)

        settlement = AgentMarketplaceSettlement.objects.get(purchase=purchase)
        self.assertEqual(settlement.status, 'pending')

    def test_workspace_sso_assertion_and_audit_export(self):
        ws = self.client.post(reverse('agents:workspace-list-create'), {
            'name': 'Enterprise WS',
            'slug': 'enterprise-ws',
            'is_active': True,
        }, format='json')
        self.assertEqual(ws.status_code, status.HTTP_201_CREATED)

        provider_resp = self.client.post(
            reverse('agents:workspace-identity-providers', kwargs={'workspace_slug': 'enterprise-ws'}),
            {
                'name': 'OIDC Prod',
                'slug': 'oidc-prod',
                'provider_type': 'oidc',
                'assertion_secret': 'super-secret',
                'config_json': {'issuer': 'https://issuer.example'},
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(provider_resp.status_code, status.HTTP_201_CREATED)

        anon = APIClient()
        assert_resp = anon.post(
            reverse('agents:workspace-sso-assert', kwargs={'workspace_slug': 'enterprise-ws'}),
            {
                'provider_slug': 'oidc-prod',
                'assertion_secret': 'super-secret',
                'email': 'sso-user@example.com',
                'first_name': 'Sso',
                'last_name': 'User',
                'role': 'editor',
            },
            format='json',
        )
        self.assertEqual(assert_resp.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', assert_resp.data)

        audit_count = AgentWorkspaceAuditEvent.objects.filter(workspace__slug='enterprise-ws').count()
        self.assertGreaterEqual(audit_count, 1)

        export_resp = self.client.get(
            reverse('agents:workspace-audit-export', kwargs={'workspace_slug': 'enterprise-ws'}) + '?format=csv'
        )
        self.assertEqual(export_resp.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', export_resp['Content-Type'])

    def test_template_lock_conflict(self):
        template = AgentWorkflowTemplate.objects.create(
            name='Lock Me',
            slug='lock-me-template',
            template_type='custom',
            definition_json={'steps': []},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=self.user,
        )

        lock_resp = self.client.post(reverse('agents:template-lock', kwargs={'slug': template.slug}), {}, format='json')
        self.assertEqual(lock_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(AgentTemplateEditLock.objects.filter(template=template).exists())

        other = User.objects.create_user(email='other-lock@example.com', password='Passw0rd!')
        other_client = APIClient()
        other_client.force_authenticate(other)
        patch_resp = other_client.patch(
            reverse('agents:template-detail', kwargs={'slug': template.slug}),
            {'description': 'x'},
            format='json',
        )
        self.assertIn(patch_resp.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_409_CONFLICT])

    def test_template_memory_policy_saved(self):
        template = AgentWorkflowTemplate.objects.create(
            name='Policy Tpl',
            slug='policy-tpl',
            template_type='custom',
            definition_json={'steps': []},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=self.user,
        )

        resp = self.client.post(
            reverse('agents:template-memory-policies', kwargs={'slug': template.slug}),
            {'key': 'memory_semantic_weight', 'value_json': {'value': 0.6}, 'is_active': True},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            AgentTemplateMemoryPolicy.objects.filter(template=template, key='memory_semantic_weight').exists()
        )

    @patch('agents.views.execute_agent_orchestration_job.delay')
    def test_orchestration_approval_gate(self, mocked_delay):
        create_resp = self.client.post(
            reverse('agents:orchestration-list-create'),
            {
                'name': 'Approval DAG',
                'steps': [
                    {
                        'name': 'needs-approval',
                        'template_slug': 'seo-execution-agent',
                        'input_payload_json': {'prompt': 'a'},
                        'requires_approval': True,
                    },
                ],
            },
            format='json',
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        job_id = create_resp.data['id']
        step_id = create_resp.data['steps'][0]['id']

        step = AgentOrchestrationJob.objects.get(id=job_id).steps.first()
        step.status = 'awaiting_approval'
        step.save(update_fields=['status'])

        approve_resp = self.client.post(
            reverse('agents:orchestration-step-approve', kwargs={'id': job_id, 'step_id': step_id}),
            {},
            format='json',
        )
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)
        mocked_delay.assert_called()

    def test_marketplace_settle_refund_and_analytics(self):
        seller = User.objects.create_user(email='seller2@example.com', password='Passw0rd!')
        seller_template = AgentWorkflowTemplate.objects.create(
            name='Seller2 Agent',
            slug='seller2-agent-template',
            template_type='custom',
            definition_json={'steps': [{'key': 's1', 'type': 'transform', 'action': 'noop', 'config': {}}]},
            default_config_json={},
            is_public=False,
            is_active=True,
            created_by=seller,
        )
        seller_client = APIClient()
        seller_client.force_authenticate(seller)
        listing_resp = seller_client.post(
            reverse('agents:marketplace-listings'),
            {
                'template_slug': seller_template.slug,
                'title': 'Seller2 Listing',
                'summary': 'x',
                'price_usd': '15.00',
                'billing_cycle': 'one_time',
                'status': 'published',
            },
            format='json',
        )
        self.assertEqual(listing_resp.status_code, status.HTTP_201_CREATED)
        listing_id = listing_resp.data['id']

        buy_resp = self.client.post(reverse('agents:marketplace-purchase', kwargs={'id': listing_id}), {}, format='json')
        self.assertEqual(buy_resp.status_code, status.HTTP_201_CREATED)
        purchase_id = buy_resp.data['id']

        settle_resp = seller_client.post(
            reverse('agents:marketplace-settlement-action', kwargs={'id': purchase_id, 'action': 'settle'}),
            {'payout_reference': 'settle-1'},
            format='json',
        )
        self.assertEqual(settle_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(settle_resp.data['status'], 'settled')

        refund_resp = seller_client.post(
            reverse('agents:marketplace-settlement-action', kwargs={'id': purchase_id, 'action': 'refund'}),
            {},
            format='json',
        )
        self.assertEqual(refund_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(refund_resp.data['status'], 'refunded')

        analytics = seller_client.get(reverse('agents:marketplace-analytics'))
        self.assertEqual(analytics.status_code, status.HTTP_200_OK)
        self.assertIn('gross_revenue_usd', analytics.data)

    def test_connector_reauth_url_endpoint(self):
        connector = AgentConnectorAccount.objects.create(
            user=self.user,
            provider='gmail',
            status='error',
            scopes_json=['openid', 'email'],
            metadata_json={
                'client_id': 'test-client',
                'redirect_uri': 'https://app.example.com/callback',
            },
        )
        resp = self.client.post(reverse('agents:connector-reauth-url', kwargs={'id': connector.id}), {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('reauth_url', resp.data)
