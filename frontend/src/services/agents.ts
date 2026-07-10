/**
 * Agents (chat-runtime) service — typed API client + SSE streaming helpers.
 *
 * The chat-runtime backend lives at `/api/agents/chat/` (separate from the
 * enterprise control plane at `/api/agents/{workspaces,templates,runs,…}`)
 * and exposes:
 *
 * - GET    /api/agents/chat/conversations/                 — list conversations
 * - POST   /api/agents/chat/conversations/                 — create conversation (rare; usually auto-created)
 * - GET    /api/agents/chat/conversations/{id}/            — detail with messages
 * - PATCH  /api/agents/chat/conversations/{id}/            — rename / archive
 * - DELETE /api/agents/chat/conversations/{id}/            — delete
 * - GET    /api/agents/chat/conversations/{id}/runs/       — runs for a convo
 * - GET    /api/agents/chat/runs/                          — all runs
 * - GET    /api/agents/chat/tools/                         — function-calling catalogue
 * - GET    /api/agents/chat/workflows/                     — list workflows
 * - POST   /api/agents/chat/workflows/{slug}/run/          — run workflow (SSE)
 * - GET    /api/agents/chat/workflow-runs/                 — workflow run history
 * - POST   /api/agents/chat/ratings/                       — feedback
 * - POST   /api/agents/chat/stream/                        — chat stream (SSE)
 */

import { apiClient } from './api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

/* ─── Domain types ─────────────────────────────────────────────────────── */

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  tool_call_id?: string | null;
  tool_name?: string | null;
  tool_calls?: any[];
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: string;
  provider?: string;
  model?: string;
  is_error?: boolean;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count?: number;
}

export interface AgentConversationDetail extends AgentConversation {
  messages: AgentMessage[];
}

export interface AgentRunStep {
  id: string;
  index: number;
  kind: 'llm' | 'tool_call' | 'tool_result' | 'workflow_step';
  tool_name?: string | null;
  payload: any;
  duration_ms?: number;
  is_error?: boolean;
  created_at: string;
}

export interface AgentRun {
  id: string;
  conversation: string;
  status: 'running' | 'completed' | 'failed' | 'moderation_blocked';
  user_input: string;
  final_output: string;
  total_steps: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_usd: string;
  provider: string;
  model: string;
  started_at: string;
  finished_at?: string | null;
  error_message?: string;
  steps?: AgentRunStep[];
}

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  is_premium: boolean;
  parameters: any;
  available: boolean;
}

export interface ToolCatalogue {
  tools: AgentTool[];
  total: number;
}

export interface AgentWorkflow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  is_premium: boolean;
  is_builtin: boolean;
  is_active: boolean;
  inputs_schema: any;
  steps: any[];
  output_template?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow: string;
  workflow_slug?: string;
  status: 'running' | 'completed' | 'failed';
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  final_output: string;
  total_cost_usd: string;
  started_at: string;
  finished_at?: string | null;
  error_message?: string;
}

/* ─── SSE event shapes (server → client) ───────────────────────────────── */

export type AgentStreamEventType =
  | 'conversation'
  | 'run_start'
  | 'message_start'
  | 'token'
  | 'message_end'
  | 'tool_call'
  | 'tool_result'
  | 'done'
  | 'error'
  // Workflow events
  | 'workflow_start'
  | 'workflow_step_start'
  | 'workflow_step_end'
  | 'workflow_end';

export interface AgentStreamEvent<T = any> {
  type: AgentStreamEventType;
  data: T;
}

/* ─── REST calls ──────────────────────────────────────────────────────── */

const CHAT_BASE = '/agents/chat';

export const agentsService = {
  /* Conversations */
  listConversations: (archived = false) =>
    apiClient.get<{ results: AgentConversation[]; count: number } | AgentConversation[]>(
      `${CHAT_BASE}/conversations/?archived=${archived ? 'true' : 'false'}`
    ),

  getConversation: (id: string) =>
    apiClient.get<AgentConversationDetail>(`${CHAT_BASE}/conversations/${id}/`),

  createConversation: (title: string) =>
    apiClient.post<AgentConversation>(`${CHAT_BASE}/conversations/`, { title }),

  renameConversation: (id: string, title: string) =>
    apiClient.patch<AgentConversation>(`${CHAT_BASE}/conversations/${id}/`, { title }),

  archiveConversation: (id: string, archived: boolean = true) =>
    apiClient.patch<AgentConversation>(`${CHAT_BASE}/conversations/${id}/`, { is_archived: archived }),

  deleteConversation: (id: string) =>
    apiClient.delete<void>(`${CHAT_BASE}/conversations/${id}/`),

  conversationRuns: (id: string) =>
    apiClient.get<AgentRun[]>(`${CHAT_BASE}/conversations/${id}/runs/`),

  /* Runs */
  listRuns: () =>
    apiClient.get<{ results: AgentRun[]; count: number } | AgentRun[]>(`${CHAT_BASE}/runs/`),

  getRun: (id: string) => apiClient.get<AgentRun>(`${CHAT_BASE}/runs/${id}/`),

  /* Tools catalogue */
  listTools: () => apiClient.get<ToolCatalogue>(`${CHAT_BASE}/tools/`),

  /* Workflows */
  listWorkflows: () =>
    apiClient.get<{ results: AgentWorkflow[]; count: number } | AgentWorkflow[]>(
      `${CHAT_BASE}/workflows/`
    ),

  getWorkflow: (slug: string) =>
    apiClient.get<AgentWorkflow>(`${CHAT_BASE}/workflows/${slug}/`),

  listWorkflowRuns: () =>
    apiClient.get<{ results: WorkflowRun[]; count: number } | WorkflowRun[]>(
      `${CHAT_BASE}/workflow-runs/`
    ),

  getWorkflowRun: (id: string) =>
    apiClient.get<WorkflowRun>(`${CHAT_BASE}/workflow-runs/${id}/`),

  /* Ratings */
  rateMessage: (params: {
    message?: string;
    workflow_run?: string;
    rating: number;
    comment?: string;
  }) => apiClient.post(`${CHAT_BASE}/ratings/`, params),

  /* Streaming endpoints (SSE) — return a controllable subscription. */
  streamChat,
  streamWorkflow,
};

