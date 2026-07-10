/**
 * `useAgentChat` — React hook that drives the streaming agent chat UX.
 *
 * Responsibilities:
 *
 *   1. Maintain in-memory message list + assistant streaming buffer.
 *   2. Open / close SSE subscriptions (`agentsService.streamChat`).
 *   3. Persist the active conversation id so the user can resume.
 *   4. Surface granular streaming state for the UI: `connecting`, `streaming`,
 *      `thinking` (between tool round-trips), `idle`, `error`.
 *   5. Expose helpers to load an existing conversation / start a new one.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  agentsService,
  AgentMessage,
  AgentStreamEvent,
  StreamSubscription,
} from '../services/agents';

export type ChatStatus = 'idle' | 'connecting' | 'streaming' | 'thinking' | 'error';

export interface ToolInvocation {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  duration_ms?: number;
  error?: boolean;
  startedAt: number;
}

interface ChatState {
  conversationId: string | null;
  conversationTitle: string;
  messages: AgentMessage[];
  /** The token-streamed buffer for the *currently-arriving* assistant turn. */
  streamingText: string;
  /** Tools called during the current turn (cleared on next turn). */
  toolInvocations: ToolInvocation[];
  status: ChatStatus;
  error: string | null;
  lastRunId: string | null;
}

type Action =
  | { type: 'reset'; conversationId?: string | null; title?: string }
  | { type: 'load'; messages: AgentMessage[]; conversationId: string; title: string }
  | { type: 'user_send'; tempMessage: AgentMessage }
  | { type: 'event'; event: AgentStreamEvent }
  | { type: 'stream_error'; message: string }
  | { type: 'stream_done' }
  | { type: 'set_title'; title: string };

const initialState: ChatState = {
  conversationId: null,
  conversationTitle: 'New chat',
  messages: [],
  streamingText: '',
  toolInvocations: [],
  status: 'idle',
  error: null,
  lastRunId: null,
};

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'reset':
      return {
        ...initialState,
        conversationId: action.conversationId ?? null,
        conversationTitle: action.title ?? 'New chat',
      };
    case 'load':
      return {
        ...initialState,
        conversationId: action.conversationId,
        conversationTitle: action.title,
        messages: action.messages,
      };
    case 'user_send':
      return {
        ...state,
        messages: [...state.messages, action.tempMessage],
        streamingText: '',
        toolInvocations: [],
        status: 'connecting',
        error: null,
      };
    case 'set_title':
      return { ...state, conversationTitle: action.title };
    case 'stream_error':
      return { ...state, status: 'error', error: action.message };
    case 'stream_done':
      return {
        ...state,
        status: 'idle',
        streamingText: '',
        toolInvocations: [],
      };
    case 'event':
      return applyEvent(state, action.event);
    default:
      return state;
  }
}

function applyEvent(state: ChatState, event: AgentStreamEvent): ChatState {
  switch (event.type) {
    case 'conversation': {
      const data = event.data as { id: string; title: string };
      return {
        ...state,
        conversationId: data.id,
        conversationTitle: data.title || state.conversationTitle,
      };
    }
    case 'run_start': {
      const data = event.data as { run_id: string };
      return { ...state, lastRunId: data.run_id, status: 'streaming' };
    }
    case 'message_start':
      return { ...state, status: 'streaming' };
    case 'token': {
      const data = event.data as { delta: string };
      return { ...state, streamingText: state.streamingText + (data.delta || '') };
    }
    case 'message_end': {
      // Flush the streaming buffer into a real assistant message
      // (only if we actually got text — pure tool-call turns yield no tokens).
      const data = event.data as { message_id: string; has_tool_calls: boolean };
      if (!state.streamingText && !data.has_tool_calls) return state;
      const newMessages = state.streamingText
        ? [
            ...state.messages,
            {
              id: data.message_id || `tmp-${Date.now()}`,
              role: 'assistant' as const,
              content: state.streamingText,
              created_at: new Date().toISOString(),
            },
          ]
        : state.messages;
      return {
        ...state,
        messages: newMessages,
        streamingText: '',
        status: data.has_tool_calls ? 'thinking' : state.status,
      };
    }
    case 'tool_call': {
      const data = event.data as { id: string; name: string; arguments: any };
      return {
        ...state,
        status: 'thinking',
        toolInvocations: [
          ...state.toolInvocations,
          {
            id: data.id,
            name: data.name,
            arguments: data.arguments || {},
            startedAt: Date.now(),
          },
        ],
      };
    }
    case 'tool_result': {
      const data = event.data as {
        id: string;
        name: string;
        result: any;
        duration_ms: number;
        error: boolean;
      };
      return {
        ...state,
        toolInvocations: state.toolInvocations.map((t) =>
          t.id === data.id
            ? { ...t, result: data.result, duration_ms: data.duration_ms, error: data.error }
            : t
        ),
      };
    }
    case 'done': {
      const data = event.data as { status: string; final_output?: string };
      return {
        ...state,
        status: data.status === 'failed' ? 'error' : 'idle',
        streamingText: '',
      };
    }
    case 'error': {
      const data = event.data as { message: string };
      return { ...state, status: 'error', error: data.message };
    }
    default:
      return state;
  }
}

