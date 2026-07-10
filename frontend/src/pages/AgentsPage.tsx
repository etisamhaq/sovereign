import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import {
  PlayIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  template_type: string;
  version: number;
  is_public?: boolean;
}

interface WorkflowStep {
  key: string;
  type: 'tool' | 'llm' | 'api_call' | 'transform' | 'approval';
  action: string;
  input_from?: string | null;
  requires_approval?: boolean;
  provider?: string;
  config?: Record<string, unknown>;
}

interface TemplateDetail extends Template {
  definition_json: {
    steps: WorkflowStep[];
  };
  default_config_json: Record<string, unknown>;
  is_public: boolean;
  is_active: boolean;
}

interface RunItem {
  id: string;
  template_slug: string;
  status: 'queued' | 'running' | 'waiting_approval' | 'succeeded' | 'failed' | 'cancelled';
  trigger_type: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
}

interface ApprovalItem {
  id: string;
  run: string;
  step_run: string;
  step_key: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string;
  requested_at: string;
}

interface Dashboard {
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  avg_duration_ms: number;
  total_tokens: number;
  estimated_cost_usd: number;
  pending_approvals: number;
}

interface SLODashboard {
  window_hours: number;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  success_rate: number;
  target_success_rate: number;
  error_budget_remaining_percent: number;
  p95_duration_ms: number;
  mean_time_to_resolve_minutes: number;
  open_alerts_total: number;
  open_critical_alerts: number;
  delivered_alert_notifications: number;
  notification_delivery_rate: number;
  uptime_timeseries: Array<{
    date: string;
    success_rate: number;
    total_runs: number;
  }>;
}

interface TriggerItem {
  id: string;
  name: string;
  trigger_type: 'webhook' | 'schedule';
  is_active: boolean;
  template_slug: string;
  webhook_key: string;
  schedule_every_minutes: number | null;
  updated_at: string;
}

interface TemplateVersionItem {
  id: string;
  version_number: number;
  change_note: string;
  created_at: string;
  changed_by_email?: string;
}

interface ReliabilityAlertItem {
  id: string;
  alert_type: 'failed_run_ratio' | 'trigger_dispatch_failure' | 'schedule_trigger_stalled' | 'connector_auth_failure';
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved';
  message: string;
  created_at: string;
  delivered_channels?: string[];
}

interface TraceItem {
  run_id: string;
  template_slug: string;
  status: string;
  trigger_type: string;
  created_at: string;
  trigger_id?: string | null;
  orchestration_job_id?: string | null;
  orchestration_step_id?: string | null;
  retrieved_memory_count: number;
  external_actions_count: number;
  error_summary: string;
}

interface TraceDashboard {
  total_runs: number;
  failed_runs: number;
  waiting_approval_runs: number;
  traces: TraceItem[];
}

interface ConnectorItem {
  id: string;
  provider: string;
  status: 'connected' | 'expired' | 'error';
  last_sync_at?: string | null;
}

interface PaymentDashboard {
  subscription_tier: string;
  is_pro: boolean;
  monthly_usage_count: number;
  rate_limit_monthly: number;
  rate_limit_remaining: number;
  bonus_credits: number;
  total_spend_usd: number;
  total_refunds_usd: number;
  marketplace_spend_usd: number;
}

interface MarketplaceAnalytics {
  listings_total: number;
  installs_total: number;
  purchases_total: number;
  active_purchases: number;
  refunded_purchases: number;
  settlements_pending: number;
  settlements_settled: number;
  gross_revenue_usd: number;
  platform_fees_usd: number;
  net_revenue_usd: number;
}

interface ToolMeta {
  action: string;
  description: string;
  input_schema: Record<string, string>;
  output_schema: Record<string, string>;
}

const FALLBACK_ACTION_OPTIONS: Record<WorkflowStep['type'], string[]> = {
  tool: ['content_repurposer_process', 'content_repurposer_generate', 'draft_followup_email', 'http_request', 'ai_summarize', 'generate_blog_post', 'generate_social_posts', 'generate_meta_description', 'extract_keywords', 'generate_email', 'generate_cover_letter', 'generate_ad_copy', 'analyze_document', 'check_grammar', 'generate_outline'],
  llm: ['llm_generate'],
  api_call: ['custom_webhook_post'],
  transform: ['detect_stale_deals', 'prepare_followup_payloads', 'json_extract', 'template_render', 'noop'],
  approval: ['approval_checkpoint'],
};

const PROVIDER_OPTIONS = ['hubspot', 'pipedrive', 'gmail', 'outlook', 'google_calendar', 'custom_api'];

