from django.urls import include, path
from . import views
from . import compliance_views

app_name = 'agents'

urlpatterns = [
    # Streaming chat-runtime surface — kept under /chat/ so it never collides
    # with the enterprise control-plane routes below (workspaces / templates /
    # runs / tools / marketplace).
    path('chat/', include('agents.chat_urls', namespace='chat')),

    # Sovereign compliance audit (the flagship capability).
    path('compliance/frameworks/', compliance_views.ComplianceFrameworksView.as_view(), name='compliance-frameworks'),
    path('compliance/audit/', compliance_views.ComplianceAuditView.as_view(), name='compliance-audit'),

    path('workspaces/', views.AgentWorkspaceListCreateView.as_view(), name='workspace-list-create'),
    path('workspaces/<slug:workspace_slug>/members/', views.AgentWorkspaceMembershipListCreateView.as_view(), name='workspace-members'),
    path('workspaces/<slug:workspace_slug>/policies/', views.AgentWorkspacePolicyListCreateView.as_view(), name='workspace-policies'),
    path('workspaces/<slug:workspace_slug>/identity/providers/', views.AgentWorkspaceIdentityProviderListCreateView.as_view(), name='workspace-identity-providers'),
    path('workspaces/<slug:workspace_slug>/identity/sso/assert/', views.AgentWorkspaceSSOAssertionView.as_view(), name='workspace-sso-assert'),
    path('workspaces/<slug:workspace_slug>/audit/events/', views.AgentWorkspaceAuditEventListView.as_view(), name='workspace-audit-events'),
    path('workspaces/<slug:workspace_slug>/audit/export/', views.AgentWorkspaceAuditExportView.as_view(), name='workspace-audit-export'),

    path('tools/', views.AgentToolListView.as_view(), name='tool-list'),
    path('templates/', views.AgentTemplateListView.as_view(), name='template-list'),
    path('templates/<slug:slug>/', views.AgentTemplateDetailView.as_view(), name='template-detail'),
    path('templates/<slug:slug>/versions/', views.AgentTemplateVersionListView.as_view(), name='template-versions'),
    path('templates/<slug:slug>/rollback/<int:version_number>/', views.AgentTemplateRollbackView.as_view(), name='template-rollback'),
    path('templates/<slug:slug>/lock/', views.AgentTemplateLockView.as_view(), name='template-lock'),
    path('templates/<slug:slug>/unlock/', views.AgentTemplateUnlockView.as_view(), name='template-unlock'),
    path('templates/<slug:slug>/memory-policies/', views.AgentTemplateMemoryPolicyListCreateView.as_view(), name='template-memory-policies'),

    path('runs/', views.AgentWorkflowRunView.as_view(), name='run-list-create'),
    path('runs/<uuid:id>/', views.AgentWorkflowRunDetailView.as_view(), name='run-detail'),
    path('runs/<uuid:run_id>/cancel/', views.AgentWorkflowRunCancelView.as_view(), name='run-cancel'),

    path('approvals/', views.AgentApprovalListView.as_view(), name='approval-list'),
    path('approvals/<uuid:approval_id>/approve/', views.AgentApprovalApproveView.as_view(), name='approval-approve'),
    path('approvals/<uuid:approval_id>/reject/', views.AgentApprovalRejectView.as_view(), name='approval-reject'),

    path('memory/', views.AgentMemoryListCreateView.as_view(), name='memory-list-create'),
    path('memory/<uuid:id>/', views.AgentMemoryDetailView.as_view(), name='memory-detail'),

    path('connectors/', views.AgentConnectorListCreateView.as_view(), name='connector-list-create'),
    path('connectors/<uuid:id>/', views.AgentConnectorDetailView.as_view(), name='connector-detail'),
    path('connectors/<uuid:id>/reauth-url/', views.AgentConnectorReauthUrlView.as_view(), name='connector-reauth-url'),

    path('triggers/', views.AgentTriggerListCreateView.as_view(), name='trigger-list-create'),
    path('triggers/<uuid:id>/', views.AgentTriggerDetailView.as_view(), name='trigger-detail'),
    path('triggers/<uuid:id>/rotate-secret/', views.AgentTriggerRotateSecretView.as_view(), name='trigger-rotate-secret'),

    path('hooks/<uuid:webhook_key>/', views.AgentWebhookTriggerInvokeView.as_view(), name='hook-invoke'),

    path('alerts/', views.AgentReliabilityAlertListView.as_view(), name='alert-list'),
    path('alerts/<uuid:id>/resolve/', views.AgentReliabilityAlertResolveView.as_view(), name='alert-resolve'),

    path('orchestrations/', views.AgentOrchestrationJobListCreateView.as_view(), name='orchestration-list-create'),
    path('orchestrations/<uuid:id>/', views.AgentOrchestrationJobDetailView.as_view(), name='orchestration-detail'),
    path('orchestrations/<uuid:id>/execute/', views.AgentOrchestrationJobExecuteView.as_view(), name='orchestration-execute'),
    path('orchestrations/<uuid:id>/steps/<uuid:step_id>/approve/', views.AgentOrchestrationJobStepApproveView.as_view(), name='orchestration-step-approve'),

    path('marketplace/listings/', views.AgentMarketplaceListingListCreateView.as_view(), name='marketplace-listings'),
    path('marketplace/listings/<uuid:id>/', views.AgentMarketplaceListingDetailView.as_view(), name='marketplace-listing-detail'),
    path('marketplace/listings/<uuid:id>/purchase/', views.AgentMarketplacePurchaseCreateView.as_view(), name='marketplace-purchase'),
    path('marketplace/purchases/<uuid:id>/<str:action>/', views.AgentMarketplaceSettlementActionView.as_view(), name='marketplace-settlement-action'),
    path('marketplace/analytics/', views.AgentMarketplaceAnalyticsView.as_view(), name='marketplace-analytics'),

    path('dashboard/', views.AgentDashboardView.as_view(), name='dashboard'),
    path('dashboard/slo/', views.AgentSLODashboardView.as_view(), name='dashboard-slo'),
    path('dashboard/traces/', views.AgentTraceDashboardView.as_view(), name='dashboard-traces'),
]
