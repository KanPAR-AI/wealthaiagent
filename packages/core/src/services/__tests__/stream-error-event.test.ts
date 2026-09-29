/**
 * The server's `error` event is a FAILURE, not a chunk (E2 round 3, item A).
 *
 * chatservice `api/v1/endpoints/chats.py` emits
 *   data: {"type": "error", "error": "An error occurred while generating the response"}
 * when a turn raises. The parser used to route it through its catch-all, which
 * called `onMessageChunk('', 'error')` and then let the stream end as a success:
 * the bubble settled with no Retry row and the turn was counted answered.
 */
import { initCore, type PlatformAdapter } from '../../platform';
import { deleteForRegenerate, listenToChatStreamCore } from '../chat-service';

function streamOf(lines: string[], thenHang = false) {
  const encoder = new TextEncoder();
  const queue = lines.map((l) => ({ done: false, value: encoder.encode(`data: ${l}\n\n`) }));
  return {
    getReader: () => ({
      async read() {
        const next = queue.shift();
        if (next) return next;
        if (thenHang) return new Promise<never>(() => undefined);
        return { done: true };
      },
    }),
  };
}

function install(body: unknown) {
  const adapter: PlatformAdapter = {
    fetch: (async () => ({ ok: true, body })) as never,
    getApiUrl: (e: string) => `https://api.test/api/v1${e}`,
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    events: { emit: () => {}, on: () => () => {} },
  };
  initCore(adapter);
}

async function run(lines: string[], thenHang = false) {
  install(streamOf(lines, thenHang));
  const chunks: Array<[string, string]> = [];
  const onComplete = jest.fn();
  const onError = jest.fn();
  await listenToChatStreamCore('jwt', 'chat_1',
    (c, t) => { chunks.push([c, t]); }, onComplete, onError);
  return { chunks, onComplete, onError };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('an `error` event from the server', () => {
  it('a partial delta, then error: onError ONCE with the server sentence, never onComplete, partial kept', async () => {
    const r = await run([
      JSON.stringify({ type: 'message_delta', delta: 'Your chart ' }),
      JSON.stringify({ type: 'error', error: 'An error occurred while generating the response' }),
    ]);
    expect(r.onError).toHaveBeenCalledTimes(1);
    expect((r.onError.mock.calls[0][0] as Error).message)
      .toBe('An error occurred while generating the response');
    expect(r.onComplete).not.toHaveBeenCalled();
    // the partial text reached the caller and nothing un-said it
    expect(r.chunks).toEqual([['Your chart ', 'text_chunk']]);
  });

  it('stops reading at the error — a hung socket after it does not keep the turn open', async () => {
    const r = await run([
      JSON.stringify({ type: 'error', error: 'boom' }),
    ], true);
    expect(r.onError).toHaveBeenCalledTimes(1);
    expect(r.onComplete).not.toHaveBeenCalled();
  });

  it('an error event with no sentence still fails, with a sentence of its own', async () => {
    const r = await run([JSON.stringify({ type: 'error' })]);
    expect((r.onError.mock.calls[0][0] as Error).message).toBe('The reply did not finish');
  });

  it('control: a normal stream still completes and never errors', async () => {
    const r = await run([
      JSON.stringify({ type: 'message_delta', delta: 'Mesha lagna.' }),
      JSON.stringify({ type: 'message_complete' }),
    ]);
    expect(r.onComplete).toHaveBeenCalledTimes(1);
    expect(r.onError).not.toHaveBeenCalled();
  });

  it('control: other typed events (widgets) are still chunks, not failures', async () => {
    const r = await run([
      JSON.stringify({ type: 'widget_natal_chart', content: '{}' }),
      JSON.stringify({ type: 'message_complete' }),
    ]);
    expect(r.chunks).toEqual([['{}', 'widget_natal_chart']]);
    expect(r.onError).not.toHaveBeenCalled();
  });
});

// Role-3, E2 round 4 (X6 survived): `finally` also clears the watchdogs, so
// only the ORDER tells the branch's own `clearTimers()` apart — when the
// caller's onError runs, no watchdog may still be armed (an abort landing
// during the caller's failure path would be a second, spurious failure).
describe('the error branch disarms the watchdogs BEFORE telling the caller', () => {
  it('no timer is pending when onError runs', async () => {
    jest.useFakeTimers();
    try {
      install(streamOf([
        JSON.stringify({ type: 'message_delta', delta: 'Your chart ' }),
        JSON.stringify({ type: 'error', error: 'boom' }),
      ]));
      let pendingAtError = -1;
      const done = listenToChatStreamCore('jwt', 'chat_1', () => {}, () => {},
        () => { pendingAtError = jest.getTimerCount(); });
      await jest.advanceTimersByTimeAsync(50);
      await done;
      expect(pendingAtError).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

// Role-3, E2 round 4: `/regenerate` is idempotent on the MESSAGE (204 whether
// or not it exists), so a 404 means the CHAT is gone — a failure, not "done".
describe('deleteForRegenerate — 404 means the chat is not found', () => {
  function installStatus(status: number | 'throw') {
    const calls: string[] = [];
    const adapter: PlatformAdapter = {
      fetch: (async (url: string) => {
        calls.push(String(url));
        if (status === 'throw') throw new Error('offline');
        return { ok: status >= 200 && status < 300, status };
      }) as never,
      getApiUrl: (e: string) => `https://api.test/api/v1${e}`,
      storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
      events: { emit: () => {}, on: () => () => {} },
    };
    initCore(adapter);
    return calls;
  }
  it('204: ok, on the right route', async () => {
    const calls = installStatus(204);
    expect(await deleteForRegenerate('jwt', 'chat_1', 'bot_1')).toEqual({ ok: true, status: 204 });
    expect(calls).toEqual(['https://api.test/api/v1/chats/chat_1/messages/bot_1/regenerate']);
  });
  it('404: NOT ok — the chat is gone, not the message', async () => {
    installStatus(404);
    expect(await deleteForRegenerate('jwt', 'chat_1', 'bot_1')).toEqual({ ok: false, status: 404 });
  });
  it('403 and a network error: not ok, and never thrown', async () => {
    installStatus(403);
    expect(await deleteForRegenerate('jwt', 'chat_1', 'bot_1')).toEqual({ ok: false, status: 403 });
    installStatus('throw');
    expect(await deleteForRegenerate('jwt', 'chat_1', 'bot_1')).toEqual({ ok: false, status: null });
  });
});
