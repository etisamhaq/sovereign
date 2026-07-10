/**
 * ChatBot — floating agent UI powered by the streaming `useAgentChat` hook.
 *
 * Behaviour
 *   • Pops out from a floating bubble.
 *   • Streams agent responses token-by-token via SSE.
 *   • Renders tool invocations inline with status / duration.
 *   • Lets the user start new chats and switch between recent conversations.
 *   • Cancels in-flight streams on close, route change, or unmount.
 *
 * The component intentionally stays self-contained so it can drop into the
 * existing `<ConditionalChatBot/>` slot in `App.tsx`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  PlusIcon,
  StopIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon as ChatBubbleSolid } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useAgentChat, ToolInvocation } from '../hooks/useAgentChat';
import { agentsService, AgentConversation, AgentMessage } from '../services/agents';

const QUICK_SUGGESTIONS = [
  'Write a 600-word blog post about morning routines',
  'Summarize this paragraph and turn it into a tweet thread',
  'Generate flashcards from a topic I\'m studying',
  'Paraphrase this and improve clarity',
  'Plan a 5-step LinkedIn launch campaign',
  'Help me brainstorm names for a new app',
];

const ChatBot: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [hasUnread, setHasUnread] = useState(false);

  const queryClient = useQueryClient();

  const chat = useAgentChat({
    conversationId: activeConversationId,
    onConversationCreated: (id) => {
      setActiveConversationId(id);
      // The list has a new conversation — refresh sidebar.
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });

  // Notify on unread messages when closed
  const lastSeenMsgCountRef = useRef(0);
  useEffect(() => {
    if (!isOpen && chat.messages.length > lastSeenMsgCountRef.current) {
      setHasUnread(true);
    }
    if (isOpen) {
      lastSeenMsgCountRef.current = chat.messages.length;
      setHasUnread(false);
    }
  }, [chat.messages.length, isOpen]);

  // When a streaming run completes, refresh history (cost/usage updates).
  useEffect(() => {
    if (chat.status === 'idle' && chat.conversationId) {
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    }
  }, [chat.status, chat.conversationId, queryClient]);

  if (!isAuthenticated) return null;

  const toggleChat = () => {
    setIsOpen((v) => !v);
    if (!isOpen) setHasUnread(false);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-6 z-50 w-[420px] h-[600px] max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            role="dialog"
            aria-label="Sovereign Agent"
          >
            <ChatHeader
              view={view}
              onSwitch={(v) => setView(v)}
              onClose={() => setIsOpen(false)}
              onNewChat={() => {
                chat.startNewChat();
                setActiveConversationId(undefined);
                setView('chat');
              }}
              title={chat.conversationTitle}
            />

            {view === 'chat' ? (
              <ChatPane chat={chat} />
            ) : (
              <ConversationsPane
                activeId={activeConversationId}
                onSelect={(id) => {
                  setActiveConversationId(id);
                  setView('chat');
                }}
                onDeleted={(id) => {
                  if (id === activeConversationId) {
                    chat.startNewChat();
                    setActiveConversationId(undefined);
                  }
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <XMarkIcon className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChatBubbleSolid className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {hasUnread && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
          />
        )}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-20" />
        )}
      </motion.button>
    </>
  );
};

/* ─── Header ─────────────────────────────────────────────────────────── */

interface ChatHeaderProps {
  view: 'chat' | 'history';
  onSwitch: (v: 'chat' | 'history') => void;
  onClose: () => void;
  onNewChat: () => void;
  title: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ view, onSwitch, onClose, onNewChat, title }) => (
  <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        <SparklesIcon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h3 className="text-white font-semibold text-sm truncate">Sovereign Agent</h3>
        <p className="text-primary-100 text-xs truncate">{title || 'New chat'}</p>
      </div>
    </div>
    <div className="flex items-center gap-1">
      <HeaderButton
        onClick={onNewChat}
        active={false}
        title="New chat"
        ariaLabel="Start a new chat"
      >
        <PlusIcon className="w-4 h-4" />
      </HeaderButton>
      <HeaderButton
        onClick={() => onSwitch(view === 'chat' ? 'history' : 'chat')}
        active={view === 'history'}
        title="Conversations"
        ariaLabel="Toggle conversations list"
      >
        <ClockIcon className="w-4 h-4" />
      </HeaderButton>
      <HeaderButton onClick={onClose} title="Close" ariaLabel="Close chat">
        <XMarkIcon className="w-4 h-4" />
      </HeaderButton>
    </div>
  </div>
);

