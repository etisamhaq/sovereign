/**
 * AgentPage — full-screen Sovereign Agent workspace.
 *
 * Layout
 *   [ Conversations sidebar ] [ Chat panel ] [ Tools / runs panel ]
 *
 * The page is a "Pro" version of the floating ChatBot widget — same hook,
 * richer surface area for managing many parallel conversations and seeing
 * what the agent is doing under the hood (token usage, cost, tool runs).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  PaperAirplaneIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
  ArchiveBoxIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentChat, ToolInvocation } from '../hooks/useAgentChat';
import {
  agentsService,
  AgentConversation,
  AgentMessage,
  AgentTool,
} from '../services/agents';

const AgentPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const conversationId = searchParams.get('c') || undefined;

  const chat = useAgentChat({
    conversationId,
    onConversationCreated: (id) => {
      const next = new URLSearchParams(searchParams);
      next.set('c', id);
      setSearchParams(next, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });

  const conversationsQ = useQuery({
    queryKey: ['agent-conversations'],
    queryFn: async () => {
      const r = await agentsService.listConversations(false);
      const list = Array.isArray(r) ? r : (r as any).results || [];
      return list as AgentConversation[];
    },
    staleTime: 15_000,
  });

  const toolsQ = useQuery({
    queryKey: ['agent-tools'],
    queryFn: () => agentsService.listTools(),
    staleTime: 60_000,
  });

  const handleSelect = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('c', id);
    setSearchParams(next, { replace: false });
  };

  const handleNew = () => {
    chat.startNewChat();
    const next = new URLSearchParams(searchParams);
    next.delete('c');
    setSearchParams(next, { replace: false });
  };

  return (
    <>
      <Helmet>
        <title>Agent · Sovereign</title>
      </Helmet>
      <div className="h-[calc(100vh-4rem)] grid grid-cols-12 gap-0 bg-gray-50 dark:bg-gray-950">
        <Sidebar
          conversations={conversationsQ.data || []}
          activeId={conversationId}
          isLoading={conversationsQ.isLoading}
          onSelect={handleSelect}
          onNew={handleNew}
        />
        <main className="col-span-12 md:col-span-7 lg:col-span-7 flex flex-col bg-white dark:bg-gray-900 border-x border-gray-200 dark:border-gray-800 min-h-0">
          <ChatStream chat={chat} />
        </main>
        <aside className="hidden lg:flex col-span-3 flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-0">
          <RightRail tools={toolsQ.data?.tools || []} chat={chat} />
        </aside>
      </div>
    </>
  );
};

/* ─── Sidebar ────────────────────────────────────────────────────────── */

