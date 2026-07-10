import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { ArrowLeftIcon, StopCircleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface StepRun {
  id: string;
  step_key: string;
  step_type: string;
  status: string;
  retry_count: number;
  latency_ms: number;
  error_message: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
}

interface RunDetail {
  id: string;
  template_slug: string;
  status: string;
  trigger_type: string;
  input_payload_json: Record<string, unknown>;
  output_payload_json: Record<string, unknown>;
  error_summary: string;
  duration_ms: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  step_runs: StepRun[];
  metrics?: {
    total_tokens: number;
    estimated_cost_usd: string | number;
    steps_total: number;
    steps_failed: number;
    steps_retried: number;
  };
}

const StepIOInspector: React.FC<{ step: StepRun }> = ({ step }) => {
  const [open, setOpen] = useState(false);
  const hasData = step.input_json || step.output_json;
  if (!hasData) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center text-xs font-medium text-primary-600 hover:text-primary-500"
      >
        {open ? <ChevronDownIcon className="h-3.5 w-3.5 mr-1" /> : <ChevronRightIcon className="h-3.5 w-3.5 mr-1" />}
        {open ? 'Hide' : 'Inspect'} I/O
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {step.input_json && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Input</p>
              <pre className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-60">
                {JSON.stringify(step.input_json, null, 2)}
              </pre>
            </div>
          )}
          {step.output_json && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Output</p>
              <pre className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-60">
                {JSON.stringify(step.output_json, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RunIOSection: React.FC<{ title: string; data: Record<string, unknown> }> = ({ title, data }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center text-sm font-semibold text-gray-900 dark:text-white"
      >
        {open ? <ChevronDownIcon className="h-4 w-4 mr-1" /> : <ChevronRightIcon className="h-4 w-4 mr-1" />}
        {title}
      </button>
      {open && (
        <pre className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-80">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

const AgentRunDetailPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const qc = useQueryClient();

  usePageTitle('Agent Run Details');

  const { data: run, isLoading } = useQuery<RunDetail>({
    queryKey: ['agent-run-detail', runId],
    queryFn: () => apiClient.get(`/agents/runs/${runId}/`),
    enabled: !!runId,
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post(`/agents/runs/${runId}/cancel/`),
    onSuccess: () => {
      toast.success('Run cancelled');
      qc.invalidateQueries({ queryKey: ['agent-run-detail', runId] });
      qc.invalidateQueries({ queryKey: ['agent-runs'] });
      qc.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: () => toast.error('Failed to cancel run'),
  });

  if (isLoading || !run) {
    return <div className="mx-auto max-w-5xl px-6 py-14 text-gray-500">Loading run details...</div>;
  }

  const canCancel = !['succeeded', 'failed', 'cancelled'].includes(run.status);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link to="/agents" className="inline-flex items-center text-primary-600 hover:text-primary-500">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Agents
        </Link>

        <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{run.template_slug}</h1>
              <p className="text-sm text-gray-500 mt-1">Run ID: {run.id}</p>
            </div>

            {canCancel && (
              <button
                onClick={() => cancelMutation.mutate()}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-500"
              >
                <StopCircleIcon className="h-4 w-4 mr-2" />
                Cancel Run
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><span className="text-gray-500">Status</span><p className="font-semibold text-gray-900 dark:text-white">{run.status}</p></div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><span className="text-gray-500">Duration</span><p className="font-semibold text-gray-900 dark:text-white">{run.duration_ms} ms</p></div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><span className="text-gray-500">Tokens</span><p className="font-semibold text-gray-900 dark:text-white">{run.metrics?.total_tokens ?? 0}</p></div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><span className="text-gray-500">Estimated Cost</span><p className="font-semibold text-gray-900 dark:text-white">${Number(run.metrics?.estimated_cost_usd ?? 0).toFixed(4)}</p></div>
          </div>

          {run.error_summary && (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              {run.error_summary}
            </div>
          )}
        </div>

        {(run.input_payload_json && Object.keys(run.input_payload_json).length > 0) && (
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <RunIOSection title="Run Input" data={run.input_payload_json} />
          </div>
        )}

        {(run.output_payload_json && Object.keys(run.output_payload_json).length > 0) && (
          <div className="mt-4 rounded-2xl border border-green-200 dark:border-green-800 p-6">
            <RunIOSection title="Run Output" data={run.output_payload_json} />
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Step Timeline</h2>
          <div className="mt-4 space-y-3">
            {run.step_runs.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{s.step_key}</p>
                    <p className="text-xs text-gray-500">{s.step_type} • retries: {s.retry_count} • {s.latency_ms} ms</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    {s.status}
                  </span>
                </div>

                {s.error_message && (
                  <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-700 dark:text-red-300">
                    {s.error_message}
                  </div>
                )}

                <StepIOInspector step={s} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentRunDetailPage;
