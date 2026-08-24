/**
 * The ONE message lifecycle, exercised from BOTH apps' entry points
 * (docs/49 ASTRAL-105).
 *
 * The row's behavioural gate is literal: "a stop is a success with less
 * text, not a failure — asserted from both apps' entry points, because that
 * distinction is currently implemented twice". It was: `reading.ts:108-114`
 * and the mobile hook. So every case below runs TWICE — once with the host
 * `apps/mobile` installs (routing on) and once with the host `apps/astro`
 * installs (routing off, pinned) — and the two must agree.
 *
 * These are not RN render tests. The lifecycle is deliberately free of
 * react-native imports (react + @wealthai/core only), so it runs in the root
 * jest project against a scripted SSE stream and a real zustand store —
 * which is why a stop, a mid-stream drop and a widget in stream order can be
 * asserted at all. The root project has no React Native preset (F21 #4), so
 * anything that imports `react-native` cannot be tested here; the surface
 * components are covered structurally instead.
 *
 * ── mutation check, run once and recorded (2026-08-24) ─────────────────────
 *
 *   stop settles the bubble WITH an error       → 3 red   ✓
 *   the pin reads the store's agent anyway      → 1 red   ✓
 *   the live stream stops stripping the router tag → 2 red ✓
 *   a widget block is dropped from stream order → 2 red   ✓
 *
 * And one that did NOT go red, which is a FINDING rather than a gap I can
 * close from here: deleting the `controller.signal.aborted` guard inside the
 * hook's `onError` callback changes nothing, because `listenToChatStreamCore`
 * swallows the error whenever the caller's signal is aborted (it checks
 * SIGNAL STATE, not error name — chat-service.ts:420-430). That guard was
 * written when core branched on the error name; it is now unreachable defence.
 * It is left in place — it is cheap, it documents a real measured failure, and
 * removing behaviour a comment describes is how a fixed bug comes back — but
 * no test here can pin it, and it should not be counted as covered.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  initCore,
  useChatStore,
  type Message,
  type PlatformAdapter,
} from '@wealthai/core';

import { installChatHost, resetChatHost, type ChatHost } from '../host';
import { useSendMessage } from '../use-send-message';

// ── a scripted SSE stream ──────────────────────────────────────────────────

interface Scripted {
  push: (line: string) => void;
  close: () => void;
  fail: (error: Error) => void;
  body: { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } };
}

function scriptStream(): Scripted {
  const queue: Array<{ done: boolean; value?: Uint8Array }> = [];
  let failure: Error | null = null;
  let wake: (() => void) | null = null;
  const encoder = new TextEncoder();
  const bump = () => { const w = wake; wake = null; w?.(); };

  return {
    push(line: string) {
      queue.push({ done: false, value: encoder.encode(`data: ${line}\n\n`) });
      bump();
    },
    close() {
      queue.push({ done: true });
      bump();
    },
    fail(error: Error) {
      failure = error;
      bump();
    },
    body: {
      getReader: () => ({
        async read() {
          for (;;) {
            // Bytes already in flight arrive even when the socket then dies —
            // draining before throwing is what a real reader does, and the
            // partial text that survives a drop is the whole point of the
            // reconciliation cases below.
            const next = queue.shift();
            if (next) return next;
            if (failure) throw failure;
            await new Promise<void>((resolve) => { wake = resolve; });
          }
        },
      }),
    },
  };
}

// ── a scripted backend ─────────────────────────────────────────────────────

interface Backend {
  calls: Array<{ url: string; init?: any }>;
  stream: Scripted;
  /** what GET /chats/{id} answers with — the reconciliation source */
  history: any;
  streamOpened: Promise<void>;
}

let backend: Backend;

function installBackend() {
  const stream = scriptStream();
  let opened!: () => void;
  const streamOpened = new Promise<void>((r) => { opened = r; });
  backend = { calls: [], stream, history: { messages: [] }, streamOpened };

  const adapter: PlatformAdapter = {
    fetch: (async (url: any, init?: any) => {
      const u = String(url);
      backend.calls.push({ url: u, init });
      if (u.includes('/stream')) {
        if (init?.signal?.aborted) throw abortError();
        init?.signal?.addEventListener?.('abort', () => backend.stream.fail(abortError()));
        opened();
        return { ok: true, body: backend.stream.body } as any;
      }
      if (u.endsWith('/chats') && init?.method === 'POST') {
        return json({ chat: { id: 'chat_1' }, messages: [{ id: 'server_user_1' }] });
      }
      if (u.includes('/messages')) return json({ id: 'server_user_2' });
      // GET /chats/{id} — history, used by reconciliation and reload
      return json(backend.history);
    }) as any,
    getApiUrl: (endpoint: string) => `https://api.test/api/v1${endpoint}`,
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    events: { emit: () => {}, on: () => () => {} },
  };
  initCore(adapter);
}

function json(value: unknown) {
  return { ok: true, status: 200, json: async () => value } as any;
}