interface HeaderButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ onClick, active, title, ariaLabel, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={ariaLabel}
    className={`p-1.5 rounded-lg transition-colors ${
      active ? 'bg-white/25 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

/* ─── Chat pane ──────────────────────────────────────────────────────── */

interface ChatPaneProps {
  chat: ReturnType<typeof useAgentChat>;
}

const ChatPane: React.FC<ChatPaneProps> = ({ chat }) => {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length, chat.streamingText, chat.toolInvocations.length, chat.status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || chat.isStreaming) return;
    chat.sendMessage(draft);
    setDraft('');
  };

  const empty = chat.messages.length === 0 && !chat.streamingText;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {empty && <WelcomeBlock onPick={(s) => chat.sendMessage(s)} />}

        {chat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Tool invocation cards (current turn) */}
        {chat.toolInvocations.length > 0 && (
          <div className="space-y-1.5">
            {chat.toolInvocations.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* Live streaming bubble */}
        {chat.streamingText && (
          <MessageBubble
            message={{
              id: '__streaming__',
              role: 'assistant',
              content: chat.streamingText,
              created_at: new Date().toISOString(),
            }}
            streaming
          />
        )}

        {/* Status / typing indicator */}
        {(chat.status === 'connecting' || chat.status === 'thinking') && !chat.streamingText && (
          <TypingIndicator label={chat.status === 'thinking' ? 'Working with tools…' : 'Connecting…'} />
        )}

        {chat.status === 'error' && chat.error && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="break-words">{chat.error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
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
            placeholder="Ask the agent anything…"
            rows={1}
            disabled={false}
            className="flex-1 resize-none text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-32"
            maxLength={4000}
          />
          {chat.isStreaming ? (
            <button
              type="button"
              onClick={chat.cancel}
              title="Stop generation"
              aria-label="Stop generation"
              className="p-2.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-colors flex-shrink-0"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="p-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </>
  );
};

/* ─── Message rendering ──────────────────────────────────────────────── */

interface MessageBubbleProps {
  message: AgentMessage;
  streaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, streaming }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) return null; // Tool messages are surfaced via ToolCard.

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
          <SparklesIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'ml-auto' : ''}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-md prose-invert'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || ''}
            </ReactMarkdown>
          )}
          {streaming && <span className="inline-block ml-1 w-1.5 h-3 align-middle bg-current opacity-70 animate-pulse" />}
        </div>
      </div>
    </div>
  );
};

/* ─── Tool card ──────────────────────────────────────────────────────── */

const ToolCard: React.FC<{ tool: ToolInvocation }> = ({ tool }) => {
  const finished = tool.result !== undefined || tool.error;
  return (
    <div className="ml-9 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
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
          <pre className="mt-1 max-h-32 overflow-auto bg-white dark:bg-gray-900 rounded px-2 py-1.5 text-[11px]">
            {JSON.stringify(tool.arguments, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

/* ─── Welcome / quick suggestions ────────────────────────────────────── */

const WelcomeBlock: React.FC<{ onPick: (s: string) => void }> = ({ onPick }) => (
  <div>
    <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-2xl p-4 text-sm text-gray-700 dark:text-gray-200">
      <div className="flex items-center gap-2 mb-1.5">
        <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <strong>Welcome to Sovereign Agent</strong>
      </div>
      <p>
        I'm an AI agent with access to over 30 writing, research, and content tools.
        Tell me what you want to create — I'll plan it, call the tools I need, and stream the result.
      </p>
    </div>
    <div className="mt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Try one of these:</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="text-xs px-2.5 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors border border-primary-200 dark:border-primary-800 text-left"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const TypingIndicator: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-start gap-2">
    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
      <SparklesIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
    </div>
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
      </div>
      {label && <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
    </div>
  </div>
);

/* ─── Conversations pane ─────────────────────────────────────────────── */

interface ConversationsPaneProps {
  activeId?: string;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}

const ConversationsPane: React.FC<ConversationsPaneProps> = ({ activeId, onSelect, onDeleted }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-conversations'],
    queryFn: async () => {
      const r = await agentsService.listConversations(false);
      const list = Array.isArray(r) ? r : (r as any).results || [];
      return list as AgentConversation[];
    },
    staleTime: 15_000,
  });

  const handleArchive = async (id: string) => {
    try {
      await agentsService.archiveConversation(id, true);
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
      toast.success('Conversation archived');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await agentsService.deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
      onDeleted(id);
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
          Recent conversations
        </h4>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {isLoading && <div className="text-xs text-gray-500 dark:text-gray-400 px-1">Loading…</div>}
      {isError && (
        <div className="text-xs text-red-600 dark:text-red-400 px-1">
          Failed to load conversations
        </div>
      )}
      {!isLoading && !isError && (data || []).length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
          No conversations yet. Start a new chat to see it here.
        </div>
      )}

      <ul className="space-y-1.5">
        {(data || []).map((c) => (
          <li
            key={c.id}
            className={`group rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
              c.id === activeId
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelect(c.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {c.title || 'Untitled chat'}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {new Date(c.last_message_at || c.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  title="Archive"
                  aria-label="Archive conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(c.id);
                  }}
                >
                  <ArchiveBoxIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete"
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatBot;
