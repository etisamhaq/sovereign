/**
 * Smoke tests for the agents service:
 *   - SSE parser correctly handles multi-event frames, comments, and split chunks.
 *   - REST helpers proxy correctly to apiClient.
 *
 * We mock `fetch` so no network is touched.
 */

import { agentsService, streamChat, AgentStreamEvent } from '../services/agents';
import { apiClient } from '../services/api';

jest.mock('../services/api');
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

/* ─── Helpers ──────────────────────────────────────────────────────── */

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

function frame(type: string, data: any) {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  // @ts-expect-error - we provide a partial Response mock
  global.fetch = jest.fn();
});

afterEach(() => {
  // @ts-expect-error - reset
  delete global.fetch;
});

/* ─── REST helpers ─────────────────────────────────────────────────── */

describe('agentsService REST', () => {
  test('listConversations calls correct endpoint', async () => {
    mockApiClient.get.mockResolvedValueOnce({ results: [], count: 0 });
    await agentsService.listConversations(false);
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/agents/chat/conversations/?archived=false'
    );
  });

  test('listConversations(archived=true) sends archived flag', async () => {
    mockApiClient.get.mockResolvedValueOnce({ results: [], count: 0 });
    await agentsService.listConversations(true);
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/agents/chat/conversations/?archived=true'
    );
  });

  test('renameConversation patches title', async () => {
    mockApiClient.patch.mockResolvedValueOnce({});
    await agentsService.renameConversation('cid-1', 'New name');
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/agents/chat/conversations/cid-1/',
      { title: 'New name' }
    );
  });

  test('rateMessage POSTs to ratings', async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    await agentsService.rateMessage({ message: 'mid', rating: 5 });
    expect(mockApiClient.post).toHaveBeenCalledWith('/agents/chat/ratings/', {
      message: 'mid',
      rating: 5,
    });
  });

  test('listTools fetches tool catalogue', async () => {
    mockApiClient.get.mockResolvedValueOnce({ tools: [], total: 0 });
    await agentsService.listTools();
    expect(mockApiClient.get).toHaveBeenCalledWith('/agents/chat/tools/');
  });
});

/* ─── SSE streaming ────────────────────────────────────────────────── */

describe('streamChat SSE parser', () => {
  test('emits parsed events from a complete frame', async () => {
    localStorage.setItem('access_token', 't');
    const stream = makeReadableStream([
      frame('run_start', { run_id: 'r1' }),
      frame('token', { delta: 'Hi' }),
      frame('done', { status: 'completed' }),
    ]);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const events: AgentStreamEvent[] = [];
    const sub = streamChat(
      { message: 'hi' },
      { onEvent: (e) => events.push(e) }
    );
    await sub.done;

    expect(events.map((e) => e.type)).toEqual(['run_start', 'token', 'done']);
    expect((events[1].data as any).delta).toBe('Hi');
  });

  test('handles split chunks where one frame is fragmented across reads', async () => {
    const full = frame('token', { delta: 'A' }) + frame('token', { delta: 'B' });
    // Slice mid-frame to force the parser to buffer.
    const a = full.slice(0, 30);
    const b = full.slice(30);
    const stream = makeReadableStream([a, b]);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const events: AgentStreamEvent[] = [];
    const sub = streamChat(
      { message: 'x' },
      { onEvent: (e) => events.push(e) }
    );
    await sub.done;

    expect(events.length).toBe(2);
    expect((events[0].data as any).delta).toBe('A');
    expect((events[1].data as any).delta).toBe('B');
  });

  test('skips comment / heartbeat lines', async () => {
    const stream = makeReadableStream([
      `: heartbeat\n\n` + frame('done', { status: 'completed' }),
    ]);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const events: AgentStreamEvent[] = [];
    const sub = streamChat(
      { message: 'x' },
      { onEvent: (e) => events.push(e) }
    );
    await sub.done;

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('done');
  });

  test('reports HTTP errors via onError', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    });

    const onError = jest.fn();
    const sub = streamChat({ message: 'x' }, { onError });
    await sub.done;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('attaches Bearer token from localStorage', async () => {
    localStorage.setItem('access_token', 'abc-123');
    const stream = makeReadableStream([frame('done', { status: 'completed' })]);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const sub = streamChat({ message: 'x' }, {});
    await sub.done;

    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchArgs[1].headers.Authorization).toBe('Bearer abc-123');
    expect(fetchArgs[1].method).toBe('POST');
    expect(fetchArgs[1].body).toContain('"message":"x"');
  });

  test('cancel() aborts the underlying fetch', async () => {
    let aborted = false;
    (global.fetch as jest.Mock).mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          const err: any = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const onComplete = jest.fn();
    const sub = streamChat({ message: 'x' }, { onComplete });
    sub.cancel();
    await sub.done;

    expect(aborted).toBe(true);
    expect(onComplete).toHaveBeenCalled();
  });
});
