/**
 * Smoke tests for `useAgentChat`.
 *
 * Drives the hook through a complete streaming run by mocking `fetch` to
 * return scripted SSE frames, asserting that the message reducer applies
 * the events correctly.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentChat } from '../hooks/useAgentChat';

function frame(type: string, data: any) {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

beforeEach(() => {
  // @ts-expect-error - partial mock
  global.fetch = jest.fn();
  localStorage.clear();
});

afterEach(() => {
  // @ts-expect-error - reset
  delete global.fetch;
});

test('streams tokens into messages and ends in idle state', async () => {
  const stream = makeReadableStream([
    frame('conversation', { id: 'cid-1', title: 'Test' }),
    frame('run_start', { run_id: 'r1', conversation_id: 'cid-1', user_message_id: 'um-1' }),
    frame('message_start', { step: 1 }),
    frame('token', { delta: 'Hel' }),
    frame('token', { delta: 'lo' }),
    frame('message_end', { message_id: 'am-1', has_tool_calls: false }),
    frame('done', { status: 'completed', run_id: 'r1', final_output: 'Hello' }),
  ]);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: stream });

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    result.current.sendMessage('Hi');
  });

  // user message immediately appears
  expect(result.current.messages.length).toBe(1);
  expect(result.current.messages[0].role).toBe('user');

  await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 2000 });
  expect(result.current.conversationId).toBe('cid-1');
  expect(result.current.lastRunId).toBe('r1');
  // user + assistant
  expect(result.current.messages.length).toBe(2);
  expect(result.current.messages[1].role).toBe('assistant');
  expect(result.current.messages[1].content).toBe('Hello');
});

test('records a tool round-trip then a final assistant turn', async () => {
  const stream = makeReadableStream([
    frame('conversation', { id: 'cid-2', title: 'Tool test' }),
    frame('run_start', { run_id: 'r2', conversation_id: 'cid-2', user_message_id: 'um-2' }),
    frame('message_start', { step: 1 }),
    frame('tool_call', { id: 'tc-1', name: 'paraphrase_text', arguments: { text: 'hi' } }),
    frame('message_end', { message_id: 'am-2', has_tool_calls: true }),
    frame('tool_result', { id: 'tc-1', name: 'paraphrase_text', result: 'hello', duration_ms: 120, error: false }),
    frame('message_start', { step: 2 }),
    frame('token', { delta: 'Done' }),
    frame('message_end', { message_id: 'am-3', has_tool_calls: false }),
    frame('done', { status: 'completed', run_id: 'r2' }),
  ]);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: stream });

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    result.current.sendMessage('Use a tool');
  });

  await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 2000 });

  expect(result.current.messages.length).toBe(2);
  expect(result.current.messages[1].content).toBe('Done');
});

test('stream errors put the hook into error state', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 500,
    text: async () => 'boom',
  });

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    result.current.sendMessage('anything');
  });

  await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 2000 });
  expect(result.current.error).toMatch(/boom|HTTP 500/);
});