/* ─── Streaming helpers ────────────────────────────────────────────────── */

export interface StreamChatParams {
  message: string;
  conversation_id?: string;
  title?: string;
}

export interface StreamWorkflowParams {
  slug: string;
  inputs: Record<string, any>;
}

export interface StreamSubscription {
  /** Cancels the stream and aborts the underlying fetch. */
  cancel: () => void;
  /** Resolves when the stream finishes (success or error). */
  done: Promise<void>;
}

export interface StreamHandlers {
  onEvent?: (event: AgentStreamEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * POST to `/api/agents/stream/` and read a `text/event-stream` response.
 *
 * Browsers' built-in `EventSource` cannot send POST bodies, so we use
 * `fetch` + a custom SSE parser. Standard SSE framing is:
 *
 *     event: <name>\n
 *     data: <payload-line-1>\n
 *     data: <payload-line-2>\n
 *     <blank line>\n
 *
 * We accept either a named `event:` or the default unnamed event, with the
 * JSON envelope `{type, data}` inside `data:`.
 */
export function streamChat(
  params: StreamChatParams,
  handlers: StreamHandlers = {}
): StreamSubscription {
  return _stream(`${API_URL}/agents/chat/stream/`, params, handlers);
}

export function streamWorkflow(
  { slug, inputs }: StreamWorkflowParams,
  handlers: StreamHandlers = {}
): StreamSubscription {
  return _stream(`${API_URL}/agents/chat/workflows/${slug}/run/`, { inputs }, handlers);
}

function _stream(
  url: string,
  body: any,
  handlers: StreamHandlers
): StreamSubscription {
  const controller = new AbortController();
  const token = localStorage.getItem('access_token');

  const done = (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      if (controller.signal.aborted) {
        handlers.onComplete?.();
        return;
      }
      handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (!response.ok || !response.body) {
      let detail = `HTTP ${response.status}`;
      try {
        const txt = await response.text();
        if (txt) detail = txt;
      } catch {
        /* ignore */
      }
      handlers.onError?.(new Error(detail));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const emit = (rawDataLines: string[], eventName: string | null) => {
      if (!rawDataLines.length) return;
      const text = rawDataLines.join('\n').trim();
      if (!text) return;
      try {
        const parsed = JSON.parse(text);
        // The server uses named SSE frames: `event: <type>` + `data: <payload>`,
        // where the payload is the event's `data` (no `type` inside it). So the
        // SSE event name IS the event type. Fall back to an envelope `{type,data}`
        // or a bare token only when there's no event name.
        if (eventName) {
          handlers.onEvent?.({ type: eventName, data: parsed } as AgentStreamEvent);
        } else if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          handlers.onEvent?.(parsed as AgentStreamEvent);
        } else {
          handlers.onEvent?.({ type: 'token', data: parsed } as AgentStreamEvent);
        }
      } catch {
        handlers.onEvent?.({
          type: (eventName as any) || 'token',
          data: { delta: text },
        } as AgentStreamEvent);
      }
    };

    try {
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let blankIdx: number;
        while ((blankIdx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, blankIdx);
          buffer = buffer.slice(blankIdx + 2);
          if (!frame.trim()) continue;
          const lines = frame.split('\n');
          let evtName: string | null = null;
          const dataLines: string[] = [];
          for (const line of lines) {
            if (!line || line.startsWith(':')) continue; // comment / heartbeat
            if (line.startsWith('event:')) {
              evtName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).replace(/^ /, ''));
            }
          }
          emit(dataLines, evtName);
        }
      }
      // Flush any trailing frame.
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        let evtName: string | null = null;
        const dataLines: string[] = [];
        for (const line of lines) {
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) {
            evtName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }
        emit(dataLines, evtName);
      }
      handlers.onComplete?.();
    } catch (err: any) {
      if (controller.signal.aborted) {
        handlers.onComplete?.();
        return;
      }
      handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return {
    cancel: () => controller.abort(),
    done,
  };
}