export interface UseAgentChatOptions {
  /** Optionally hydrate the chat with an existing conversation. */
  conversationId?: string;
  /** Called when the conversation id is first known (for URL sync, etc). */
  onConversationCreated?: (id: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { conversationId: initialConversationId, onConversationCreated } = options;
  const [state, dispatch] = useReducer(reducer, initialState);
  const subscriptionRef = useRef<StreamSubscription | null>(null);
  const conversationCreatedRef = useRef<string | null>(null);

  // Hydrate when conversationId prop changes.
  useEffect(() => {
    let cancelled = false;
    if (!initialConversationId) {
      dispatch({ type: 'reset', conversationId: null });
      return;
    }
    (async () => {
      try {
        const data = await agentsService.getConversation(initialConversationId);
        if (cancelled) return;
        dispatch({
          type: 'load',
          conversationId: data.id,
          title: data.title || 'Chat',
          messages: data.messages || [],
        });
      } catch (err: any) {
        if (cancelled) return;
        dispatch({
          type: 'stream_error',
          message: err?.response?.data?.detail || err?.message || 'Failed to load conversation',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  // Notify caller when a new conversation id appears.
  useEffect(() => {
    if (
      state.conversationId &&
      conversationCreatedRef.current !== state.conversationId
    ) {
      conversationCreatedRef.current = state.conversationId;
      if (state.conversationId !== initialConversationId) {
        onConversationCreated?.(state.conversationId);
      }
    }
  }, [state.conversationId, onConversationCreated, initialConversationId]);

  const cancel = useCallback(() => {
    subscriptionRef.current?.cancel();
    subscriptionRef.current = null;
    dispatch({ type: 'stream_done' });
  }, []);

  // Cancel any in-flight stream when unmounting.
  useEffect(() => {
    return () => {
      subscriptionRef.current?.cancel();
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.status === 'connecting' || state.status === 'streaming' || state.status === 'thinking') {
        return;
      }
      const tempUserMsg: AgentMessage = {
        id: `tmp-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'user_send', tempMessage: tempUserMsg });

      subscriptionRef.current?.cancel();
      subscriptionRef.current = agentsService.streamChat(
        {
          message: trimmed,
          conversation_id: state.conversationId || undefined,
        },
        {
          onEvent: (event) => dispatch({ type: 'event', event }),
          onError: (err) =>
            dispatch({ type: 'stream_error', message: err.message || 'Stream error' }),
          onComplete: () => dispatch({ type: 'stream_done' }),
        }
      );
    },
    [state.conversationId, state.status]
  );

  const startNewChat = useCallback(() => {
    subscriptionRef.current?.cancel();
    subscriptionRef.current = null;
    conversationCreatedRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  const renameConversation = useCallback(
    async (title: string) => {
      if (!state.conversationId) {
        dispatch({ type: 'set_title', title });
        return;
      }
      try {
        await agentsService.renameConversation(state.conversationId, title);
        dispatch({ type: 'set_title', title });
      } catch (err: any) {
        dispatch({
          type: 'stream_error',
          message: err?.response?.data?.detail || 'Could not rename conversation',
        });
      }
    },
    [state.conversationId]
  );

  return {
    ...state,
    isStreaming:
      state.status === 'streaming' ||
      state.status === 'thinking' ||
      state.status === 'connecting',
    sendMessage,
    cancel,
    startNewChat,
    renameConversation,
  };
}