function abortError(): Error {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

// ── the two hosts, as the two apps install them ────────────────────────────

const tracked: Array<{ event: string; params?: Record<string, unknown> }> = [];

/** `apps/mobile`: the router runs, and it counts nothing in the lifecycle. */
const MOBILE_HOST: ChatHost = {
  getToken: async () => 'token_mobile',
  routing: true,
};

/** `apps/astro`: routing disabled, agent pinned, funnel counted (§12). */
const ASTRO_HOST: ChatHost = {
  getToken: async () => 'token_astro',
  routing: false,
  pinnedAgent: 'astrology_ai',
  track: (event, params) => tracked.push({ event, params }),
};

const HOSTS: Array<[string, ChatHost]> = [
  ['apps/mobile', MOBILE_HOST],
  ['apps/astro', ASTRO_HOST],
];

function messagesOf(chatId: string): Message[] {
  return useChatStore.getState().chats[chatId]?.messages ?? [];
}
const botOf = (chatId: string) => messagesOf(chatId).find((m) => m.sender === 'bot');

function mount() {
  let created: string | null = null;
  const view = renderHook(() =>
    useSendMessage(created, (id) => { created = id; }),
  );
  return view;
}

const streamUrl = () => backend.calls.map((c) => c.url).find((u) => u.includes('/stream'))!;

beforeEach(() => {
  tracked.length = 0;
  useChatStore.getState().reset();
  useChatStore.getState().setSelectedAgent(null);
  useChatStore.getState().setSelectedModelTier('auto');
  installBackend();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetChatHost();
  jest.restoreAllMocks();
});

describe.each(HOSTS)('the one lifecycle, from %s', (_name, host) => {
  beforeEach(() => installChatHost(host));

  it('renders both bubbles optimistically, then streams the reply into the bot bubble', async () => {
    const { result } = mount();
    const sent = act(() => result.current.send('what does my chart say'));

    await backend.streamOpened;
    await waitFor(() => expect(messagesOf('chat_1').length).toBe(2));

    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Your ' }));
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'lagna is Mesha.' }));
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await sent;

    const msgs = messagesOf('chat_1');
    expect(msgs.map((m) => m.sender)).toEqual(['user', 'bot']);
    expect(msgs[0].message).toBe('what does my chart say');
    expect(msgs[1].message).toBe('Your lagna is Mesha.');
    expect(msgs[1].isStreaming).toBe(false);
    expect(msgs[1].error).toBeUndefined();
  });

  it('A STOP IS A SUCCESS WITH LESS TEXT, NOT A FAILURE', async () => {
    const { result } = mount();
    const sent = act(() => result.current.send('tell me about my dasha'));

    await backend.streamOpened;
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'You are running' }));
    });
    await waitFor(() => expect(botOf('chat_1')?.message).toBe('You are running'));

    act(() => result.current.cancel());
    await sent;

    const bot = botOf('chat_1')!;
    // less text…
    expect(bot.message).toBe('You are running');
    // …and NOT a failure: no error banner, no Retry, the bubble settles.
    expect(bot.error).toBeUndefined();
    expect(bot.isStreaming).toBe(false);
    expect(result.current.isSending).toBe(false);
  });

  it('a dropped stream is reconciled from the server, not reported as an error', async () => {
    jest.useFakeTimers();
    try {
      const { result } = mount();
      const sent = act(() => result.current.send('cast my kundli'));
      await act(async () => { await backend.streamOpened; });

      act(() => {
        backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Your chart ' }));
      });
      // The backend finished and persisted the whole reply; only the socket died.
      backend.history = {
        messages: [
          { id: 'u1', sender: 'user', content: 'cast my kundli', timestamp: '1' },
          {
            id: 'a1',
            sender: 'assistant',
            content: 'Your chart shows Mesha lagna with Guru in the fifth.',
            timestamp: '2',
          },
        ],
      };
      backend.stream.fail(new Error('network went away'));

      // the three reconciliation attempts: 1200 / 4000 / 8000ms
      await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
      await sent;

      const bot = botOf('chat_1')!;
      expect(bot.message).toBe('Your chart shows Mesha lagna with Guru in the fifth.');
      expect(bot.error).toBeUndefined();
      expect(bot.isStreaming).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a dropped stream the server cannot cover DOES report, with a retry', async () => {
    jest.useFakeTimers();
    try {
      const { result } = mount();
      const sent = act(() => result.current.send('cast my kundli'));
      await act(async () => { await backend.streamOpened; });

      act(() => {
        backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Your chart ' }));
      });
      backend.history = { messages: [] }; // nothing persisted
      backend.stream.fail(new Error('network went away'));

      await act(async () => { await jest.advanceTimersByTimeAsync(14000); });
      await sent;

      const bot = botOf('chat_1')!;
      expect(bot.message).toBe('Your chart ');
      expect(bot.error).toMatch(/Tap to retry/);
      expect(bot.isStreaming).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps widgets as content blocks in stream order', async () => {
    const { result } = mount();
    const sent = act(() => result.current.send('show me the chart'));
    await backend.streamOpened;

    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Here it is.' }));
      backend.stream.push(
        JSON.stringify({
          type: 'widget_natal_chart',
          content: JSON.stringify({ type: 'natal_chart', grahas: [] }),
        }),
      );
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: ' Note the lagna.' }));
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await sent;

    const blocks = botOf('chat_1')!.contentBlocks!;
    expect(blocks.map((b) => b.type)).toEqual(['text', 'widget', 'text']);
    expect((blocks[1] as any).widget.type).toBe('widget_natal_chart');
    expect((blocks[0] as any).content).toBe('Here it is.');
    expect((blocks[2] as any).content).toBe(' Note the lagna.');
  });

  it('an unparseable widget payload is loud, and the turn survives it', async () => {
    const warn = jest.spyOn(console, 'warn');
    const { result } = mount();
    const sent = act(() => result.current.send('show me the chart'));
    await backend.streamOpened;

    act(() => {
      backend.stream.push(JSON.stringify({ type: 'widget_match_report', content: '{"tru' }));
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Still here.' }));
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await sent;

    expect(botOf('chat_1')!.message).toBe('Still here.');
    expect(warn.mock.calls.flat().join(' ')).toContain('widget_match_report');
  });

  it('strips the router tag from the live stream', async () => {
    const { result } = mount();
    const sent = act(() => result.current.send('hello'));
    await backend.streamOpened;
    act(() => {
      backend.stream.push(
        JSON.stringify({ type: 'message_delta', delta: '[Using astrology_ai agent] Namaste.' }),
      );
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await sent;
    expect(botOf('chat_1')!.message).toBe('Namaste.');
  });

  it('refuses to send without a token rather than sending unauthenticated', async () => {
    resetChatHost();
    installChatHost({ ...host, getToken: async () => null });
    const { result } = mount();
    await act(() => result.current.send('hello'));
    expect(backend.calls).toEqual([]);
  });
});

describe('(c) routing disabled is total — the pin is not a hidden picker', () => {
  it('apps/astro forces the pinned agent on every turn, ignoring the store', async () => {
    installChatHost(ASTRO_HOST);
    // The store still HAS these fields — shared with mobile and the web app.
    // The point of the gate is that a stray selection cannot reach the wire.
    useChatStore.getState().setSelectedAgent('dietician');
    useChatStore.getState().setSelectedModelTier('deep');

    const { result } = mount();
    const sent = act(() => result.current.send('what does my chart say'));
    await backend.streamOpened;
    act(() => { backend.stream.push(JSON.stringify({ type: 'message_complete' })); });
    await sent;

    expect(streamUrl()).toContain('force_agent=astrology_ai');
    expect(streamUrl()).not.toContain('dietician');
    expect(streamUrl()).not.toContain('model_tier');
  });

  it('apps/mobile keeps the router and the user selection', async () => {
    installChatHost(MOBILE_HOST);
    useChatStore.getState().setSelectedAgent('dietician');
    useChatStore.getState().setSelectedModelTier('deep');

    const { result } = mount();
    const sent = act(() => result.current.send('what should I eat'));
    await backend.streamOpened;
    act(() => { backend.stream.push(JSON.stringify({ type: 'message_complete' })); });
    await sent;

    expect(streamUrl()).toContain('force_agent=dietician');
    expect(streamUrl()).toContain('model_tier=deep');
  });
});

describe('§12 funnel — counted in the lifecycle, not in a screen', () => {
  it('astro counts ask → charge → answer for a turn that lands', async () => {
    installChatHost(ASTRO_HOST);
    const { result } = mount();
    const sent = act(() => result.current.send('what does my chart say'));
    await backend.streamOpened;
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'credits', charged: 12, balance: 88 }));
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Mesha.' }));
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await sent;

    expect(tracked.map((t) => t.event)).toEqual([
      'reading_asked',
      'reading_charged',
      'reading_answered',
    ]);
    expect(tracked[0].params).toMatchObject({ first_turn: 1 });
    expect(tracked[1].params).toMatchObject({ charged: 12, balance: 88 });
  });

  it('a stopped turn is counted as stopped, never as failed', async () => {
    installChatHost(ASTRO_HOST);
    const { result } = mount();
    const sent = act(() => result.current.send('tell me more'));
    await backend.streamOpened;
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Guru is' }));
    });
    await waitFor(() => expect(botOf('chat_1')?.message).toBe('Guru is'));
    act(() => result.current.cancel());
    await sent;

    expect(tracked.map((t) => t.event)).toContain('reading_stopped');
    expect(tracked.map((t) => t.event)).not.toContain('reading_failed');
  });

  it('mobile supplies no counter, so the move gives it no new events', async () => {
    installChatHost(MOBILE_HOST);
    const { result } = mount();
    const sent = act(() => result.current.send('hello'));
    await backend.streamOpened;
    act(() => { backend.stream.push(JSON.stringify({ type: 'message_complete' })); });
    await sent;
    expect(tracked).toEqual([]);
  });
});
