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
import { retryTarget } from '../retry';
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
  /** E2 round 3 (item D): when set, POST /chats waits on it — so a test can
   *  look at the store BEFORE the session exists. Null = resolve at once. */
  createGate: Promise<void> | null;
  /** a fresh scripted stream for the NEXT GET /stream (a retry opens one) */
  reopen: () => void;
}

let backend: Backend;

function installBackend() {
  const stream = scriptStream();
  let opened!: () => void;
  const streamOpened = new Promise<void>((r) => { opened = r; });
  backend = {
    calls: [], stream, history: { messages: [] }, streamOpened, createGate: null,
    reopen: () => {
      backend.stream = scriptStream();
      backend.streamOpened = new Promise<void>((r) => { opened = r; });
    },
  };

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
        if (backend.createGate) await backend.createGate;
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

// ── E2 rounds 3–4 ──────────────────────────────────────────────────────────

describe.each(HOSTS)('E2 round 3, from %s', (_name, host) => {
  // Cascade hygiene (Role-3, E2 round 4): every hook mounted here is
  // unmounted, and every case gets a fresh backend and real timers, so one
  // failing case cannot leak a live stream or fake clock into the next.
  const views: Array<{ unmount: () => void }> = [];
  const mountHere = () => {
    let created: string | null = null;
    const view = renderHook(() => useSendMessage(created, (id) => { created = id; }));
    views.push(view);
    return view;
  };
  // Every send a case starts, so a FAILING case's turn is still driven to
  // its end here: an abandoned `act(...)` leaves React's act scope open, and
  // the next case's `renderHook` then renders nothing (measured: one failing
  // case turned the other nine red with "Cannot read properties of null").
  const pending: Array<Promise<unknown>> = [];
  const hold = <T,>(p: T): T => { pending.push(Promise.resolve(p as unknown)); return p; };
  beforeEach(() => installChatHost(host));
  afterEach(async () => {
    jest.useFakeTimers();
    backend.createGate = null;
    backend.stream.close();
    // NOT inside a new act(): the abandoned case's act scope is still open,
    // and an act that starts inside it and ends after it corrupts React's
    // scope depth — every later renderHook then renders nothing.
    await jest.advanceTimersByTimeAsync(20000);
    await Promise.allSettled(pending.splice(0));
    jest.useRealTimers();
    while (views.length) views.pop()!.unmount();
    installBackend();
  });

  /** fail the current turn with the server's error event and let it settle */
  async function failTurn(botId: string) {
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_start', message: { id: botId } }));
      backend.stream.push(JSON.stringify({ type: 'error', error: 'boom' }));
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(14000); });
  }
  /** answer the current turn and let it settle */
  async function answerTurn(text: string) {
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: text }));
      backend.stream.push(JSON.stringify({ type: 'message_complete' }));
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  }

  // Item D (report 95290c92). The fix renders BOTH bubbles under a temp id
  // BEFORE `createChatSession`, then migrates them. The first test in this
  // file only looked after the stream opened, with a POST that resolved at
  // once — so moving the bootstrap back ahead of the optimistic bubbles left
  // it green. This one holds POST /chats open and looks while it is open.
  it('95290c92: both bubbles exist BEFORE POST /chats resolves, then migrate to the real id', async () => {
    let releaseCreate!: () => void;
    backend.createGate = new Promise<void>((r) => { releaseCreate = r; });
    try {
      const { result } = mountHere();
      const sent = hold(act(() => result.current.send('what does my chart say')));

      // POST /chats is in flight and has NOT answered
      await waitFor(() => expect(
        backend.calls.some((c) => c.url.endsWith('/chats') && c.init?.method === 'POST'),
      ).toBe(true));
      const chats = useChatStore.getState().chats;
      const temp = Object.keys(chats).find((id) => id.startsWith('local_'));
      expect(temp).toBeDefined();
      expect(chats[temp!].messages.map((m) => m.sender)).toEqual(['user', 'bot']);
      expect(chats[temp!].messages[0].message).toBe('what does my chart say');
      expect(chats[temp!].messages[1].isStreaming).toBe(true);
      expect(chats.chat_1).toBeUndefined();

      releaseCreate();
      await backend.streamOpened;
      await waitFor(() => expect(messagesOf('chat_1').length).toBe(2));
      expect(useChatStore.getState().chats[temp!]).toBeUndefined();
      // …and turn 1's user row carries its SERVER id after the migration
      expect(messagesOf('chat_1')[0].id).toBe('server_user_1');
      act(() => { backend.stream.push(JSON.stringify({ type: 'message_complete' })); });
      await sent;
      expect(messagesOf('chat_1').map((m) => m.sender)).toEqual(['user', 'bot']);
    } finally {
      releaseCreate?.();
    }
  });

  // Item A: the server's `error` event ends the turn as a FAILURE — the
  // retry row renders from `error` — and the text that streamed stays.
  it('a server `error` event after a partial reply: kept text, an error to retry, counted failed', async () => {
    jest.useFakeTimers();
    const { result } = mountHere();
    const sent = hold(act(() => result.current.send('cast my kundli')));
    await act(async () => { await backend.streamOpened; });
    act(() => {
      backend.stream.push(JSON.stringify({ type: 'message_delta', delta: 'Your chart ' }));
      backend.stream.push(JSON.stringify({ type: 'error', error: 'An error occurred while generating the response' }));
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(14000); });
    await sent;
    const bot = botOf('chat_1')!;
    expect(bot.message).toBe('Your chart ');
    expect(bot.error).toMatch(/Tap to retry/);
    expect(bot.isStreaming).toBe(false);
    if (host.track) {
      expect(tracked.map((t) => t.event)).toContain('reading_failed');
      expect(tracked.map((t) => t.event)).not.toContain('reading_answered');
    }
  });

  // Item B (report 3a74d645): Retry REGENERATES — no second user row.
  it('retry regenerates in place: no new user message, the failed row is deleted, the stream targets turn 1’s SERVER id', async () => {
    jest.useFakeTimers();
    const view = mountHere();
    const first = hold(act(() => view.result.current.send('cast my kundli')));
    await act(async () => { await backend.streamOpened; });
    await failTurn('bot_failed');
    await first;
    view.rerender();
    expect(botOf('chat_1')?.error).toMatch(/Tap to retry/);

    const before = messagesOf('chat_1');
    // Role-3, E2 round 4: this used to pin `before[0].id` — the LOCAL id,
    // i.e. the bug. Turn 1 must carry the id POST /chats returned.
    expect(before[0].id).toBe('server_user_1');
    const target = retryTarget(before, 'bot_failed')!;
    expect(target.retryOf).toEqual({ userMessageId: 'server_user_1', botMessageId: 'bot_failed' });

    backend.reopen();
    const callsBefore = backend.calls.length;
    const again = hold(act(() => view.result.current.send(target.text, target.files, { retryOf: target.retryOf })));
    await act(async () => { await backend.streamOpened; });
    await answerTurn('Mesha lagna.');
    await again;

    const after = messagesOf('chat_1');
    expect(after.map((m) => m.sender)).toEqual(['user', 'bot']);   // still ONE user row
    expect(after[1].message).toBe('Mesha lagna.');
    expect(after[1].error).toBeUndefined();
    const newCalls = backend.calls.slice(callsBefore);
    expect(newCalls.some((c) => c.url.endsWith('/chats/chat_1/messages/bot_failed/regenerate')
      && c.init?.method === 'POST')).toBe(true);
    expect(newCalls.some((c) => /\/chats\/chat_1\/messages$/.test(c.url))).toBe(false);
    const stream = newCalls.find((c) => c.url.includes('/stream'))!;
    expect(stream.url).toContain('target_user_message_id=server_user_1');
  });

  // The blocker, end to end: turn 1 fails, turn 2 is answered, the user taps
  // Retry on TURN 1. With a local id the server would fall back to the latest
  // user message and regenerate turn 2's question into turn 1's bubble.
  it('turn 1 fails, turn 2 answers, Retry on turn 1 targets turn 1’s server id — never the latest', async () => {
    jest.useFakeTimers();
    const view = mountHere();
    const t1 = hold(act(() => view.result.current.send('cast my kundli')));
    await act(async () => { await backend.streamOpened; });
    await failTurn('bot_1');
    await t1;
    view.rerender();

    backend.reopen();
    const t2 = hold(act(() => view.result.current.send('and my dasha?')));
    await act(async () => { await backend.streamOpened; });
    await answerTurn('Guru mahadasha.');
    await t2;
    view.rerender();

    const msgs = messagesOf('chat_1');
    expect(msgs.map((m) => [m.sender, m.id])).toEqual([
      ['user', 'server_user_1'], ['bot', 'bot_1'], ['user', 'server_user_2'], ['bot', expect.any(String)],
    ]);
    const target = retryTarget(msgs, 'bot_1')!;
    expect(target.retryOf.userMessageId).toBe('server_user_1');

    backend.reopen();
    const callsBefore = backend.calls.length;
    const r = hold(act(() => view.result.current.send(target.text, target.files, { retryOf: target.retryOf })));
    await act(async () => { await backend.streamOpened; });
    await answerTurn('Mesha lagna.');
    await r;

    const streams = backend.calls.slice(callsBefore).filter((c) => c.url.includes('/stream'));
    expect(streams).toHaveLength(1);
    expect(streams[0].url).toContain('target_user_message_id=server_user_1');
    expect(streams[0].url).not.toContain('server_user_2');
    const after = messagesOf('chat_1');
    expect(after[1].message).toBe('Mesha lagna.');     // turn 1's bubble
    expect(after[3].message).toBe('Guru mahadasha.');  // turn 2 untouched
    expect(after.filter((m) => m.sender === 'user')).toHaveLength(2);
  });

  // Non-blocking (1): two taps in the gap before `isSending` is set (the
  // lifecycle awaits the token first) must start ONE regenerate, not two.
  it('a double-tapped Retry starts exactly one regenerate', async () => {
    jest.useFakeTimers();
    const view = mountHere();
    const first = hold(act(() => view.result.current.send('cast my kundli')));
    await act(async () => { await backend.streamOpened; });
    await failTurn('bot_failed');
    await first;
    view.rerender();

    const target = retryTarget(messagesOf('chat_1'), 'bot_failed')!;
    backend.reopen();
    const callsBefore = backend.calls.length;
    let a!: Promise<void>;
    let b!: Promise<void>;
    act(() => {
      // same render, same closure: `isSending` is still false for both taps
      a = hold(view.result.current.send(target.text, target.files, { retryOf: target.retryOf }));
      b = hold(view.result.current.send(target.text, target.files, { retryOf: target.retryOf }));
    });
    await act(async () => { await backend.streamOpened; });
    await answerTurn('Mesha lagna.');
    await act(async () => { await a; await b; });

    const newCalls = backend.calls.slice(callsBefore);
    expect(newCalls.filter((c) => c.url.endsWith('/regenerate'))).toHaveLength(1);
    expect(newCalls.filter((c) => c.url.includes('/stream'))).toHaveLength(1);
  });
});
