import json
import secrets
import math
import csv
from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from django.db.models import Q, Avg, Sum, Count
from django.http import HttpResponse
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import generics, permissions, status, throttling
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from agents.models import (
    AgentWorkspace,
    AgentWorkspaceMembership,
    AgentPolicyRule,
    AgentWorkflowTemplate,
    AgentWorkflowTemplateVersion,
    AgentWorkflowTrigger,
    AgentWorkflowRun,
    AgentWorkflowApproval,
    AgentMemory,
    AgentConnectorAccount,
    AgentRunMetric,
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
from agents.serializers import (
    AgentWorkspaceSerializer,
    AgentWorkspaceMembershipSerializer,
    AgentPolicyRuleSerializer,
    AgentWorkspaceSSOProviderSerializer,
    AgentWorkspaceAuditEventSerializer,
    AgentWorkflowTemplateSerializer,
    AgentWorkflowTemplateListSerializer,
    AgentWorkflowTemplateVersionSerializer,
    AgentWorkflowTemplateCreateSerializer,
    AgentWorkflowRunSerializer,
    AgentWorkflowRunCreateSerializer,
    AgentWorkflowRunListSerializer,
    AgentApprovalDecisionSerializer,
    AgentWorkflowApprovalSerializer,
    AgentMemorySerializer,
    AgentConnectorAccountSerializer,
    AgentConnectorUpsertSerializer,
    AgentWorkflowTriggerSerializer,
    AgentWorkflowTriggerCreateSerializer,
    AgentDashboardSerializer,
    AgentSLODashboardSerializer,
    AgentTraceDashboardSerializer,
    AgentReliabilityAlertSerializer,
    AgentOrchestrationJobSerializer,
    AgentOrchestrationJobStepSerializer,
    AgentMarketplaceListingSerializer,
    AgentMarketplacePurchaseSerializer,
    AgentMarketplaceSettlementSerializer,
    AgentTemplateMemoryPolicySerializer,
    AgentTemplateEditLockSerializer,
)
from agents.services.crypto import TokenCipher
from agents.services.workflow_engine import WorkflowEngine
from agents.tasks import (
    execute_agent_workflow_run,
    resume_agent_workflow_after_approval,
    dispatch_agent_trigger,
    execute_agent_orchestration_job,
)


def _record_template_snapshot(template: AgentWorkflowTemplate, user, change_note: str = ''):
    snapshot = {
        'name': template.name,
        'slug': template.slug,
        'description': template.description,
        'template_type': template.template_type,
        'version': template.version,
        'definition_json': template.definition_json,
        'default_config_json': template.default_config_json,
        'is_public': template.is_public,
        'is_active': template.is_active,
    }
    AgentWorkflowTemplateVersion.objects.update_or_create(
        template=template,
        version_number=template.version,
        defaults={
            'snapshot_json': snapshot,
            'change_note': change_note,
            'changed_by': user,
        }
    )


ROLE_ORDER = {
    'viewer': 1,
    'editor': 2,
    'admin': 3,
    'owner': 4,
}


def _resolve_workspace_for_request(request):
    workspace_slug = request.headers.get('X-Agent-Workspace') or request.query_params.get('workspace')
    if not workspace_slug:
        return None, None
    workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
    if not workspace:
        return None, Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
    membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
    if not membership:
        return None, Response({'error': 'No workspace access.'}, status=status.HTTP_403_FORBIDDEN)
    return (workspace, membership), None


def _require_workspace_role(membership: AgentWorkspaceMembership, minimum_role: str) -> bool:
    return ROLE_ORDER.get(membership.role, 0) >= ROLE_ORDER.get(minimum_role, 99)


def _get_workspace_policy(workspace: AgentWorkspace, key: str):
    return AgentPolicyRule.objects.filter(workspace=workspace, key=key, is_active=True).first()


def _record_workspace_audit_event(
    *,
    workspace: AgentWorkspace,
    event_type: str,
    actor=None,
    severity: str = 'info',
    object_type: str = '',
    object_id: str = '',
    metadata_json: dict | None = None,
    request=None,
):
    ip_address = ''
    user_agent = ''
    if request is not None:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip_address = (forwarded.split(',')[0] if forwarded else request.META.get('REMOTE_ADDR', ''))[:64]
        user_agent = (request.META.get('HTTP_USER_AGENT', '') or '')[:255]

    AgentWorkspaceAuditEvent.objects.create(
        workspace=workspace,
        actor=actor,
        event_type=event_type,
        severity=severity,
        object_type=object_type,
        object_id=object_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata_json or {},
    )


def _active_template_lock(template: AgentWorkflowTemplate):
    lock = AgentTemplateEditLock.objects.filter(template=template).select_related('locked_by').first()
    if not lock:
        return None
    if lock.expires_at <= timezone.now():
        lock.delete()
        return None
    return lock


class CSVRenderer(BaseRenderer):
    media_type = 'text/csv'
    format = 'csv'
    charset = 'utf-8'
    render_style = 'binary'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b''
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode(self.charset)
        return str(data).encode(self.charset)


class AgentTemplateListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        template_type = request.query_params.get('template_type')
        qs = AgentWorkflowTemplate.objects.filter(is_active=True).filter(
            Q(is_public=True) | Q(created_by=request.user)
        )

        if request.query_params.get('workspace'):
            qs = qs.filter(workspace__slug=request.query_params.get('workspace'))
        if template_type:
            qs = qs.filter(template_type=template_type)

        serializer = AgentWorkflowTemplateListSerializer(qs.order_by('template_type', 'name'), many=True)
        return Response(serializer.data)

    def post(self, request):
        workspace_membership = None
        workspace = None
        workspace_ctx, workspace_error = _resolve_workspace_for_request(request)
        if workspace_error:
            return workspace_error
        if workspace_ctx:
            workspace, workspace_membership = workspace_ctx
            if not _require_workspace_role(workspace_membership, 'editor'):
                return Response({'error': 'Workspace role does not allow template creation.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AgentWorkflowTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        definition_json = serializer.validated_data.get('definition_json') or {}
        steps_count = len((definition_json or {}).get('steps', []))
        if workspace:
            max_steps_policy = _get_workspace_policy(workspace, 'max_steps_per_template')
            if max_steps_policy:
                allowed = int((max_steps_policy.value_json or {}).get('value', 0) or 0)
                if allowed > 0 and steps_count > allowed:
                    return Response(
                        {'error': f'Policy max_steps_per_template exceeded ({steps_count}>{allowed}).'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        slug = serializer.validated_data.get('slug') or slugify(serializer.validated_data['name'])
        if not slug:
            slug = f"agent-{secrets.token_hex(4)}"

        base_slug = slug
        suffix = 1
        while AgentWorkflowTemplate.objects.filter(slug=slug).exists():
            suffix += 1
            slug = f"{base_slug}-{suffix}"

        template = AgentWorkflowTemplate.objects.create(
            **serializer.validated_data,
            slug=slug,
            created_by=request.user,
            workspace=workspace,
        )
        _record_template_snapshot(template, request.user, change_note='initial create')
        if workspace:
            _record_workspace_audit_event(
                workspace=workspace,
                actor=request.user,
                event_type='template.created',
                object_type='template',
                object_id=str(template.id),
                metadata_json={'slug': template.slug, 'name': template.name},
                request=request,
            )
        return Response(AgentWorkflowTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class AgentTemplateDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(
            slug=slug,
            is_active=True,
        ).filter(Q(is_public=True) | Q(created_by=request.user)).first()
        if not template:
            return Response({'error': 'Template not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AgentWorkflowTemplateSerializer(template).data)

    def patch(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user).first()
        if not template:
            return Response({'error': 'Template not found or not editable.'}, status=status.HTTP_404_NOT_FOUND)

        if template.workspace:
            membership = AgentWorkspaceMembership.objects.filter(workspace=template.workspace, user=request.user).first()
            if not membership or not _require_workspace_role(membership, 'editor'):
                return Response({'error': 'Workspace role does not allow template updates.'}, status=status.HTTP_403_FORBIDDEN)

        lock = _active_template_lock(template)
        if lock and lock.locked_by_id != request.user.id:
            return Response(
                {
                    'error': 'Template is locked by another collaborator.',
                    'locked_by': lock.locked_by.email,
                    'expires_at': lock.expires_at,
                },
                status=status.HTTP_409_CONFLICT,
            )

        expected_version = request.headers.get('X-Agent-Template-Version')
        if expected_version:
            try:
                expected = int(expected_version)
                if expected != template.version:
                    return Response(
                        {
                            'error': 'Template version conflict detected.',
                            'current_version': template.version,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
            except ValueError:
                return Response({'error': 'Invalid X-Agent-Template-Version header.'}, status=status.HTTP_400_BAD_REQUEST)

        previous_name = template.name
        previous_description = template.description
        previous_definition = template.definition_json
        previous_default_config = template.default_config_json

        serializer = AgentWorkflowTemplateCreateSerializer(template, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        next_definition = serializer.validated_data.get('definition_json')
        if template.workspace and next_definition:
            max_steps_policy = _get_workspace_policy(template.workspace, 'max_steps_per_template')
            if max_steps_policy:
                allowed = int((max_steps_policy.value_json or {}).get('value', 0) or 0)
                steps_count = len((next_definition or {}).get('steps', []))
                if allowed > 0 and steps_count > allowed:
                    return Response(
                        {'error': f'Policy max_steps_per_template exceeded ({steps_count}>{allowed}).'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        serializer.save()

        bump_version = str(request.query_params.get('bump_version', '')).lower() in ('1', 'true', 'yes', 'on')
        changed = any([
            previous_name != template.name,
            previous_description != template.description,
            previous_definition != template.definition_json,
            previous_default_config != template.default_config_json,
        ])
        if bump_version and changed:
            template.version += 1
            template.save(update_fields=['version', 'updated_at'])

        if changed:
            note = request.data.get('change_note', '') if isinstance(request.data, dict) else ''
            _record_template_snapshot(template, request.user, change_note=note)
            if template.workspace:
                _record_workspace_audit_event(
                    workspace=template.workspace,
                    actor=request.user,
                    event_type='template.updated',
                    object_type='template',
                    object_id=str(template.id),
                    metadata_json={'slug': template.slug, 'version': template.version},
                    request=request,
                )

        return Response(AgentWorkflowTemplateSerializer(template).data)

    def delete(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user).first()
        if not template:
            return Response({'error': 'Template not found or not deletable.'}, status=status.HTTP_404_NOT_FOUND)

        template.is_active = False
        template.save(update_fields=['is_active', 'updated_at'])
        if template.workspace:
            _record_workspace_audit_event(
                workspace=template.workspace,
                actor=request.user,
                event_type='template.deleted',
                object_type='template',
                object_id=str(template.id),
                metadata_json={'slug': template.slug},
                request=request,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AgentWorkflowRunView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AgentWorkflowRun.objects.filter(created_by=request.user).select_related('template')

        status_filter = request.query_params.get('status')
        template_slug = request.query_params.get('template')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if template_slug:
            qs = qs.filter(template__slug=template_slug)

        serializer = AgentWorkflowRunListSerializer(qs.order_by('-created_at')[:200], many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    def post(self, request):
        WorkflowEngine.ensure_default_templates(request.user)

        serializer = AgentWorkflowRunCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        template = AgentWorkflowTemplate.objects.filter(
            slug=serializer.validated_data['template_slug'],
            is_active=True,
        ).filter(Q(is_public=True) | Q(created_by=request.user)).first()

        if not template:
            return Response({'error': 'Template not found or unavailable.'}, status=status.HTTP_404_NOT_FOUND)

        run = AgentWorkflowRun.objects.create(
            template=template,
            created_by=request.user,
            trigger_type=serializer.validated_data['trigger_type'],
            input_payload_json=serializer.validated_data.get('input_payload_json', {}),
            run_context_json={'requested_at': timezone.now().isoformat()},
        )

        execute_agent_workflow_run.delay(str(run.id))
        return Response(AgentWorkflowRunSerializer(run).data, status=status.HTTP_201_CREATED)


class AgentTemplateVersionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user).first()
        if not template:
            return Response({'error': 'Template not found or not accessible.'}, status=status.HTTP_404_NOT_FOUND)

        versions = AgentWorkflowTemplateVersion.objects.filter(template=template).order_by('-version_number', '-created_at')
        return Response(AgentWorkflowTemplateVersionSerializer(versions, many=True).data)


class AgentTemplateRollbackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, version_number):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user).first()
        if not template:
            return Response({'error': 'Template not found or not editable.'}, status=status.HTTP_404_NOT_FOUND)

        version = AgentWorkflowTemplateVersion.objects.filter(
            template=template,
            version_number=version_number,
        ).first()
        if not version:
            return Response({'error': 'Version not found.'}, status=status.HTTP_404_NOT_FOUND)

        snapshot = version.snapshot_json or {}
        template.name = snapshot.get('name', template.name)
        template.description = snapshot.get('description', template.description)
        template.template_type = snapshot.get('template_type', template.template_type)
        template.definition_json = snapshot.get('definition_json', template.definition_json)
        template.default_config_json = snapshot.get('default_config_json', template.default_config_json)
        template.is_public = snapshot.get('is_public', template.is_public)
        template.is_active = snapshot.get('is_active', template.is_active)
        template.version = template.version + 1
        template.save(update_fields=[
            'name', 'description', 'template_type',
            'definition_json', 'default_config_json',
            'is_public', 'is_active', 'version', 'updated_at',
        ])

        _record_template_snapshot(
            template,
            request.user,
            change_note=f'rollback from v{version_number}'
        )
        return Response(AgentWorkflowTemplateSerializer(template).data)


class AgentTemplateLockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user, is_active=True).first()
        if not template:
            return Response({'error': 'Template not found or not lockable.'}, status=status.HTTP_404_NOT_FOUND)

        lock_minutes = int(request.data.get('lock_minutes', 15) or 15)
        lock_minutes = max(1, min(lock_minutes, 120))
        expires_at = timezone.now() + timedelta(minutes=lock_minutes)

        lock = _active_template_lock(template)
        if lock and lock.locked_by_id != request.user.id:
            return Response({'error': 'Template already locked by another user.'}, status=status.HTTP_409_CONFLICT)

        lock, _ = AgentTemplateEditLock.objects.update_or_create(
            template=template,
            defaults={
                'locked_by': request.user,
                'base_version': template.version,
                'expires_at': expires_at,
            },
        )
        return Response(AgentTemplateEditLockSerializer(lock).data)


class AgentTemplateUnlockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user, is_active=True).first()
        if not template:
            return Response({'error': 'Template not found or not unlockable.'}, status=status.HTTP_404_NOT_FOUND)
        lock = AgentTemplateEditLock.objects.filter(template=template, locked_by=request.user).first()
        if lock:
            lock.delete()
        return Response({'ok': True})


class AgentTemplateMemoryPolicyListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, is_active=True).filter(
            Q(created_by=request.user) | Q(is_public=True)
        ).first()
        if not template:
            return Response({'error': 'Template not found.'}, status=status.HTTP_404_NOT_FOUND)
        qs = AgentTemplateMemoryPolicy.objects.filter(template=template).order_by('key')
        return Response(AgentTemplateMemoryPolicySerializer(qs, many=True).data)

    def post(self, request, slug):
        template = AgentWorkflowTemplate.objects.filter(slug=slug, created_by=request.user, is_active=True).first()
        if not template:
            return Response({'error': 'Template not found or not editable.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AgentTemplateMemoryPolicySerializer(data={**request.data, 'template': str(template.id)})
        serializer.is_valid(raise_exception=True)
        policy, _ = AgentTemplateMemoryPolicy.objects.update_or_create(
            template=template,
            key=serializer.validated_data['key'],
            defaults={
                'value_json': serializer.validated_data.get('value_json', {}),
                'is_active': serializer.validated_data.get('is_active', True),
                'updated_by': request.user,
            },
        )
        return Response(AgentTemplateMemoryPolicySerializer(policy).data, status=status.HTTP_201_CREATED)


class AgentWorkflowRunDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AgentWorkflowRunSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return AgentWorkflowRun.objects.filter(created_by=self.request.user).select_related('template').prefetch_related('step_runs', 'approvals', 'metrics')


class AgentWorkflowRunCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, run_id):
        run = AgentWorkflowRun.objects.filter(id=run_id, created_by=request.user).first()
        if not run:
            return Response({'error': 'Run not found.'}, status=status.HTTP_404_NOT_FOUND)

        if run.status in ('succeeded', 'failed', 'cancelled'):
            return Response({'error': f'Run already {run.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        run.status = 'cancelled'
        run.finished_at = timezone.now()
        if run.started_at:
            run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
        run.save(update_fields=['status', 'finished_at', 'duration_ms'])
        return Response({'ok': True, 'status': run.status})


class AgentApprovalListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AgentWorkflowApprovalSerializer

    def get_queryset(self):
        return AgentWorkflowApproval.objects.filter(run__created_by=self.request.user).select_related('step_run', 'run').order_by('-requested_at')


class AgentApprovalApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, approval_id):
        approval = AgentWorkflowApproval.objects.filter(id=approval_id, run__created_by=request.user).select_related('run').first()
        if not approval:
            return Response({'error': 'Approval not found.'}, status=status.HTTP_404_NOT_FOUND)

        if approval.status != 'pending':
            return Response({'error': 'Approval is already resolved.'}, status=status.HTTP_400_BAD_REQUEST)

        decision = AgentApprovalDecisionSerializer(data=request.data)
        decision.is_valid(raise_exception=True)

        approval.status = 'approved'
        approval.reviewed_by = request.user
        approval.review_notes = decision.validated_data.get('review_notes', '')
        approval.reviewed_at = timezone.now()
        approval.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at'])

        approval.step_run.status = 'queued'
        approval.step_run.save(update_fields=['status'])

        resume_agent_workflow_after_approval.delay(str(approval.id))
        return Response({'ok': True, 'status': approval.status})


class AgentApprovalRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, approval_id):
        approval = AgentWorkflowApproval.objects.filter(id=approval_id, run__created_by=request.user).select_related('run').first()
        if not approval:
            return Response({'error': 'Approval not found.'}, status=status.HTTP_404_NOT_FOUND)

        if approval.status != 'pending':
            return Response({'error': 'Approval is already resolved.'}, status=status.HTTP_400_BAD_REQUEST)

        decision = AgentApprovalDecisionSerializer(data=request.data)
        decision.is_valid(raise_exception=True)

        approval.status = 'rejected'
        approval.reviewed_by = request.user
        approval.review_notes = decision.validated_data.get('review_notes', '')
        approval.reviewed_at = timezone.now()
        approval.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at'])

        run = approval.run
        run.status = 'failed'
        run.error_summary = f"Approval rejected at step: {approval.step_run.step_key}"
        run.finished_at = timezone.now()
        if run.started_at:
            run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
        run.save(update_fields=['status', 'error_summary', 'finished_at', 'duration_ms'])
        return Response({'ok': True, 'status': approval.status})


class AgentMemoryListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        owner_type = request.query_params.get('owner_type', 'user')
        owner_id = request.query_params.get('owner_id', str(request.user.id))

        memories = AgentMemory.objects.filter(
            owner_type=owner_type,
            owner_id=owner_id,
            created_by=request.user,
        ).order_by('memory_type', 'key')

        return Response(AgentMemorySerializer(memories, many=True).data)

    def post(self, request):
        serializer = AgentMemorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        memory = serializer.save(created_by=request.user)
        return Response(AgentMemorySerializer(memory).data, status=status.HTTP_201_CREATED)


class AgentMemoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AgentMemorySerializer
    lookup_field = 'id'

    def get_queryset(self):
        return AgentMemory.objects.filter(created_by=self.request.user)


class AgentConnectorListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        connectors = AgentConnectorAccount.objects.filter(user=request.user).order_by('provider', '-updated_at')
        return Response(AgentConnectorAccountSerializer(connectors, many=True).data)

    def post(self, request):
        serializer = AgentConnectorUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        existing_metadata = serializer.validated_data.get('metadata', {}) or {}
        refresh_token_present = bool(serializer.validated_data.get('refresh_token', ''))
        if 'refresh_token_present' not in existing_metadata:
            existing_metadata['refresh_token_present'] = refresh_token_present

        token_bundle = {
            'access_token': serializer.validated_data.get('token', ''),
            'refresh_token': serializer.validated_data.get('refresh_token', ''),
        }

        connector, _ = AgentConnectorAccount.objects.update_or_create(
            user=request.user,
            provider=serializer.validated_data['provider'],
            defaults={
                'status': 'connected',
                'external_account_id': serializer.validated_data.get('external_account_id', ''),
                'base_url': serializer.validated_data.get('base_url', ''),
                'scopes_json': serializer.validated_data.get('scopes', []),
                'metadata_json': existing_metadata,
                'encrypted_tokens_json': TokenCipher.encrypt(json.dumps(token_bundle)),
                'last_sync_at': timezone.now(),
            },
        )

        return Response(AgentConnectorAccountSerializer(connector).data, status=status.HTTP_201_CREATED)


class AgentConnectorDetailView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return AgentConnectorAccount.objects.filter(user=self.request.user)


class AgentConnectorReauthUrlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        connector = AgentConnectorAccount.objects.filter(id=id, user=request.user).first()
        if not connector:
            return Response({'error': 'Connector not found.'}, status=status.HTTP_404_NOT_FOUND)

        meta = connector.metadata_json or {}
        authorize_url = meta.get('authorize_url')
        if not authorize_url:
            provider = connector.provider.upper()
            client_id = meta.get('client_id') or getattr(settings, f'{provider}_OAUTH_CLIENT_ID', '')
            redirect_uri = meta.get('redirect_uri') or request.build_absolute_uri('/api/auth/google/')
            scopes = ' '.join(meta.get('scopes', connector.scopes_json or []))
            if connector.provider in ('gmail', 'google_calendar') and client_id:
                authorize_url = (
                    'https://accounts.google.com/o/oauth2/v2/auth'
                    f'?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scopes}'
                )
            elif connector.provider == 'outlook' and client_id:
                authorize_url = (
                    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
                    f'?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scopes}'
                )

        if not authorize_url:
            return Response({'error': 'Reauth URL is not configured for this connector.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'provider': connector.provider, 'reauth_url': authorize_url})


class AgentTriggerListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        triggers = AgentWorkflowTrigger.objects.filter(owner=request.user).select_related('template').order_by('-created_at')
        return Response(AgentWorkflowTriggerSerializer(triggers, many=True).data)

    def post(self, request):
        serializer = AgentWorkflowTriggerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        template = AgentWorkflowTemplate.objects.filter(
            slug=serializer.validated_data['template_slug'],
            is_active=True,
        ).filter(Q(is_public=True) | Q(created_by=request.user)).first()

        if not template:
            return Response({'error': 'Template not found or unavailable.'}, status=status.HTTP_404_NOT_FOUND)

        trigger = AgentWorkflowTrigger.objects.create(
            owner=request.user,
            template=template,
            name=serializer.validated_data['name'],
            trigger_type=serializer.validated_data['trigger_type'],
            is_active=serializer.validated_data.get('is_active', True),
            schedule_every_minutes=serializer.validated_data.get('schedule_every_minutes'),
            input_defaults_json=serializer.validated_data.get('input_defaults_json', {}),
            webhook_secret=serializer.validated_data.get('webhook_secret', ''),
        )
        return Response(AgentWorkflowTriggerSerializer(trigger).data, status=status.HTTP_201_CREATED)


class AgentTriggerDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, id):
        trigger = AgentWorkflowTrigger.objects.filter(id=id, owner=request.user).first()
        if not trigger:
            return Response({'error': 'Trigger not found.'}, status=status.HTTP_404_NOT_FOUND)

        mutable_fields = {
            'name', 'is_active', 'schedule_every_minutes', 'input_defaults_json', 'webhook_secret'
        }
        changed = []
        for key, value in request.data.items():
            if key in mutable_fields:
                setattr(trigger, key, value)
                changed.append(key)

        if changed:
            changed.append('updated_at')
            trigger.save(update_fields=changed)

        return Response(AgentWorkflowTriggerSerializer(trigger).data)

    def delete(self, request, id):
        trigger = AgentWorkflowTrigger.objects.filter(id=id, owner=request.user).first()
        if not trigger:
            return Response({'error': 'Trigger not found.'}, status=status.HTTP_404_NOT_FOUND)
        trigger.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AgentTriggerRotateSecretView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        trigger = AgentWorkflowTrigger.objects.filter(id=id, owner=request.user, trigger_type='webhook').first()
        if not trigger:
            return Response({'error': 'Webhook trigger not found.'}, status=status.HTTP_404_NOT_FOUND)

        trigger.webhook_secret = secrets.token_urlsafe(24)
        trigger.save(update_fields=['webhook_secret', 'updated_at'])
        return Response({'ok': True, 'webhook_secret': trigger.webhook_secret})


class AgentWebhookTriggerInvokeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, webhook_key):
        trigger = AgentWorkflowTrigger.objects.filter(
            webhook_key=webhook_key,
            trigger_type='webhook',
            is_active=True,
            template__is_active=True,
        ).select_related('template', 'owner').first()

        if not trigger:
            return Response({'error': 'Webhook trigger not found.'}, status=status.HTTP_404_NOT_FOUND)

        provided_secret = request.headers.get('X-Sovereign-Webhook-Secret', '')
        if trigger.webhook_secret and provided_secret != trigger.webhook_secret:
            return Response({'error': 'Invalid webhook secret.'}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data if isinstance(request.data, dict) else {}
        dispatch_agent_trigger.delay(str(trigger.id), payload=payload, trigger_source='api')
        return Response({'ok': True, 'queued': True})


class AgentToolListView(APIView):
    """List all available tools for the workflow builder."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from agents.services.tool_registry import list_tools
        return Response(list_tools())


class AgentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        runs = AgentWorkflowRun.objects.filter(created_by=request.user)
        metrics_qs = AgentRunMetric.objects.filter(run__created_by=request.user)
        pending_approvals = AgentWorkflowApproval.objects.filter(run__created_by=request.user, status='pending').count()

        total_runs = runs.count()
        success_runs = runs.filter(status='succeeded').count()
        failed_runs = runs.filter(status='failed').count()
        avg_duration = runs.exclude(duration_ms=0).aggregate(avg=Avg('duration_ms')).get('avg') or 0

        metrics = metrics_qs.aggregate(
            total_tokens=Sum('total_tokens'),
            estimated_cost=Sum('estimated_cost_usd'),
        )

        payload = {
            'total_runs': total_runs,
            'success_runs': success_runs,
            'failed_runs': failed_runs,
            'avg_duration_ms': float(avg_duration),
            'total_tokens': int(metrics.get('total_tokens') or 0),
            'estimated_cost_usd': float(metrics.get('estimated_cost') or 0),
            'pending_approvals': pending_approvals,
        }

        return Response(AgentDashboardSerializer(payload).data)


class AgentSLODashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _percentile(values, pct: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        idx = max(0, min(len(ordered) - 1, math.ceil((pct / 100.0) * len(ordered)) - 1))
        return float(ordered[idx])

    def get(self, request):
        now = timezone.now()
        window_hours = int(request.query_params.get('window_hours', 24) or 24)
        window_hours = max(1, min(window_hours, 24 * 14))
        since = now - timedelta(hours=window_hours)

        target_success_rate = float(getattr(settings, 'AGENT_SLO_TARGET_SUCCESS_RATE', 0.99))

        runs = AgentWorkflowRun.objects.filter(created_by=request.user, created_at__gte=since)
        total_runs = runs.count()
        success_runs = runs.filter(status='succeeded').count()
        failed_runs = runs.filter(status='failed').count()
        success_rate = (success_runs / total_runs) if total_runs else 1.0

        allowed_failure = max(1.0 - target_success_rate, 0.0001)
        observed_failure = (failed_runs / total_runs) if total_runs else 0.0
        consumed_ratio = observed_failure / allowed_failure
        error_budget_remaining_percent = max(0.0, 100.0 * (1.0 - consumed_ratio))

        durations = list(
            runs.exclude(duration_ms=0).values_list('duration_ms', flat=True)
        )
        p95_duration_ms = self._percentile(durations, 95.0)

        open_alerts = AgentReliabilityAlert.objects.filter(user=request.user, status='open')
        open_alerts_total = open_alerts.count()
        open_critical_alerts = open_alerts.filter(severity='critical').count()

        resolved_alerts = AgentReliabilityAlert.objects.filter(
            user=request.user,
            resolved_at__isnull=False,
            created_at__gte=since,
        )
        mttr_values = []
        for alert in resolved_alerts:
            if alert.resolved_at and alert.created_at:
                mttr_values.append((alert.resolved_at - alert.created_at).total_seconds() / 60.0)
        mean_time_to_resolve_minutes = (sum(mttr_values) / len(mttr_values)) if mttr_values else 0.0

        all_alerts_window = AgentReliabilityAlert.objects.filter(user=request.user, created_at__gte=since)
        delivered_alert_notifications = 0
        for alert in all_alerts_window:
            delivered = (alert.context_json or {}).get('delivered_channels', [])
            if delivered:
                delivered_alert_notifications += 1
        notification_delivery_rate = (
            delivered_alert_notifications / all_alerts_window.count()
            if all_alerts_window.exists() else 0.0
        )

        uptime_timeseries = []
        for days_ago in range(6, -1, -1):
            day_start = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_runs = AgentWorkflowRun.objects.filter(created_by=request.user, created_at__gte=day_start, created_at__lt=day_end)
            day_total = day_runs.count()
            day_success = day_runs.filter(status='succeeded').count()
            uptime_timeseries.append({
                'date': day_start.date().isoformat(),
                'success_rate': round((day_success / day_total), 4) if day_total else 1.0,
                'total_runs': day_total,
            })

        payload = {
            'window_hours': window_hours,
            'total_runs': total_runs,
            'success_runs': success_runs,
            'failed_runs': failed_runs,
            'success_rate': round(success_rate, 6),
            'target_success_rate': round(target_success_rate, 6),
            'error_budget_remaining_percent': round(error_budget_remaining_percent, 2),
            'p95_duration_ms': round(p95_duration_ms, 2),
            'mean_time_to_resolve_minutes': round(mean_time_to_resolve_minutes, 2),
            'open_alerts_total': open_alerts_total,
            'open_critical_alerts': open_critical_alerts,
            'delivered_alert_notifications': delivered_alert_notifications,
            'notification_delivery_rate': round(notification_delivery_rate, 6),
            'uptime_timeseries': uptime_timeseries,
        }

        return Response(AgentSLODashboardSerializer(payload).data)


class AgentTraceDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get('limit', 50) or 50)
        limit = max(1, min(limit, 200))

        base_qs = AgentWorkflowRun.objects.filter(created_by=request.user)
        runs = base_qs.select_related('template').annotate(
            external_actions_count=Count('external_actions')
        ).order_by('-created_at')[:limit]

        traces = []
        for run in runs:
            context = run.run_context_json or {}
            traces.append({
                'run_id': run.id,
                'template_slug': run.template.slug,
                'status': run.status,
                'trigger_type': run.trigger_type,
                'created_at': run.created_at,
                'trigger_id': context.get('trigger_id'),
                'orchestration_job_id': context.get('orchestration_job_id'),
                'orchestration_step_id': context.get('orchestration_step_id'),
                'retrieved_memory_count': int(context.get('retrieved_memory_count') or 0),
                'external_actions_count': int(getattr(run, 'external_actions_count', 0) or 0),
                'error_summary': (run.error_summary or '')[:300],
            })

        payload = {
            'total_runs': base_qs.count(),
            'failed_runs': base_qs.filter(status='failed').count(),
            'waiting_approval_runs': base_qs.filter(status='waiting_approval').count(),
            'traces': traces,
        }
        return Response(AgentTraceDashboardSerializer(payload).data)


class AgentReliabilityAlertListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AgentReliabilityAlert.objects.filter(user=request.user).order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(AgentReliabilityAlertSerializer(qs[:200], many=True).data)


class AgentReliabilityAlertResolveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        alert = AgentReliabilityAlert.objects.filter(id=id, user=request.user).first()
        if not alert:
            return Response({'error': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)

        if alert.status != 'resolved':
            alert.status = 'resolved'
            alert.resolved_at = timezone.now()
            alert.save(update_fields=['status', 'resolved_at', 'updated_at'])

        return Response({'ok': True, 'status': alert.status})


class AgentWorkspaceListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = AgentWorkspaceMembership.objects.filter(user=request.user).select_related('workspace')
        workspaces = [m.workspace for m in memberships if m.workspace and m.workspace.is_active]
        return Response(AgentWorkspaceSerializer(workspaces, many=True).data)

    def post(self, request):
        serializer = AgentWorkspaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = serializer.save(created_by=request.user)
        AgentWorkspaceMembership.objects.get_or_create(
            workspace=workspace,
            user=request.user,
            defaults={'role': 'owner'},
        )
        _record_workspace_audit_event(
            workspace=workspace,
            actor=request.user,
            event_type='workspace.created',
            object_type='workspace',
            object_id=str(workspace.id),
            request=request,
        )
        return Response(AgentWorkspaceSerializer(workspace).data, status=status.HTTP_201_CREATED)


class AgentWorkspaceMembershipListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership:
            return Response({'error': 'No workspace access.'}, status=status.HTTP_403_FORBIDDEN)
        qs = AgentWorkspaceMembership.objects.filter(workspace=workspace).select_related('user').order_by('role', 'created_at')
        return Response(AgentWorkspaceMembershipSerializer(qs, many=True).data)

    def post(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership or not _require_workspace_role(membership, 'admin'):
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = AgentWorkspaceMembershipSerializer(data={
            **request.data,
            'workspace': str(workspace.id),
        })
        serializer.is_valid(raise_exception=True)
        member, _ = AgentWorkspaceMembership.objects.update_or_create(
            workspace=workspace,
            user=serializer.validated_data['user'],
            defaults={'role': serializer.validated_data['role']},
        )
        _record_workspace_audit_event(
            workspace=workspace,
            actor=request.user,
            event_type='workspace.member.upserted',
            object_type='membership',
            object_id=str(member.id),
            metadata_json={'role': member.role, 'user_id': str(member.user_id)},
            request=request,
        )
        return Response(AgentWorkspaceMembershipSerializer(member).data, status=status.HTTP_201_CREATED)


class AgentWorkspacePolicyListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership:
            return Response({'error': 'No workspace access.'}, status=status.HTTP_403_FORBIDDEN)
        rules = AgentPolicyRule.objects.filter(workspace=workspace).order_by('key')
        return Response(AgentPolicyRuleSerializer(rules, many=True).data)

    def post(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership or not _require_workspace_role(membership, 'admin'):
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AgentPolicyRuleSerializer(data={
            **request.data,
            'workspace': str(workspace.id),
        })
        serializer.is_valid(raise_exception=True)
        rule, _ = AgentPolicyRule.objects.update_or_create(
            workspace=workspace,
            key=serializer.validated_data['key'],
            defaults={
                'value_json': serializer.validated_data['value_json'],
                'is_active': serializer.validated_data.get('is_active', True),
                'created_by': request.user,
            },
        )
        _record_workspace_audit_event(
            workspace=workspace,
            actor=request.user,
            event_type='workspace.policy.updated',
            object_type='policy_rule',
            object_id=str(rule.id),
            metadata_json={'key': rule.key},
            request=request,
        )
        return Response(AgentPolicyRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class AgentWorkspaceIdentityProviderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership:
            return Response({'error': 'No workspace access.'}, status=status.HTTP_403_FORBIDDEN)
        qs = AgentWorkspaceSSOProvider.objects.filter(workspace=workspace).order_by('name')
        return Response(AgentWorkspaceSSOProviderSerializer(qs, many=True).data)

    def post(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership or not _require_workspace_role(membership, 'admin'):
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AgentWorkspaceSSOProviderSerializer(data={**request.data, 'workspace': str(workspace.id)})
        serializer.is_valid(raise_exception=True)
        provider, _ = AgentWorkspaceSSOProvider.objects.update_or_create(
            workspace=workspace,
            slug=serializer.validated_data['slug'],
            defaults={
                'name': serializer.validated_data['name'],
                'provider_type': serializer.validated_data.get('provider_type', 'oidc'),
                'assertion_secret': serializer.validated_data['assertion_secret'],
                'config_json': serializer.validated_data.get('config_json', {}),
                'is_active': serializer.validated_data.get('is_active', True),
                'created_by': request.user,
            },
        )
        _record_workspace_audit_event(
            workspace=workspace,
            actor=request.user,
            event_type='workspace.identity_provider.upserted',
            object_type='sso_provider',
            object_id=str(provider.id),
            metadata_json={'provider_slug': provider.slug, 'provider_type': provider.provider_type},
            request=request,
        )
        return Response(AgentWorkspaceSSOProviderSerializer(provider).data, status=status.HTTP_201_CREATED)


class AgentWorkspaceSSOAssertionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [throttling.AnonRateThrottle]

    def post(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        provider_slug = request.data.get('provider_slug', '')
        assertion_secret = request.data.get('assertion_secret', '')
        email = request.data.get('email', '')
        role = request.data.get('role', 'viewer')

        provider = AgentWorkspaceSSOProvider.objects.filter(
            workspace=workspace,
            slug=provider_slug,
            is_active=True,
        ).first()
        if not provider:
            return Response({'error': 'Identity provider not found.'}, status=status.HTTP_404_NOT_FOUND)

        import hmac
        if not hmac.compare_digest(provider.assertion_secret, assertion_secret):
            return Response({'error': 'Invalid assertion secret.'}, status=status.HTTP_403_FORBIDDEN)
        if not email:
            return Response({'error': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.models import User

        username = (email.split('@')[0] or 'user')[:120]
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'first_name': request.data.get('first_name', ''),
                'last_name': request.data.get('last_name', ''),
                'is_verified': True,
            },
        )

        if role not in dict(AgentWorkspaceMembership.ROLE_CHOICES):
            role = 'viewer'

        membership, _ = AgentWorkspaceMembership.objects.update_or_create(
            workspace=workspace,
            user=user,
            defaults={'role': role},
        )

        _record_workspace_audit_event(
            workspace=workspace,
            actor=user,
            event_type='workspace.sso.login',
            object_type='membership',
            object_id=str(membership.id),
            metadata_json={'provider_slug': provider.slug, 'provider_type': provider.provider_type, 'role': membership.role},
            request=request,
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            'user_id': str(user.id),
            'workspace': workspace.slug,
            'role': membership.role,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class AgentWorkspaceAuditEventListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership or not _require_workspace_role(membership, 'admin'):
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)

        qs = AgentWorkspaceAuditEvent.objects.filter(workspace=workspace).order_by('-created_at')
        event_type = request.query_params.get('event_type')
        severity = request.query_params.get('severity')
        if event_type:
            qs = qs.filter(event_type=event_type)
        if severity:
            qs = qs.filter(severity=severity)
        return Response(AgentWorkspaceAuditEventSerializer(qs[:500], many=True).data)


class AgentWorkspaceAuditExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer, CSVRenderer]
    format_kwarg = None

    def get(self, request, workspace_slug):
        workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
        if not workspace:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug).first()
        if not workspace:
            return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
        if not membership or not _require_workspace_role(membership, 'admin'):
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)

        export_format = (request.query_params.get('format') or 'json').lower()
        events = AgentWorkspaceAuditEvent.objects.filter(workspace=workspace).order_by('-created_at')[:5000]

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{workspace.slug}-audit.csv"'
            writer = csv.writer(response)
            writer.writerow(['id', 'created_at', 'event_type', 'severity', 'actor', 'object_type', 'object_id', 'ip_address'])
            for e in events:
                writer.writerow([
                    str(e.id),
                    e.created_at.isoformat(),
                    e.event_type,
                    e.severity,
                    e.actor.email if e.actor else '',
                    e.object_type,
                    e.object_id,
                    e.ip_address,
                ])
            return response

        payload = AgentWorkspaceAuditEventSerializer(events, many=True).data
        return Response({'workspace': workspace.slug, 'count': len(payload), 'events': payload})


class AgentOrchestrationJobListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AgentOrchestrationJob.objects.filter(created_by=request.user).prefetch_related('steps').order_by('-created_at')
        return Response(AgentOrchestrationJobSerializer(qs[:100], many=True).data)

    def post(self, request):
        name = request.data.get('name', 'Untitled orchestration')
        steps = request.data.get('steps', []) if isinstance(request.data, dict) else []
        workspace_slug = request.data.get('workspace_slug') if isinstance(request.data, dict) else None

        workspace = None
        if workspace_slug:
            workspace = AgentWorkspace.objects.filter(slug=workspace_slug, is_active=True).first()
            if not workspace:
                return Response({'error': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
            membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
            if not membership or not _require_workspace_role(membership, 'editor'):
                return Response({'error': 'Workspace role does not allow orchestration creation.'}, status=status.HTTP_403_FORBIDDEN)

        if not isinstance(steps, list) or not steps:
            return Response({'error': 'steps list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        job = AgentOrchestrationJob.objects.create(
            name=name,
            status='draft',
            definition_json={'steps': steps},
            workspace=workspace,
            created_by=request.user,
        )

        for idx, step in enumerate(steps, start=1):
            template_slug = step.get('template_slug') if isinstance(step, dict) else None
            if not template_slug:
                job.delete()
                return Response({'error': f'steps[{idx}] missing template_slug'}, status=status.HTTP_400_BAD_REQUEST)

            template = AgentWorkflowTemplate.objects.filter(slug=template_slug, is_active=True).filter(
                Q(is_public=True) | Q(created_by=request.user)
            ).first()
            if not template:
                job.delete()
                return Response({'error': f'Template not found: {template_slug}'}, status=status.HTTP_404_NOT_FOUND)

            AgentOrchestrationJobStep.objects.create(
                job=job,
                sequence=idx,
                name=step.get('name') or f'step_{idx}',
                template=template,
                status='pending',
                input_payload_json=step.get('input_payload_json') if isinstance(step, dict) else {},
                depends_on_json=(step.get('depends_on_json') if isinstance(step, dict) else None) or [],
                run_if_json=(step.get('run_if_json') if isinstance(step, dict) else None) or {},
                requires_approval=bool(step.get('requires_approval', False)) if isinstance(step, dict) else False,
            )

        if workspace:
            _record_workspace_audit_event(
                workspace=workspace,
                actor=request.user,
                event_type='orchestration.created',
                object_type='orchestration_job',
                object_id=str(job.id),
                metadata_json={'steps_count': len(steps)},
                request=request,
            )

        return Response(AgentOrchestrationJobSerializer(job).data, status=status.HTTP_201_CREATED)


class AgentOrchestrationJobDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AgentOrchestrationJobSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return AgentOrchestrationJob.objects.filter(created_by=self.request.user).prefetch_related('steps')


class AgentOrchestrationJobExecuteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        job = AgentOrchestrationJob.objects.filter(id=id, created_by=request.user).first()
        if not job:
            return Response({'error': 'Orchestration job not found.'}, status=status.HTTP_404_NOT_FOUND)
        if job.status == 'running':
            return Response({'error': 'Orchestration already running.'}, status=status.HTTP_400_BAD_REQUEST)

        job.status = 'queued'
        job.save(update_fields=['status', 'updated_at'])
        execute_agent_orchestration_job.delay(str(job.id))
        if job.workspace:
            _record_workspace_audit_event(
                workspace=job.workspace,
                actor=request.user,
                event_type='orchestration.executed',
                object_type='orchestration_job',
                object_id=str(job.id),
                request=request,
            )
        return Response({'ok': True, 'status': job.status})


class AgentOrchestrationJobStepApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id, step_id):
        job = AgentOrchestrationJob.objects.filter(id=id, created_by=request.user).first()
        if not job:
            return Response({'error': 'Orchestration job not found.'}, status=status.HTTP_404_NOT_FOUND)
        step = AgentOrchestrationJobStep.objects.filter(id=step_id, job=job).first()
        if not step:
            return Response({'error': 'Orchestration step not found.'}, status=status.HTTP_404_NOT_FOUND)
        if step.status != 'awaiting_approval':
            return Response({'error': 'Step is not awaiting approval.'}, status=status.HTTP_400_BAD_REQUEST)

        step.approved_by = request.user
        step.approved_at = timezone.now()
        step.status = 'queued'
        step.save(update_fields=['approved_by', 'approved_at', 'status', 'updated_at'])

        job.status = 'queued'
        job.save(update_fields=['status', 'updated_at'])
        execute_agent_orchestration_job.delay(str(job.id))
        return Response({'ok': True, 'step_status': step.status, 'job_status': job.status})


class AgentMarketplaceListingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        listing = AgentMarketplaceListing.objects.select_related('template', 'published_by').filter(id=id).first()
        if not listing:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
        from agents.serializers import AgentMarketplaceListingDetailSerializer
        return Response(AgentMarketplaceListingDetailSerializer(listing).data)


class AgentMarketplaceListingListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AgentMarketplaceListing.objects.filter(status='published').select_related('template', 'published_by').order_by('-created_at')
        return Response(AgentMarketplaceListingSerializer(qs[:200], many=True).data)

    def post(self, request):
        template_slug = request.data.get('template_slug') if isinstance(request.data, dict) else None
        template = AgentWorkflowTemplate.objects.filter(slug=template_slug, created_by=request.user, is_active=True).first()
        if not template:
            return Response({'error': 'Template not found or not owned by user.'}, status=status.HTTP_404_NOT_FOUND)

        if template.workspace:
            membership = AgentWorkspaceMembership.objects.filter(workspace=template.workspace, user=request.user).first()
            if not membership or not _require_workspace_role(membership, 'admin'):
                return Response({'error': 'Admin role required for workspace template publishing.'}, status=status.HTTP_403_FORBIDDEN)

        listing, _ = AgentMarketplaceListing.objects.update_or_create(
            template=template,
            defaults={
                'published_by': request.user,
                'title': request.data.get('title') or template.name,
                'summary': request.data.get('summary', ''),
                'price_usd': request.data.get('price_usd', 0),
                'billing_cycle': request.data.get('billing_cycle', 'one_time'),
                'status': request.data.get('status', 'published'),
            },
        )
        if template.workspace:
            _record_workspace_audit_event(
                workspace=template.workspace,
                actor=request.user,
                event_type='marketplace.listing.published',
                object_type='marketplace_listing',
                object_id=str(listing.id),
                metadata_json={'template_slug': template.slug, 'price_usd': str(listing.price_usd)},
                request=request,
            )
        return Response(AgentMarketplaceListingSerializer(listing).data, status=status.HTTP_201_CREATED)


class AgentMarketplacePurchaseCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        listing = AgentMarketplaceListing.objects.filter(id=id, status='published').select_related('template', 'published_by').first()
        if not listing:
            return Response({'error': 'Marketplace listing not found.'}, status=status.HTTP_404_NOT_FOUND)
        if listing.published_by_id == request.user.id:
            return Response({'error': 'Cannot purchase your own listing.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = AgentMarketplacePurchase.objects.filter(listing=listing, buyer=request.user, status='active').first()
        if existing:
            return Response(AgentMarketplacePurchaseSerializer(existing).data)

        source_template = listing.template
        clone_slug_base = f"{source_template.slug}-market-{str(request.user.id)[:8]}"
        clone_slug = clone_slug_base
        suffix = 1
        while AgentWorkflowTemplate.objects.filter(slug=clone_slug).exists():
            suffix += 1
            clone_slug = f"{clone_slug_base}-{suffix}"

        cloned = AgentWorkflowTemplate.objects.create(
            name=f"{source_template.name} (Marketplace)",
            slug=clone_slug,
            description=source_template.description,
            template_type=source_template.template_type,
            version=1,
            definition_json=source_template.definition_json,
            default_config_json=source_template.default_config_json,
            is_public=False,
            is_active=True,
            created_by=request.user,
            workspace=None,
        )
        _record_template_snapshot(cloned, request.user, change_note='marketplace purchase clone')

        purchase = AgentMarketplacePurchase.objects.create(
            listing=listing,
            buyer=request.user,
            purchased_template=cloned,
            amount_usd=listing.price_usd,
            status='active',
        )

        platform_fee = (Decimal(listing.price_usd) * Decimal('0.10')).quantize(Decimal('0.01'))
        net_amount = (Decimal(listing.price_usd) - platform_fee).quantize(Decimal('0.01'))
        settlement = AgentMarketplaceSettlement.objects.create(
            purchase=purchase,
            status='pending',
            amount_gross_usd=listing.price_usd,
            platform_fee_usd=platform_fee,
            amount_net_usd=net_amount,
            payout_provider='internal',
        )

        try:
            from payments.models import Payment

            Payment.objects.update_or_create(
                polar_transaction_id=f'agent-marketplace-{purchase.id}',
                defaults={
                    'user': request.user,
                    'subscription': None,
                    'polar_checkout_id': f'agent-marketplace-{listing.id}',
                    'amount': listing.price_usd,
                    'currency': 'USD',
                    'status': 'completed',
                    'description': f'Agent marketplace purchase: {listing.title}',
                    'metadata': {
                        'agent_marketplace_purchase_id': str(purchase.id),
                        'agent_marketplace_listing_id': str(listing.id),
                        'agent_marketplace_settlement_id': str(settlement.id),
                    },
                },
            )
        except Exception:
            pass

        listing.installs_count += 1
        listing.save(update_fields=['installs_count', 'updated_at'])

        template_workspace = listing.template.workspace
        if template_workspace:
            _record_workspace_audit_event(
                workspace=template_workspace,
                actor=request.user,
                event_type='marketplace.purchase.created',
                object_type='marketplace_purchase',
                object_id=str(purchase.id),
                metadata_json={'listing_id': str(listing.id), 'amount_usd': str(listing.price_usd)},
                request=request,
            )

        return Response(AgentMarketplacePurchaseSerializer(purchase).data, status=status.HTTP_201_CREATED)


class AgentMarketplaceSettlementActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id, action):
        purchase = AgentMarketplacePurchase.objects.filter(id=id).select_related('listing__template__workspace', 'listing__published_by').first()
        if not purchase:
            return Response({'error': 'Marketplace purchase not found.'}, status=status.HTTP_404_NOT_FOUND)

        workspace = purchase.listing.template.workspace
        is_seller = purchase.listing.published_by_id == request.user.id
        is_workspace_admin = False
        if workspace:
            membership = AgentWorkspaceMembership.objects.filter(workspace=workspace, user=request.user).first()
            is_workspace_admin = bool(membership and _require_workspace_role(membership, 'admin'))
        if not (is_seller or is_workspace_admin):
            return Response({'error': 'Not authorized to manage settlement.'}, status=status.HTTP_403_FORBIDDEN)

        settlement = AgentMarketplaceSettlement.objects.filter(purchase=purchase).first()
        if not settlement:
            return Response({'error': 'Settlement record not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = (action or '').lower()
        if action == 'settle':
            if settlement.status != 'pending':
                return Response({'error': f'Cannot settle from status {settlement.status}.'}, status=status.HTTP_400_BAD_REQUEST)
            settlement.status = 'settled'
            settlement.settled_at = timezone.now()
            settlement.payout_reference = request.data.get('payout_reference', settlement.payout_reference)
            settlement.save(update_fields=['status', 'settled_at', 'payout_reference', 'updated_at'])
        elif action == 'refund':
            if settlement.status == 'refunded':
                return Response({'error': 'Settlement already refunded.'}, status=status.HTTP_400_BAD_REQUEST)
            settlement.status = 'refunded'
            settlement.refunded_at = timezone.now()
            settlement.save(update_fields=['status', 'refunded_at', 'updated_at'])
            purchase.status = 'refunded'
            purchase.save(update_fields=['status', 'updated_at'])
            try:
                from payments.models import Payment

                payment = Payment.objects.filter(
                    metadata__agent_marketplace_purchase_id=str(purchase.id)
                ).order_by('-created_at').first()
                if payment:
                    payment.status = 'refunded'
                    payment.save(update_fields=['status', 'updated_at'])
            except Exception:
                pass
        else:
            return Response({'error': 'Unsupported settlement action.'}, status=status.HTTP_400_BAD_REQUEST)

        if workspace:
            _record_workspace_audit_event(
                workspace=workspace,
                actor=request.user,
                event_type=f'marketplace.settlement.{action}',
                object_type='marketplace_settlement',
                object_id=str(settlement.id),
                metadata_json={'purchase_id': str(purchase.id), 'status': settlement.status},
                request=request,
            )
        return Response(AgentMarketplaceSettlementSerializer(settlement).data)


class AgentMarketplaceAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        listings = AgentMarketplaceListing.objects.filter(published_by=request.user)
        purchases = AgentMarketplacePurchase.objects.filter(listing__published_by=request.user)
        settlements = AgentMarketplaceSettlement.objects.filter(purchase__listing__published_by=request.user)

        gross = settlements.aggregate(total=Sum('amount_gross_usd')).get('total') or Decimal('0')
        fees = settlements.aggregate(total=Sum('platform_fee_usd')).get('total') or Decimal('0')
        net = settlements.aggregate(total=Sum('amount_net_usd')).get('total') or Decimal('0')

        payload = {
            'listings_total': listings.count(),
            'installs_total': int(listings.aggregate(total=Sum('installs_count')).get('total') or 0),
            'purchases_total': purchases.count(),
            'active_purchases': purchases.filter(status='active').count(),
            'refunded_purchases': purchases.filter(status='refunded').count(),
            'settlements_pending': settlements.filter(status='pending').count(),
            'settlements_settled': settlements.filter(status='settled').count(),
            'gross_revenue_usd': float(gross),
            'platform_fees_usd': float(fees),
            'net_revenue_usd': float(net),
        }
        return Response(payload)