interface SidebarProps {
  conversations: AgentConversation[];
  activeId?: string;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ conversations, activeId, isLoading, onSelect, onNew }) => {
  const queryClient = useQueryClient();

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await agentsService.archiveConversation(id, true);
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    } catch {
      toast.error('Could not archive conversation');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await agentsService.deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
      if (id === activeId) {
        onNew();
      }
    } catch {
      toast.error('Could not delete');
    }
  };

  return (
    <aside className="hidden md:flex col-span-2 lg:col-span-2 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 min-h-0">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 min-h-0">
        {isLoading && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">Loading…</div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
            No conversations yet.
          </div>
        )}
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group relative px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                c.id === activeId
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="text-sm font-medium truncate">{c.title || 'Untitled'}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(c.last_message_at || c.updated_at).toLocaleDateString()}
              </div>
              <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded">
                <button
                  type="button"
                  onClick={(e) => handleArchive(e, c.id)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  title="Archive"
                  aria-label="Archive conversation"
                >
                  <ArchiveBoxIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, c.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete"
                  aria-label="Delete conversation"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

/* ─── Chat stream (centre) ───────────────────────────────────────────── */

interface ChatStreamProps {
  chat: ReturnType<typeof useAgentChat>;
}

const ChatStream: React.FC<ChatStreamProps> = ({ chat }) => {
  const [draft, setDraft] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, chat.streamingText, chat.toolInvocations.length, chat.status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || chat.isStreaming) return;
    chat.sendMessage(draft);
    setDraft('');
  };

  return (
    <>
      <header className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {chat.conversationTitle || 'New chat'}
            </h1>
          </div>
          {chat.lastRunId && (
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 truncate">
              run {chat.lastRunId.slice(0, 8)}…
            </p>
          )}
        </div>
        <Status status={chat.status} />
      </header>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
        {chat.messages.length === 0 && !chat.streamingText && (
          <EmptyState onPick={(s) => chat.sendMessage(s)} />
        )}
        {chat.messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {chat.toolInvocations.length > 0 && (
          <div className="space-y-2">
            {chat.toolInvocations.map((t) => (
              <ToolBlock key={t.id} tool={t} />
            ))}
          </div>
        )}
        {chat.streamingText && (
          <Bubble
            message={{
              id: '__streaming__',
              role: 'assistant',
              content: chat.streamingText,
              created_at: new Date().toISOString(),
            }}
            streaming
          />
        )}
        {(chat.status === 'connecting' || chat.status === 'thinking') && !chat.streamingText && (
          <div className="text-sm text-gray-500 dark:text-gray-400 ml-9">
            {chat.status === 'thinking' ? 'Calling tools…' : 'Connecting…'}
          </div>
        )}
        {chat.status === 'error' && chat.error && (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl flex items-start gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="break-words">{chat.error}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message Sovereign Agent…"
            rows={1}
            className="flex-1 resize-none text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-40"
            maxLength={8000}
          />
          {chat.isStreaming ? (
            <button
              type="button"
              onClick={chat.cancel}
              title="Stop generation"
              aria-label="Stop generation"
              className="p-3 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-colors flex-shrink-0"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="p-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          )}
        </form>
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1.5">
          Enter to send · Shift+Enter for newline · Tools run server-side with audit logs
        </p>
      </div>
    </>
  );
};

const Status: React.FC<{ status: ReturnType<typeof useAgentChat>['status'] }> = ({ status }) => {
  const map: Record<typeof status, { label: string; cls: string }> = {
    idle: { label: 'Ready', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' },
    connecting: {
      label: 'Connecting…',
      cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    },
    streaming: {
      label: 'Streaming',
      cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    },
    thinking: {
      label: 'Working',
      cls: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    },
    error: {
      label: 'Error',
      cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    },
  };
  const m = map[status];
  return (
    <span className={`text-[11px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
};

/* ─── Bubble & tool blocks ───────────────────────────────────────────── */

const Bubble: React.FC<{ message: AgentMessage; streaming?: boolean }> = ({ message, streaming }) => {
  const isUser = message.role === 'user';
  if (message.role === 'tool') return null;
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
          <SparklesIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'ml-auto' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
          )}
          {streaming && <span className="inline-block ml-1 w-1.5 h-3 align-middle bg-current opacity-70 animate-pulse" />}
        </div>
        {message.cost_usd && parseFloat(message.cost_usd) > 0 && !isUser && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 ml-1">
            <CurrencyDollarIcon className="w-3 h-3 inline-block mr-0.5" />${message.cost_usd}
          </p>
        )}
      </div>
    </div>
  );
};

const ToolBlock: React.FC<{ tool: ToolInvocation }> = ({ tool }) => {
  const finished = tool.result !== undefined || tool.error;
  return (
    <div className="ml-11 max-w-[calc(80%-2.75rem)] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <WrenchScrewdriverIcon className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
          <code className="font-medium text-gray-800 dark:text-gray-100 truncate">{tool.name}</code>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tool.duration_ms !== undefined && (
            <span className="text-gray-500 dark:text-gray-400">{tool.duration_ms}ms</span>
          )}
          {tool.error ? (
            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
          ) : finished ? (
            <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          )}
        </div>
      </div>
      {Object.keys(tool.arguments || {}).length > 0 && (
        <details className="mt-1.5 text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
            arguments
          </summary>
          <pre className="mt-1 max-h-36 overflow-auto bg-white dark:bg-gray-900 rounded px-2 py-1.5 text-[11px]">
            {JSON.stringify(tool.arguments, null, 2)}
          </pre>
        </details>
      )}
      {finished && tool.result !== undefined && (
        <details className="mt-1.5 text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
            result
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto bg-white dark:bg-gray-900 rounded px-2 py-1.5 text-[11px] whitespace-pre-wrap break-words">
            {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ onPick: (s: string) => void }> = ({ onPick }) => {
  const samples = [
    'Write a 600-word blog post about morning routines',
    'Summarise this paragraph and turn it into a tweet thread',
    'Generate flashcards from a topic I am studying',
    'Draft a 5-step LinkedIn launch campaign',
  ];
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900 mb-4">
        <SparklesIcon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        What can the agent help you with?
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Describe what you want and the agent will pick the right tools, run them, and stream the answer.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
        {samples.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ─── Right rail: tools & current run details ───────────────────────── */

const RightRail: React.FC<{ tools: AgentTool[]; chat: ReturnType<typeof useAgentChat> }> = ({ tools, chat }) => {
  const [tab, setTab] = useState<'tools' | 'run'>('run');

  return (
    <>
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex gap-1">
        <RailTab active={tab === 'run'} onClick={() => setTab('run')} icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}>
          Run
        </RailTab>
        <RailTab active={tab === 'tools'} onClick={() => setTab('tools')} icon={<WrenchScrewdriverIcon className="w-4 h-4" />}>
          Tools ({tools.length})
        </RailTab>
      </div>
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {tab === 'run' ? <RunDetails chat={chat} /> : <ToolList tools={tools} />}
      </div>
    </>
  );
};

const RailTab: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
      active
        ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {icon}
    {children}
  </button>
);

const RunDetails: React.FC<{ chat: ReturnType<typeof useAgentChat> }> = ({ chat }) => {
  const tokens = useMemo(() => {
    const p = chat.messages.reduce((sum, m) => sum + (m.prompt_tokens || 0), 0);
    const c = chat.messages.reduce((sum, m) => sum + (m.completion_tokens || 0), 0);
    return { prompt: p, completion: c };
  }, [chat.messages]);

  const cost = useMemo(
    () => chat.messages.reduce((sum, m) => sum + parseFloat(m.cost_usd || '0'), 0),
    [chat.messages]
  );

  return (
    <div className="space-y-3 text-sm">
      <KV label="Status" value={chat.status} />
      <KV label="Conversation" value={chat.conversationId?.slice(0, 12) ?? '—'} />
      <KV label="Last run" value={chat.lastRunId?.slice(0, 12) ?? '—'} />
      <KV label="Messages" value={String(chat.messages.length)} />
      <KV label="Prompt tokens" value={tokens.prompt.toLocaleString()} />
      <KV label="Completion tokens" value={tokens.completion.toLocaleString()} />
      <KV label="Cost (USD)" value={`$${cost.toFixed(6)}`} />

      {chat.toolInvocations.length > 0 && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
            Live tool calls
          </h4>
          <ul className="space-y-1">
            {chat.toolInvocations.map((t) => (
              <li key={t.id} className="text-xs">
                <code>{t.name}</code>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  {t.duration_ms ? `${t.duration_ms}ms` : 'pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const KV: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-2 text-xs">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-mono text-gray-800 dark:text-gray-100 truncate">{value}</span>
  </div>
);

const ToolList: React.FC<{ tools: AgentTool[] }> = ({ tools }) => {
  if (!tools.length) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No tools registered.</p>;
  }
  const grouped = tools.reduce<Record<string, AgentTool[]>>((acc, t) => {
    const k = t.category || 'general';
    (acc[k] = acc[k] || []).push(t);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            {cat}
          </h4>
          <ul className="space-y-1">
            {list.map((t) => (
              <li
                key={t.name}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-medium text-gray-800 dark:text-gray-100 truncate">{t.name}</code>
                  {t.is_premium && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 flex-shrink-0">
                      PRO
                    </span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default AgentPage;