const statusBadge: Record<RunItem['status'], string> = {
  queued: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  waiting_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  succeeded: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

// Step config editor — extracted as a sub-component so the local ``useState``
// hook satisfies the rules-of-hooks lint rule. Renders either a raw JSON
// textarea (used when the tool has no schema, or when the user explicitly
// switches into raw mode) or a structured per-field form derived from the
// tool's ``input_schema``.
interface StepConfigEditorProps {
  step: WorkflowStep;
  idx: number;
  schema?: Record<string, string>;
  updateStepField: (index: number, field: keyof WorkflowStep, value: unknown) => void;
  updateStepConfigFromText: (index: number, text: string) => void;
}

const StepConfigEditor: React.FC<StepConfigEditorProps> = ({
  step,
  idx,
  schema,
  updateStepField,
  updateStepConfigFromText,
}) => {
  const hasSchema = !!schema && Object.keys(schema).length > 0;
  const [showRawJson, setShowRawJson] = useState(!hasSchema);
  const cfg: Record<string, any> = (step.config as Record<string, any>) || {};

  if (showRawJson || !hasSchema) {
    return (
      <div className="md:col-span-6">
        {hasSchema && (
          <button
            type="button"
            onClick={() => setShowRawJson(false)}
            className="text-xs text-primary-600 hover:underline mb-1"
          >
            Switch to form fields
          </button>
        )}
        <textarea
          className="input w-full min-h-[64px] font-mono text-xs"
          value={JSON.stringify(cfg, null, 2)}
          onChange={(e) => updateStepConfigFromText(idx, e.target.value)}
          placeholder="config JSON"
        />
      </div>
    );
  }

  return (
    <div className="md:col-span-6 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Config</span>
        <button
          type="button"
          onClick={() => setShowRawJson(true)}
          className="text-xs text-primary-600 hover:underline"
        >
          Edit Raw JSON
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(schema!).map(([field, fieldType]) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              {field} <span className="text-gray-400">({fieldType})</span>
            </label>
            {fieldType === 'boolean' ? (
              <input
                type="checkbox"
                checked={Boolean(cfg[field])}
                onChange={(e) => updateStepField(idx, 'config', { ...cfg, [field]: e.target.checked })}
              />
            ) : fieldType === 'integer' ? (
              <input
                type="number"
                className="input text-xs w-full"
                value={cfg[field] ?? ''}
                onChange={(e) =>
                  updateStepField(idx, 'config', {
                    ...cfg,
                    [field]: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            ) : fieldType === 'array' ? (
              <input
                type="text"
                className="input text-xs w-full"
                value={Array.isArray(cfg[field]) ? cfg[field].join(', ') : cfg[field] ?? ''}
                placeholder="comma-separated values"
                onChange={(e) =>
                  updateStepField(idx, 'config', {
                    ...cfg,
                    [field]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            ) : (
              <input
                type="text"
                className="input text-xs w-full"
                value={cfg[field] ?? ''}
                onChange={(e) => updateStepField(idx, 'config', { ...cfg, [field]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const AgentsPage: React.FC = () => {
  usePageTitle('AI Agents', 'Run and monitor autonomous AI workflows in Sovereign.');
  const qc = useQueryClient();

  const [selectedTemplate, setSelectedTemplate] = useState('content-repurposing-agent');
  const [runInput, setRunInput] = useState<string>(JSON.stringify({ prompt: 'Create a growth content strategy for AI SaaS' }, null, 2));
  const [builderTemplateSlug, setBuilderTemplateSlug] = useState('');
  const [builderTemplateName, setBuilderTemplateName] = useState('');
  const [builderTemplateDescription, setBuilderTemplateDescription] = useState('');
  const [builderDefinitionJson, setBuilderDefinitionJson] = useState<string>(JSON.stringify({
    steps: [
      {
        key: 'draft_plan',
        type: 'llm',
        action: 'llm_generate',
        config: {},
      },
    ],
  }, null, 2));
  const [builderDraggingIndex, setBuilderDraggingIndex] = useState<number | null>(null);
  const [builderBaselineDefinitionJson, setBuilderBaselineDefinitionJson] = useState<string>('');
  const [bumpVersionOnUpdate, setBumpVersionOnUpdate] = useState(true);

  const [triggerName, setTriggerName] = useState('');
  const [triggerType, setTriggerType] = useState<'webhook' | 'schedule'>('webhook');
  const [triggerTemplateSlug, setTriggerTemplateSlug] = useState('seo-execution-agent');
  const [triggerScheduleMinutes, setTriggerScheduleMinutes] = useState<number>(15);
  const [triggerWebhookSecret, setTriggerWebhookSecret] = useState('');
  const [memoryLimit, setMemoryLimit] = useState<number>(8);
  const [memorySemanticWeight, setMemorySemanticWeight] = useState<number>(0.8);
  const [memoryLexicalWeight, setMemoryLexicalWeight] = useState<number>(0.2);
  const [includeWorkspaceMemory, setIncludeWorkspaceMemory] = useState<boolean>(false);

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['agent-templates'],
    queryFn: () => apiClient.get('/agents/templates/'),
  });

  const { data: availableTools } = useQuery<ToolMeta[]>({
    queryKey: ['agent-tools'],
    queryFn: () => apiClient.get('/agents/tools/'),
    staleTime: 1000 * 60 * 30,
  });

  const ACTION_OPTIONS_BY_TYPE: Record<WorkflowStep['type'], string[]> = useMemo(() => {
    if (!availableTools || availableTools.length === 0) return FALLBACK_ACTION_OPTIONS;
    const toolActions = availableTools.map((t) => t.action);
    return {
      ...FALLBACK_ACTION_OPTIONS,
      tool: toolActions.length > 0 ? toolActions : FALLBACK_ACTION_OPTIONS.tool,
    };
  }, [availableTools]);

  const toolMetaMap: Record<string, ToolMeta> = useMemo(() => {
    const map: Record<string, ToolMeta> = {};
    (availableTools || []).forEach((t) => { map[t.action] = t; });
    return map;
  }, [availableTools]);

  const { data: runsData, isFetching: runsRefreshing } = useQuery<{ count: number; results: RunItem[] }>({
    queryKey: ['agent-runs'],
    queryFn: () => apiClient.get('/agents/runs/'),
    refetchInterval: false,
  });

  const { data: approvals } = useQuery<ApprovalItem[]>({
    queryKey: ['agent-approvals'],
    queryFn: () => apiClient.get('/agents/approvals/'),
    refetchInterval: false,
  });

  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ['agent-dashboard'],
    queryFn: () => apiClient.get('/agents/dashboard/'),
    refetchInterval: false,
  });

  const { data: sloDashboard } = useQuery<SLODashboard>({
    queryKey: ['agent-dashboard-slo'],
    queryFn: () => apiClient.get<SLODashboard>('/agents/dashboard/slo/?window_hours=24'),
    refetchInterval: false,
  });

  const { data: triggers } = useQuery<TriggerItem[]>({
    queryKey: ['agent-triggers'],
    queryFn: () => apiClient.get('/agents/triggers/'),
    refetchInterval: false,
  });

  const { data: builderTemplateDetail, isFetching: isBuilderTemplateLoading } = useQuery<TemplateDetail>({
    queryKey: ['agent-template-detail', builderTemplateSlug],
    queryFn: () => apiClient.get<TemplateDetail>(`/agents/templates/${builderTemplateSlug}/`),
    enabled: !!builderTemplateSlug,
  });

  const { data: builderVersions } = useQuery<TemplateVersionItem[]>({
    queryKey: ['agent-template-versions', builderTemplateSlug],
    queryFn: () => apiClient.get<TemplateVersionItem[]>(`/agents/templates/${builderTemplateSlug}/versions/`),
    enabled: !!builderTemplateSlug,
    refetchInterval: false,
  });

  const { data: reliabilityAlerts } = useQuery<ReliabilityAlertItem[]>({
    queryKey: ['agent-reliability-alerts'],
    queryFn: () => apiClient.get<ReliabilityAlertItem[]>('/agents/alerts/?status=open'),
    refetchInterval: false,
  });

  const { data: traceDashboard } = useQuery<TraceDashboard>({
    queryKey: ['agent-dashboard-traces'],
    queryFn: () => apiClient.get<TraceDashboard>('/agents/dashboard/traces/?limit=25'),
    refetchInterval: false,
  });

  const { data: connectors } = useQuery<ConnectorItem[]>({
    queryKey: ['agent-connectors'],
    queryFn: () => apiClient.get<ConnectorItem[]>('/agents/connectors/'),
    refetchInterval: false,
  });

  const { data: paymentDashboard } = useQuery<PaymentDashboard>({
    queryKey: ['payments-dashboard'],
    queryFn: () => apiClient.get<PaymentDashboard>('/payments/dashboard/'),
    refetchInterval: false,
  });

  const { data: marketplaceAnalytics } = useQuery<MarketplaceAnalytics>({
    queryKey: ['agent-marketplace-analytics'],
    queryFn: () => apiClient.get<MarketplaceAnalytics>('/agents/marketplace/analytics/'),
    refetchInterval: false,
  });

  useEffect(() => {
    if (!templates?.length || builderTemplateSlug) return;
    const custom = templates.find((t) => t.template_type === 'custom');
    setBuilderTemplateSlug((custom || templates[0]).slug);
  }, [templates, builderTemplateSlug]);

  useEffect(() => {
    if (!builderTemplateDetail) return;
    setBuilderTemplateName(builderTemplateDetail.name || '');
    setBuilderTemplateDescription(builderTemplateDetail.description || '');
    const definition = JSON.stringify(builderTemplateDetail.definition_json || { steps: [] }, null, 2);
    setBuilderDefinitionJson(definition);
    setBuilderBaselineDefinitionJson(definition);
  }, [builderTemplateDetail]);

  useEffect(() => {
    if (!builderTemplateSlug) return;
    apiClient.get<Array<{ key: string; value_json?: { value?: unknown } }>>(`/agents/templates/${builderTemplateSlug}/memory-policies/`)
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.key, r.value_json?.value]));
        if (typeof map.get('memory_retrieval_limit') === 'number') setMemoryLimit(Number(map.get('memory_retrieval_limit')));
        if (typeof map.get('memory_semantic_weight') === 'number') setMemorySemanticWeight(Number(map.get('memory_semantic_weight')));
        if (typeof map.get('memory_lexical_weight') === 'number') setMemoryLexicalWeight(Number(map.get('memory_lexical_weight')));
        if (typeof map.get('include_workspace_memory') === 'boolean') setIncludeWorkspaceMemory(Boolean(map.get('include_workspace_memory')));
      })
      .catch(() => undefined);
  }, [builderTemplateSlug]);

  const parsedBaselineDefinition = useMemo(() => {
    try {
      const parsed = JSON.parse(builderBaselineDefinitionJson || '{}');
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as { steps?: WorkflowStep[]; [key: string]: unknown };
    } catch {
      return null;
    }
  }, [builderBaselineDefinitionJson]);

  const parsedBuilderDefinition = useMemo(() => {
    try {
      const parsed = JSON.parse(builderDefinitionJson || '{}');
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray((parsed as any).steps)) {
        return { ...(parsed as Record<string, unknown>), steps: [] };
      }
      return parsed as { steps: WorkflowStep[]; [key: string]: unknown };
    } catch {
      return null;
    }
  }, [builderDefinitionJson]);

  const visualSteps = useMemo<WorkflowStep[]>(() => {
    if (!parsedBuilderDefinition?.steps) return [];
    return parsedBuilderDefinition.steps;
  }, [parsedBuilderDefinition]);

  const syncStepsIntoDefinition = (nextSteps: WorkflowStep[]) => {
    const base = parsedBuilderDefinition || { steps: [] as WorkflowStep[] };
    const next = {
      ...base,
      steps: nextSteps,
    };
    setBuilderDefinitionJson(JSON.stringify(next, null, 2));
  };

  const updateStepField = (index: number, field: keyof WorkflowStep, value: unknown) => {
    const next = [...visualSteps];
    if (!next[index]) return;
    next[index] = {
      ...next[index],
      [field]: value,
    };
    syncStepsIntoDefinition(next);
  };

  const updateStepConfigFromText = (index: number, text: string) => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Config must be a JSON object');
      }
      updateStepField(index, 'config', parsed);
    } catch {
      // Keep editor stable; JSON validation feedback shown in builderErrors.
    }
  };

  const addStep = () => {
    const suffix = visualSteps.length + 1;
    const next = [
      ...visualSteps,
      {
        key: `step_${suffix}`,
        type: 'transform' as const,
        action: 'noop',
        config: {},
      },
    ];
    syncStepsIntoDefinition(next);
  };

  const removeStep = (index: number) => {
    const next = visualSteps.filter((_, i) => i !== index);
    syncStepsIntoDefinition(next);
  };

  const reorderSteps = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= visualSteps.length || to >= visualSteps.length) return;
    const next = [...visualSteps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    syncStepsIntoDefinition(next);
  };

  const builderErrors = useMemo(() => {
    const errors: string[] = [];
    if (!parsedBuilderDefinition) {
      errors.push('Definition JSON is invalid.');
      return errors;
    }

    const steps = Array.isArray(parsedBuilderDefinition.steps) ? parsedBuilderDefinition.steps : [];
    const keys = new Set<string>();

    steps.forEach((step, index) => {
      const label = `Step ${index + 1}`;
      if (!step.key?.trim()) errors.push(`${label}: key is required.`);
      if (step.key && keys.has(step.key)) errors.push(`${label}: duplicate key '${step.key}'.`);
      if (step.key) keys.add(step.key);

      if (!step.action?.trim()) errors.push(`${label}: action is required.`);
      if (step.type === 'api_call' && !step.provider) errors.push(`${label}: provider is required for api_call.`);
      if (step.type === 'approval' && step.action !== 'approval_checkpoint') {
        errors.push(`${label}: approval step action must be approval_checkpoint.`);
      }
      if (step.type === 'approval' && !step.requires_approval) {
        errors.push(`${label}: approval step requires_approval must be true.`);
      }

      if (step.config !== undefined && (typeof step.config !== 'object' || Array.isArray(step.config))) {
        errors.push(`${label}: config must be an object.`);
      }
    });

    return errors;
  }, [parsedBuilderDefinition]);

  const builderDiffSummary = useMemo(() => {
    const beforeSteps = Array.isArray(parsedBaselineDefinition?.steps) ? parsedBaselineDefinition!.steps : [];
    const afterSteps = Array.isArray(parsedBuilderDefinition?.steps) ? parsedBuilderDefinition!.steps : [];

    const beforeMap = new Map(beforeSteps.map((s) => [s.key, JSON.stringify(s)]));
    const afterMap = new Map(afterSteps.map((s) => [s.key, JSON.stringify(s)]));

    const added = afterSteps.filter((s) => !beforeMap.has(s.key)).map((s) => s.key);
    const removed = beforeSteps.filter((s) => !afterMap.has(s.key)).map((s) => s.key);
    const changed = afterSteps
      .filter((s) => beforeMap.has(s.key) && beforeMap.get(s.key) !== afterMap.get(s.key))
      .map((s) => s.key);

    const orderChanged =
      beforeSteps.length === afterSteps.length
      && beforeSteps.map((s) => s.key).join('|') !== afterSteps.map((s) => s.key).join('|');

    return {
      added,
      removed,
      changed,
      orderChanged,
    };
  }, [parsedBaselineDefinition, parsedBuilderDefinition]);

  const startRun = useMutation({
    mutationFn: async () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(runInput || '{}');
      } catch {
        throw new Error('Input JSON is invalid');
      }
      return apiClient.post('/agents/runs/', {
        template_slug: selectedTemplate,
        input_payload_json: parsed,
      });
    },
    onSuccess: () => {
      toast.success('Agent run started');
      qc.invalidateQueries({ queryKey: ['agent-runs'] });
      qc.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start run'),
  });

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) => apiClient.post(`/agents/approvals/${approvalId}/approve/`, { review_notes: 'Approved from dashboard' }),
    onSuccess: () => {
      toast.success('Approved. Workflow resumed.');
      qc.invalidateQueries({ queryKey: ['agent-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs'] });
      qc.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (approvalId: string) => apiClient.post(`/agents/approvals/${approvalId}/reject/`, { review_notes: 'Rejected from dashboard' }),
    onSuccess: () => {
      toast.success('Approval rejected');
      qc.invalidateQueries({ queryKey: ['agent-approvals'] });
      qc.invalidateQueries({ queryKey: ['agent-runs'] });
      qc.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: () => toast.error('Failed to reject'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!parsedBuilderDefinition) {
        throw new Error('Template definition JSON is invalid');
      }
      return apiClient.post<Template>('/agents/templates/', {
        name: builderTemplateName,
        description: builderTemplateDescription,
        template_type: 'custom',
        is_public: false,
        definition_json: parsedBuilderDefinition,
        default_config_json: {},
      });
    },
    onSuccess: (data: Template) => {
      toast.success('Template saved');
      setSelectedTemplate(data.slug);
      setTriggerTemplateSlug(data.slug);
      setBuilderTemplateSlug(data.slug);
      qc.invalidateQueries({ queryKey: ['agent-templates'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create template'),
  });

  // NOTE: a previous unversioned ``updateTemplateMutation`` was replaced by
  // ``updateTemplateWithVersionMutation`` below, which carries the
  // ``bump_version`` flag and supersedes it.

  const updateTemplateWithVersionMutation = useMutation({
    mutationFn: async () => {
      if (!builderTemplateSlug) {
        throw new Error('Select a template first');
      }
      if (!parsedBuilderDefinition) {
        throw new Error('Template definition JSON is invalid');
      }

      const url = `/agents/templates/${builderTemplateSlug}/?bump_version=${bumpVersionOnUpdate ? 'true' : 'false'}`;
      return apiClient.patch<TemplateDetail>(url, {
        name: builderTemplateName,
        description: builderTemplateDescription,
        definition_json: parsedBuilderDefinition,
      });
    },
    onSuccess: () => {
      toast.success('Template updated');
      qc.invalidateQueries({ queryKey: ['agent-templates'] });
      qc.invalidateQueries({ queryKey: ['agent-template-detail', builderTemplateSlug] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update template (must be your custom template)'),
  });

  const createTriggerMutation = useMutation({
    mutationFn: () => apiClient.post('/agents/triggers/', {
      name: triggerName,
      template_slug: triggerTemplateSlug,
      trigger_type: triggerType,
      schedule_every_minutes: triggerType === 'schedule' ? triggerScheduleMinutes : undefined,
      webhook_secret: triggerType === 'webhook' ? triggerWebhookSecret : undefined,
      input_defaults_json: {},
    }),
    onSuccess: () => {
      toast.success('Trigger created');
      setTriggerName('');
      setTriggerWebhookSecret('');
      qc.invalidateQueries({ queryKey: ['agent-triggers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create trigger'),
  });

  const rotateSecretMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/agents/triggers/${id}/rotate-secret/`),
    onSuccess: () => {
      toast.success('Webhook secret rotated');
      qc.invalidateQueries({ queryKey: ['agent-triggers'] });
    },
    onError: () => toast.error('Failed to rotate secret'),
  });

  const rollbackTemplateMutation = useMutation({
    mutationFn: (versionNumber: number) => apiClient.post<TemplateDetail>(
      `/agents/templates/${builderTemplateSlug}/rollback/${versionNumber}/`
    ),
    onSuccess: () => {
      toast.success('Template rolled back to selected version');
      qc.invalidateQueries({ queryKey: ['agent-templates'] });
      qc.invalidateQueries({ queryKey: ['agent-template-detail', builderTemplateSlug] });
      qc.invalidateQueries({ queryKey: ['agent-template-versions', builderTemplateSlug] });
    },
    onError: () => toast.error('Failed to rollback template'),
  });

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) => apiClient.post(`/agents/alerts/${alertId}/resolve/`),
    onSuccess: () => {
      toast.success('Alert resolved');
      qc.invalidateQueries({ queryKey: ['agent-reliability-alerts'] });
      qc.invalidateQueries({ queryKey: ['agent-dashboard-slo'] });
    },
    onError: () => toast.error('Failed to resolve alert'),
  });

  const connectorReauthMutation = useMutation({
    mutationFn: (connectorId: string) => apiClient.post<{ reauth_url: string }>(`/agents/connectors/${connectorId}/reauth-url/`, {}),
    onSuccess: (data) => {
      if (data?.reauth_url) {
        window.open(data.reauth_url, '_blank', 'noopener,noreferrer');
        toast.success('Opened re-auth flow in new tab');
      }
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to generate re-auth URL'),
  });

  const saveMemoryPolicyMutation = useMutation({
    mutationFn: async () => {
      if (!builderTemplateSlug) throw new Error('Select a template first');
      const endpoint = `/agents/templates/${builderTemplateSlug}/memory-policies/`;
      await apiClient.post(endpoint, { key: 'memory_retrieval_limit', value_json: { value: memoryLimit }, is_active: true });
      await apiClient.post(endpoint, { key: 'memory_semantic_weight', value_json: { value: memorySemanticWeight }, is_active: true });
      await apiClient.post(endpoint, { key: 'memory_lexical_weight', value_json: { value: memoryLexicalWeight }, is_active: true });
      await apiClient.post(endpoint, { key: 'include_workspace_memory', value_json: { value: includeWorkspaceMemory }, is_active: true });
      return true;
    },
    onSuccess: () => toast.success('Memory policy saved'),
    onError: (e: any) => toast.error(e?.message || 'Failed to save memory policy'),
  });

  const templateLockMutation = useMutation({
    mutationFn: () => {
      if (!builderTemplateSlug) throw new Error('Select a template first');
      return apiClient.post(`/agents/templates/${builderTemplateSlug}/lock/`, { lock_minutes: 20 });
    },
    onSuccess: () => toast.success('Template lock acquired'),
    onError: (e: any) => toast.error(e?.message || 'Failed to lock template'),
  });

  const templateUnlockMutation = useMutation({
    mutationFn: () => {
      if (!builderTemplateSlug) throw new Error('Select a template first');
      return apiClient.post(`/agents/templates/${builderTemplateSlug}/unlock/`, {});
    },
    onSuccess: () => toast.success('Template lock released'),
    onError: (e: any) => toast.error(e?.message || 'Failed to unlock template'),
  });

  const pendingApprovals = useMemo(() => (approvals || []).filter((a) => a.status === 'pending'), [approvals]);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead
        title="AI Agents"
        description="Run and monitor autonomous workflows with approvals, memory, and observability."
        canonical="/agents"
        noIndex
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium">
              <SparklesIcon className="h-4 w-4" />
              Agentic Workflows
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">Sovereign Agents Control Center</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Create runs, monitor outcomes, and resolve approval gates.</p>
            <div className="mt-3 flex gap-3">
              <Link to="/agents/marketplace" className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                Agent Marketplace
              </Link>
              <Link to="/agents/marketplace/publish" className="inline-flex items-center rounded-lg border border-primary-300 dark:border-primary-700 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                Sell Your Agent
              </Link>
            </div>
          </div>

          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['agent-runs'] });
              qc.invalidateQueries({ queryKey: ['agent-approvals'] });
              qc.invalidateQueries({ queryKey: ['agent-dashboard'] });
              qc.invalidateQueries({ queryKey: ['agent-dashboard-slo'] });
              qc.invalidateQueries({ queryKey: ['agent-reliability-alerts'] });
            }}
            className="inline-flex items-center rounded-lg px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${runsRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500">Total Runs</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{dashboard?.total_runs ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500">Successful</p>
            <p className="text-2xl font-semibold text-green-600">{dashboard?.success_runs ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500">Pending Approvals</p>
            <p className="text-2xl font-semibold text-amber-600">{dashboard?.pending_approvals ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500">Estimated Cost</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">${(dashboard?.estimated_cost_usd ?? 0).toFixed(4)}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SLO Dashboard (24h)</h2>
            <p className="text-xs text-gray-500">Target success rate: {((sloDashboard?.target_success_rate ?? 0.99) * 100).toFixed(1)}%</p>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Success Rate</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{((sloDashboard?.success_rate ?? 1) * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Error Budget Remaining</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{(sloDashboard?.error_budget_remaining_percent ?? 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">P95 Duration</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{Math.round(sloDashboard?.p95_duration_ms ?? 0)} ms</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Mean Time to Resolve</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{(sloDashboard?.mean_time_to_resolve_minutes ?? 0).toFixed(1)} min</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Open Alerts</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                Total: <span className="font-semibold">{sloDashboard?.open_alerts_total ?? 0}</span> • Critical: <span className="font-semibold text-red-600">{sloDashboard?.open_critical_alerts ?? 0}</span>
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Notification Delivery</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                Delivered: <span className="font-semibold">{sloDashboard?.delivered_alert_notifications ?? 0}</span> • Rate: <span className="font-semibold">{((sloDashboard?.notification_delivery_rate ?? 0) * 100).toFixed(1)}%</span>
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 mb-2">7-day uptime trend</p>
            <div className="space-y-1">
              {(sloDashboard?.uptime_timeseries || []).map((point) => (
                <div key={point.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-gray-500">{point.date}</span>
                  <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-2 bg-green-500"
                      style={{ width: `${Math.max(0, Math.min(100, point.success_rate * 100))}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-gray-700 dark:text-gray-200">{(point.success_rate * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Start New Run</h2>
            <div className="mt-4 space-y-3">
              <select
                className="input"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {(templates || []).map((t) => (
                  <option key={t.id} value={t.slug}>{t.name} ({t.template_type})</option>
                ))}
              </select>

              <textarea
                className="input min-h-[180px] font-mono text-xs"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
              />

              <button
                onClick={() => startRun.mutate()}
                disabled={startRun.isPending}
                className="w-full inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-white font-semibold hover:bg-primary-500 disabled:opacity-60"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                {startRun.isPending ? 'Starting...' : 'Start Agent Run'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Runs</h2>
            <div className="mt-4 space-y-3">
              {(runsData?.results || []).length === 0 ? (
                <p className="text-sm text-gray-500">No runs yet.</p>
              ) : (runsData?.results || []).map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{run.template_slug}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {new Date(run.created_at).toLocaleString()} • {run.duration_ms} ms
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[run.status]}`}>{run.status}</span>
                    <Link to={`/agents/runs/${run.id}`} className="text-primary-600 hover:text-primary-500 text-sm font-medium">Details</Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trace Explorer</h2>
            <p className="mt-1 text-sm text-gray-500">Cross-run correlation for triggers, orchestrations, and external actions.</p>
            <div className="mt-3 space-y-2 max-h-[280px] overflow-auto">
              {(traceDashboard?.traces || []).length === 0 ? (
                <p className="text-sm text-gray-500">No trace records yet.</p>
              ) : (traceDashboard?.traces || []).map((trace) => (
                <div key={trace.run_id} className="rounded border border-gray-200 dark:border-gray-700 p-3 text-xs">
                  <p className="font-semibold text-gray-900 dark:text-white">{trace.template_slug} &bull; {trace.status}</p>
                  <p className="text-gray-500">run: {trace.run_id}</p>
                  <p className="text-gray-500">trigger: {trace.trigger_id || 'n/a'} &bull; orch: {trace.orchestration_job_id || 'n/a'}</p>
                  <p className="text-gray-500">memory: {trace.retrieved_memory_count} &bull; external actions: {trace.external_actions_count}</p>
                  {trace.error_summary && <p className="text-red-600 mt-1">{trace.error_summary}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connector Re-auth Wizard</h2>
            <p className="mt-1 text-sm text-gray-500">Reconnect expired or errored connectors with one click.</p>
            <div className="mt-3 space-y-2 max-h-[280px] overflow-auto">
              {(connectors || []).length === 0 ? (
                <p className="text-sm text-gray-500">No connectors configured.</p>
              ) : (connectors || []).map((connector) => (
                <div key={connector.id} className="rounded border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{connector.provider}</p>
                    <p className="text-xs text-gray-500">status: {connector.status}</p>
                  </div>
                  {(connector.status === 'expired' || connector.status === 'error') ? (
                    <button
                      onClick={() => connectorReauthMutation.mutate(connector.id)}
                      className="text-xs rounded-md border border-primary-500 text-primary-700 px-2 py-1 hover:bg-primary-50"
                    >
                      Re-auth
                    </button>
                  ) : (
                    <span className="text-xs text-green-600">Healthy</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing & Rate Limits</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Tier</p>
                <p className="font-semibold text-gray-900 dark:text-white">{paymentDashboard?.subscription_tier || 'free'}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Usage</p>
                <p className="font-semibold text-gray-900 dark:text-white">{paymentDashboard?.monthly_usage_count ?? 0}/{paymentDashboard?.rate_limit_monthly ?? 0}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="font-semibold text-gray-900 dark:text-white">{paymentDashboard?.rate_limit_remaining ?? 0}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Bonus Credits</p>
                <p className="font-semibold text-gray-900 dark:text-white">{paymentDashboard?.bonus_credits ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Marketplace Revenue Analytics</h2>
              <Link to="/agents/marketplace/dashboard" className="text-xs text-primary-600 hover:underline">Full Dashboard</Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Gross</p>
                <p className="font-semibold text-gray-900 dark:text-white">${(marketplaceAnalytics?.gross_revenue_usd ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Net</p>
                <p className="font-semibold text-gray-900 dark:text-white">${(marketplaceAnalytics?.net_revenue_usd ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Pending Settlements</p>
                <p className="font-semibold text-gray-900 dark:text-white">{marketplaceAnalytics?.settlements_pending ?? 0}</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500">Refunded Purchases</p>
                <p className="font-semibold text-gray-900 dark:text-white">{marketplaceAnalytics?.refunded_purchases ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Gallery */}
        <div className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Template Gallery</h2>
          <p className="mt-1 text-sm text-gray-500">Browse pre-built agent templates. Click "Use Template" to load it into the builder.</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(templates || []).filter(t => t.is_public).map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description || 'No description'}</p>
                  <span className="inline-block mt-2 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{t.template_type}</span>
                </div>
                <button
                  onClick={() => {
                    setBuilderTemplateSlug(t.slug);
                  }}
                  className="mt-3 w-full text-xs rounded-md bg-primary-600 text-white px-3 py-1.5 hover:bg-primary-500 font-medium"
                >
                  Use Template
                </button>
              </div>
            ))}
            {(!templates || templates.filter(t => t.is_public).length === 0) && (
              <p className="text-sm text-gray-500 col-span-full">No public templates available yet.</p>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Visual Workflow Builder</h2>
            <p className="mt-1 text-sm text-gray-500">Drag/drop step ordering with JSON editor and save/update UX.</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <select
                className="input"
                value={builderTemplateSlug}
                onChange={(e) => setBuilderTemplateSlug(e.target.value)}
              >
                <option value="">Select template...</option>
                {(templates || []).map((t) => (
                  <option key={t.id} value={t.slug}>{t.name} ({t.template_type})</option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Template name"
                value={builderTemplateName}
                onChange={(e) => setBuilderTemplateName(e.target.value)}
              />

              <textarea
                className="input min-h-[72px]"
                placeholder="Description"
                value={builderTemplateDescription}
                onChange={(e) => setBuilderTemplateDescription(e.target.value)}
              />

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Step Flow (drag to reorder)</p>
                  <button
                    onClick={addStep}
                    className="text-xs rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Add Step
                  </button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-auto">
                  {visualSteps.length === 0 ? (
                    <p className="text-xs text-gray-500">No steps in definition.</p>
                  ) : visualSteps.map((step, idx) => (
                    <div
                      key={`${step.key}-${idx}`}
                      draggable
                      onDragStart={() => setBuilderDraggingIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (builderDraggingIndex !== null) reorderSteps(builderDraggingIndex, idx);
                        setBuilderDraggingIndex(null);
                      }}
                      className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/40"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                        <input
                          className="input md:col-span-2 text-xs"
                          value={step.key}
                          onChange={(e) => updateStepField(idx, 'key', e.target.value)}
                          placeholder="step key"
                        />
                        <select
                          className="input text-xs"
                          value={step.type}
                          onChange={(e) => {
                            const nextType = e.target.value as WorkflowStep['type'];
                            updateStepField(idx, 'type', nextType);
                            if (nextType === 'approval') {
                              updateStepField(idx, 'action', 'approval_checkpoint');
                              updateStepField(idx, 'requires_approval', true);
                            } else if (!ACTION_OPTIONS_BY_TYPE[nextType].includes(step.action)) {
                              updateStepField(idx, 'action', ACTION_OPTIONS_BY_TYPE[nextType][0]);
                            }
                          }}
                        >
                          <option value="tool">tool</option>
                          <option value="llm">llm</option>
                          <option value="api_call">api_call</option>
                          <option value="transform">transform</option>
                          <option value="approval">approval</option>
                        </select>
                        <select
                          className="input text-xs"
                          value={step.action || ''}
                          onChange={(e) => updateStepField(idx, 'action', e.target.value)}
                          title={toolMetaMap[step.action]?.description || ''}
                        >
                          {(ACTION_OPTIONS_BY_TYPE[step.type] || []).map((action) => (
                            <option key={action} value={action} title={toolMetaMap[action]?.description || ''}>{action}</option>
                          ))}
                        </select>
                        {toolMetaMap[step.action]?.description && (
                          <p className="md:col-span-6 text-xs text-gray-500 dark:text-gray-400 -mt-1">{toolMetaMap[step.action].description}</p>
                        )}

                        <select
                          className="input text-xs"
                          value={step.input_from || ''}
                          onChange={(e) => updateStepField(idx, 'input_from', e.target.value || null)}
                        >
                          <option value="">input: root/default</option>
                          <option value="previous_output">previous_output</option>
                          {visualSteps
                            .slice(0, idx)
                            .map((prior) => (
                              <option key={prior.key} value={`step:${prior.key}`}>{`step:${prior.key}`}</option>
                            ))}
                          {idx >= 2 && <option value={`merge:${visualSteps.slice(0, idx).map(s => s.key).join(',')}`}>merge: all previous</option>}
                        </select>

                        <label className="inline-flex items-center text-xs text-gray-700 dark:text-gray-300 px-2">
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={Boolean(step.requires_approval)}
                            onChange={(e) => updateStepField(idx, 'requires_approval', e.target.checked)}
                          />
                          requires_approval
                        </label>

                        {step.type === 'api_call' && (
                          <select
                            className="input text-xs md:col-span-2"
                            value={step.provider || ''}
                            onChange={(e) => updateStepField(idx, 'provider', e.target.value)}
                          >
                            <option value="">provider...</option>
                            {PROVIDER_OPTIONS.map((provider) => (
                              <option key={provider} value={provider}>{provider}</option>
                            ))}
                          </select>
                        )}

                        <StepConfigEditor
                          step={step}
                          idx={idx}
                          schema={toolMetaMap[step.action]?.input_schema}
                          updateStepField={updateStepField}
                          updateStepConfigFromText={updateStepConfigFromText}
                        />
                        <button
                          onClick={() => removeStep(idx)}
                          className="text-xs rounded-md border border-red-300 text-red-600 px-2 py-1 hover:bg-red-50 md:col-span-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {builderErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-semibold mb-1">Validation issues</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {builderErrors.slice(0, 8).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-xs">
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Template Diff Summary</p>
                <p className="text-gray-600 dark:text-gray-300">Added: {builderDiffSummary.added.length} • Removed: {builderDiffSummary.removed.length} • Changed: {builderDiffSummary.changed.length} • Reordered: {builderDiffSummary.orderChanged ? 'yes' : 'no'}</p>
              </div>

              <textarea
                className="input min-h-[220px] font-mono text-xs"
                value={builderDefinitionJson}
                onChange={(e) => setBuilderDefinitionJson(e.target.value)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => createTemplateMutation.mutate()}
                  disabled={!builderTemplateName.trim() || createTemplateMutation.isPending || !parsedBuilderDefinition || builderErrors.length > 0}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-white font-semibold hover:bg-primary-500 disabled:opacity-60"
                >
                  {createTemplateMutation.isPending ? 'Saving...' : 'Save as New Template'}
                </button>

                <button
                  onClick={() => updateTemplateWithVersionMutation.mutate()}
                  disabled={!builderTemplateSlug || updateTemplateWithVersionMutation.isPending || !parsedBuilderDefinition || builderErrors.length > 0}
                  className="w-full inline-flex items-center justify-center rounded-lg border border-primary-600 px-4 py-2.5 text-primary-700 dark:text-primary-300 font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-60"
                >
                  {updateTemplateWithVersionMutation.isPending ? 'Updating...' : 'Update Selected Template'}
                </button>
              </div>

              <label className="inline-flex items-center text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={bumpVersionOnUpdate}
                  onChange={(e) => setBumpVersionOnUpdate(e.target.checked)}
                />
                Bump template version on update (recommended)
              </label>

              <p className="text-xs text-gray-500">
                {isBuilderTemplateLoading
                  ? 'Loading selected template…'
                  : `Tip: Update works only for templates you created. Current version: ${builderTemplateDetail?.version ?? 'n/a'}`}
              </p>

              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Version History</p>
                <div className="space-y-2 max-h-[180px] overflow-auto">
                  {(builderVersions || []).length === 0 ? (
                    <p className="text-xs text-gray-500">No version snapshots yet.</p>
                  ) : (builderVersions || []).map((version) => (
                    <div key={version.id} className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">v{version.version_number}</p>
                        <p className="text-gray-500">{new Date(version.created_at).toLocaleString()} {version.change_note ? `• ${version.change_note}` : ''}</p>
                      </div>
                      <button
                        onClick={() => rollbackTemplateMutation.mutate(version.version_number)}
                        disabled={rollbackTemplateMutation.isPending || !builderTemplateSlug}
                        className="rounded border border-amber-400 text-amber-700 px-2 py-1 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Rollback
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Memory Retrieval Policy</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 dark:text-gray-300">Retrieval limit</span>
                    <input className="input" type="number" min={1} max={50} value={memoryLimit} onChange={(e) => setMemoryLimit(Number(e.target.value) || 8)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 dark:text-gray-300">Semantic weight</span>
                    <input className="input" type="number" step="0.05" min={0} max={1} value={memorySemanticWeight} onChange={(e) => setMemorySemanticWeight(Number(e.target.value) || 0.8)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 dark:text-gray-300">Lexical weight</span>
                    <input className="input" type="number" step="0.05" min={0} max={1} value={memoryLexicalWeight} onChange={(e) => setMemoryLexicalWeight(Number(e.target.value) || 0.2)} />
                  </label>
                  <label className="inline-flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={includeWorkspaceMemory} onChange={(e) => setIncludeWorkspaceMemory(e.target.checked)} />
                    <span className="text-gray-600 dark:text-gray-300">Include workspace memory</span>
                  </label>
                </div>
                <button
                  onClick={() => saveMemoryPolicyMutation.mutate()}
                  disabled={!builderTemplateSlug || saveMemoryPolicyMutation.isPending}
                  className="w-full inline-flex items-center justify-center rounded-lg border border-primary-600 px-3 py-2 text-primary-700 dark:text-primary-300 font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-60"
                >
                  {saveMemoryPolicyMutation.isPending ? 'Saving policy...' : 'Save Memory Policy'}
                </button>
              </div>

              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Collaborative Edit Lock</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    onClick={() => templateLockMutation.mutate()}
                    disabled={!builderTemplateSlug || templateLockMutation.isPending}
                    className="inline-flex items-center justify-center rounded-lg border border-amber-500 text-amber-700 px-3 py-2 hover:bg-amber-50 disabled:opacity-60"
                  >
                    {templateLockMutation.isPending ? 'Locking...' : 'Acquire Lock'}
                  </button>
                  <button
                    onClick={() => templateUnlockMutation.mutate()}
                    disabled={!builderTemplateSlug || templateUnlockMutation.isPending}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-400 text-gray-700 px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {templateUnlockMutation.isPending ? 'Unlocking...' : 'Release Lock'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Automation Triggers</h2>
            <p className="mt-1 text-sm text-gray-500">Create webhook and schedule triggers for hands-free runs.</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Trigger name"
                value={triggerName}
                onChange={(e) => setTriggerName(e.target.value)}
              />

              <select
                className="input"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as 'webhook' | 'schedule')}
              >
                <option value="webhook">Webhook</option>
                <option value="schedule">Schedule</option>
              </select>

              <select
                className="input md:col-span-2"
                value={triggerTemplateSlug}
                onChange={(e) => setTriggerTemplateSlug(e.target.value)}
              >
                {(templates || []).map((t) => (
                  <option key={t.id} value={t.slug}>{t.name}</option>
                ))}
              </select>

              {triggerType === 'schedule' ? (
                <input
                  className="input md:col-span-2"
                  type="number"
                  min={1}
                  value={triggerScheduleMinutes}
                  onChange={(e) => setTriggerScheduleMinutes(Number(e.target.value) || 1)}
                  placeholder="Run every N minutes"
                />
              ) : (
                <input
                  className="input md:col-span-2"
                  placeholder="Webhook secret (optional)"
                  value={triggerWebhookSecret}
                  onChange={(e) => setTriggerWebhookSecret(e.target.value)}
                />
              )}
            </div>

            <button
              onClick={() => createTriggerMutation.mutate()}
              disabled={!triggerName.trim() || createTriggerMutation.isPending}
              className="mt-3 w-full inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-white font-semibold hover:bg-primary-500 disabled:opacity-60"
            >
              {createTriggerMutation.isPending ? 'Creating...' : 'Create Trigger'}
            </button>

            <div className="mt-4 space-y-2 max-h-[280px] overflow-auto">
              {(triggers || []).length === 0 ? (
                <p className="text-sm text-gray-500">No triggers yet.</p>
              ) : (triggers || []).map((trigger) => (
                <div key={trigger.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{trigger.name}</p>
                      <p className="text-xs text-gray-500">
                        {trigger.trigger_type} • {trigger.template_slug}
                        {trigger.trigger_type === 'schedule' && trigger.schedule_every_minutes ? ` • every ${trigger.schedule_every_minutes}m` : ''}
                      </p>
                      {trigger.trigger_type === 'webhook' && (
                        <p className="mt-1 text-xs text-gray-500 break-all">/api/agents/hooks/{trigger.webhook_key}/</p>
                      )}
                    </div>

                    {trigger.trigger_type === 'webhook' && (
                      <button
                        onClick={() => rotateSecretMutation.mutate(trigger.id)}
                        className="text-xs rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Rotate Secret
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Approvals</h2>
          <div className="mt-4 space-y-3">
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-gray-500">No pending approvals.</p>
            ) : pendingApprovals.map((a) => (
              <div key={a.id} className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 bg-amber-50/50 dark:bg-amber-900/10 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{a.step_key}</p>
                  <p className="text-xs text-gray-500">Run: {a.run}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate(a.id)}
                    className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-white text-sm hover:bg-green-500"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" /> Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(a.id)}
                    className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-white text-sm hover:bg-red-500"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-500 flex items-center gap-2">
          <PauseCircleIcon className="h-4 w-4" />
          Runs in waiting approval state resume automatically after approval.
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reliability Alerts</h2>
          <div className="mt-4 space-y-2">
            {(reliabilityAlerts || []).length === 0 ? (
              <p className="text-sm text-gray-500">No open reliability alerts.</p>
            ) : (reliabilityAlerts || []).map((alert) => (
              <div key={alert.id} className="rounded border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{alert.alert_type} ({alert.severity})</p>
                  <p className="text-xs text-gray-500">{alert.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Channels: {(alert.delivered_channels || []).length ? alert.delivered_channels?.join(', ') : 'none'}
                  </p>
                </div>
                <button
                  onClick={() => resolveAlertMutation.mutate(alert.id)}
                  className="text-xs rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
