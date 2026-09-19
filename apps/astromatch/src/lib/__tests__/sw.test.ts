/**
 * The service worker's doors, against a fake `chrome` (follow-up 6).
 *
 * `sw.ts` registers its listeners at import time, so the test installs a fake
 * `chrome` and a fake `fetch`, imports the module once, and then drives the
 * listeners it registered. Nothing is mocked that the code under test does
 * not really use.
 *
 * Three things are worth pinning here and nowhere else:
 *   - the TRUST DOOR: a parse that reached `match/start` is refused with a
 *     sentence (ASTRAL-326's runtime half, at the place it actually runs);
 *   - the SENDER check: this worker holds the session token, and the message
 *     door is reachable from outside the panel;
 *   - SIGN-OUT clears the session storage rather than one key by name.
 */

import { CONFIRMED_TAG } from '../confirmed';
import { MATCH_PORT } from '../messages';

type Listener = (...args: unknown[]) => unknown;

interface FakePort {
  name: string;
  sender?: { id?: string; url?: string };
  onMessage: { addListener: (fn: Listener) => void; fire: (m: unknown) => void };
  onDisconnect: { addListener: (fn: Listener) => void; fire: () => void };
  postMessage: jest.Mock;
  disconnect: jest.Mock;
}

const messageListeners: Listener[] = [];
const connectListeners: Listener[] = [];
let storage: Record<string, unknown> = {};
let local: Record<string, unknown> = {};
let calls: Array<{ url: string; method: string }> = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: {} };

beforeAll(async () => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'astromatch-test',
      onMessage: { addListener: (fn: Listener) => messageListeners.push(fn) },
      onConnect: { addListener: (fn: Listener) => connectListeners.push(fn) },
      onInstalled: { addListener: () => {} },
      sendMessage: async () => undefined,
    },
    storage: {
      session: {
        get: async (key: string) => ({ [key]: storage[key] }),
        set: async (bag: Record<string, unknown>) => {
          storage = { ...storage, ...bag };
        },
        remove: async (key: string) => {
          delete storage[key];
        },
        clear: async () => {
          storage = {};
        },
      },
      // `local` is a SEPARATE bag here, as it is in Chrome: the pending
      // delete ids survive a browser restart and the session token does not
      // (docs/73 B1).
      local: {
        get: async (key: string) => ({ [key]: local[key] }),
        set: async (bag: Record<string, unknown>) => {
          local = { ...local, ...bag };
        },
      },
    },
    sidePanel: { setPanelBehavior: async () => {} },
    action: { setTitle: async () => {}, setBadgeText: async () => {} },
    tabs: { onActivated: { addListener: () => {} }, onUpdated: { addListener: () => {} } },
    contextMenus: { create: () => {}, onClicked: { addListener: () => {} } },
  };

  installDefaultFetch();
  await import('../../sw');
});

/** The plain one-reply fetch. Re-installed before every case, because one
 *  test below swaps in a three-stream script and would otherwise leak it. */
function installDefaultFetch() {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init?: { method?: string },
  ) => {
    calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() });
    return {
      ok: nextResponse.status < 400,
      status: nextResponse.status,
      headers: { get: () => null },
      json: async () => nextResponse.body,
    } as unknown as Response;
  };
}

beforeEach(() => {
  calls = [];
  storage = {};
  local = {};
  nextResponse = { status: 200, body: {} };
  installDefaultFetch();
});

const OURS = { id: 'astromatch-test', url: 'chrome-extension://astromatch-test/panel.html' };

function ask(message: unknown, sender: unknown = OURS): Promise<{ ok: boolean; error?: string; value?: unknown }> {
  return new Promise((resolve) => {
    messageListeners[0](message, sender, resolve);
  });
}

function connect(name = MATCH_PORT, sender: unknown = OURS): FakePort {
  const handlers: Listener[] = [];
  const disconnectHandlers: Listener[] = [];
  const port: FakePort = {
    name,
    // `null` means the port arrived with NO sender — a default parameter
    // could not express that, which is why it is a sentinel.
    sender: (sender === null ? undefined : sender) as FakePort['sender'],
    onMessage: {
      addListener: (fn) => handlers.push(fn),
      fire: (m) => handlers.forEach((fn) => fn(m)),
    },
    onDisconnect: {
      addListener: (fn: Listener) => disconnectHandlers.push(fn),
      fire: () => disconnectHandlers.forEach((fn) => fn()),
    },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
  };
  connectListeners[0](port);
  return port;
}

describe('the sender check — this worker holds the token', () => {
  it('answers its own panel', async () => {
    storage['astromatch.session'] = session();
    const reply = await ask({ type: 'auth/state' });
    expect(reply.ok).toBe(true);
    expect(reply.value).toEqual({
      signedIn: true,
      identifier: 'someone@example.com',
      // no reading was left owed, so nothing is claimed
      notice: '',
    });
  });

  it('refuses another extension, by name', async () => {
    const reply = await ask({ type: 'auth/state' }, { id: 'someone-else' });
    expect(reply).toEqual({ ok: false, error: 'This extension only answers its own panel.' });
  });

  it('refuses a message that did not come from an extension page of ours', async () => {
    const reply = await ask(
      { type: 'auth/state' },
      { id: 'astromatch-test', url: 'https://example.com/profile' },
    );
    expect(reply.ok).toBe(false);
  });

  it('refuses a match PORT from outside the extension', () => {
    const port = connect(MATCH_PORT, { id: 'someone-else' });
    expect(port.disconnect).toHaveBeenCalled();
  });

  it('FAILS CLOSED on a port with no sender at all', () => {
    // An absent sender is a fact we do not have, not a reassurance.
    const port = connect(MATCH_PORT, null);
    expect(port.disconnect).toHaveBeenCalled();
  });

  it('ignores a port with another name entirely', () => {
    const port = connect('not-ours');
    expect(port.disconnect).not.toHaveBeenCalled();
    port.onMessage.fire({ type: 'match/start' });
    expect(port.postMessage).not.toHaveBeenCalled();
  });
});

describe('the trust door, where it actually runs', () => {
  it('refuses an unconfirmed profile with a sentence, and sends nothing', async () => {
    storage['astromatch.session'] = session();
    const port = connect();
    port.onMessage.fire({
      type: 'match/start',
      title: 'Match — Someone',
      // a PARSE, the shape most likely to arrive by mistake
      profile: { kind: 'parsed', source: 'paste', fields: {} },
    });
    await flush();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'failed',
      error: 'Those details have not been confirmed.',
    });
    expect(calls).toEqual([]);
  });

  it('refuses a confirmed-looking object whose date is not a real day', async () => {
    storage['astromatch.session'] = session();
    const port = connect();
    port.onMessage.fire({
      type: 'match/start',
      title: 'x',
      profile: {
        tag: CONFIRMED_TAG,
        source: 'paste',
        name: 'Someone',
        dob: '1989-02-31',
        tob: null,
        pob: 'Pune',
        acts: { name: 'typed', dob: 'typed', tob: 'declined', pob: 'typed' },
      },
    });
    await flush();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'failed',
      error: 'Those details have not been confirmed.',
    });
    expect(calls).toEqual([]);
  });
});

describe('follow-up 4 — the confirmed profile lives for the whole RUN', () => {
  /**
   * The failure this pins: when the user's OWN chart is not on file, the
   * engine asks for THEIR details first. The run used to end at that ask, so
   * the partner ask that came next had nothing to answer it — the user was
   * asked to type the same three values again and the capture stamps went
   * with them.
   */
  const SELF_ASK = ask_(['dob', 'tob', 'pob'], 'Your date of birth');
  const PARTNER_ASK = ask_(['person2_dob', 'person2_tob', 'person2_pob'], "Your partner's date of birth");
  const SCORECARD =
    'Here it is.\n\n```match_report\n' +
    JSON.stringify({
      type: 'match_report',
      groom: { moon_rashi: 'Aries', nakshatra: 'Bharani', time_known: true },
      bride: { moon_rashi: 'Gemini', nakshatra: 'Punarvasu', time_known: true },
      kootas: [{ name: 'Varna', points: 1, max: 1, note: 'x', meaning: 'y', pending: false }],
      time_known: true,
      total: 26,
      max_total: 36,
      firm_total: 26,
      firm_max: 36,
      pending_max: 0,
      verdict: 'very good',
      doshas: [],
    }) +
    '\n```\n';

  function ask_(keys: string[], label: string) {
    return (
      'I need a few things.\n\n```input_request\n' +
      JSON.stringify({
        type: 'input_request',
        ask: 'required_slots_missing',
        reason: 'r',
        fields: keys.map((key) => ({
          key,
          kind: key.endsWith('dob') ? 'date' : key.endsWith('tob') ? 'time' : 'place',
          label,
          required: true,
          allow_unknown: key.endsWith('tob'),
        })),
      }) +
      '\n```\n'
    );
  }

  it('answers the PARTNER ask from the run\'s profile after the user answered their own', async () => {
    storage['astromatch.session'] = session();
    const streams = [SELF_ASK, PARTNER_ASK, SCORECARD];
    let stream = 0;
    const posted: string[] = [];
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string; body?: string },
    ) => {
      const url = String(input);
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
      if (url.includes('/stream')) return sse(streams[Math.min(stream++, streams.length - 1)]);
      if (url.endsWith('/chats')) return json({ chat: { id: 'chat-1' }, messages: [] });
      if (url.includes('/messages')) {
        posted.push(JSON.parse(String(init?.body ?? '{}')).content);
        return json({ id: 'm' });
      }
      return json({});
    };

    const port = connect();
    port.onMessage.fire({ type: 'match/start', title: 'Match — Someone', profile: confirmed() });
    await settle();

    // the self ask reached the panel, unanswered by the worker
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'outcome' }),
    );

    // …the user answers it in the widget…
    port.onMessage.fire({ type: 'widget/answer', chatId: 'chat-1', text: 'my details' });
    await settle();

    // …and the PARTNER ask is answered from the profile this run already
    // holds, stamps and all, without asking the user twice.
    const carrier = posted.find((p) => p.includes('person2_dob'));
    expect(carrier).toBeDefined();
    const fence = /```input_response\n([\s\S]*?)```/.exec(carrier!)!;
    const values = JSON.parse(fence[1]).values;
    expect(values.person2_dob).toBe('1994-05-14');
    expect(values.capture_source).toBe('paste');
    expect(values.capture_edited).toEqual(['person2_dob', 'person2_pob']);
  });

  function confirmed() {
    return {
      tag: CONFIRMED_TAG,
      source: 'paste',
      name: 'Someone',
      dob: '1994-05-14',
      tob: null,
      pob: 'Pune, India',
      acts: { name: 'accepted', dob: 'typed', tob: 'declined', pob: 'typed' },
    };
  }
});

describe('B1 — closing the panel deletes the unsaved reading', () => {
  /**
   * The gap this closes: three buttons deleted the chat and the X did not,
   * which is the control a user is far more likely to use. The worker holds
   * the chat id and the token, so it does the delete itself when the port
   * disconnects — and the id is recorded in `chrome.storage.local` first, so
   * a worker torn down mid-request still owes it.
   */
  const SCORECARD =
    'Here.\n\n```match_report\n' +
    JSON.stringify({
      type: 'match_report',
      groom: { moon_rashi: 'Aries', nakshatra: 'Bharani', time_known: true },
      bride: { moon_rashi: 'Gemini', nakshatra: 'Punarvasu', time_known: true },
      kootas: [{ name: 'Varna', points: 1, max: 1, note: 'x', meaning: 'y', pending: false }],
      time_known: true, total: 26, max_total: 36, firm_total: 26, firm_max: 36,
      pending_max: 0, verdict: 'very good', doshas: [],
    }) + '\n```\n';

  function scriptFetch(options: { deleteOk?: boolean } = {}) {
    const posted: string[] = [];
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string; body?: string },
    ) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method });
      if (method === 'DELETE') {
        return json({}, options.deleteOk === false ? 500 : 204);
      }
      if (url.includes('/stream')) return sse(SCORECARD);
      if (url.endsWith('/chats')) return json({ chat: { id: 'chat-7' }, messages: [] });
      if (url.includes('/messages')) {
        posted.push(JSON.parse(String(init?.body ?? '{}')).content);
        return json({ id: 'm' });
      }
      return json({});
    };
    return posted;
  }

  const CONFIRMED = {
    tag: CONFIRMED_TAG,
    source: 'manual',
    name: 'Someone',
    dob: '1994-05-14',
    tob: '10:30',
    pob: 'Pune, India',
    acts: { name: 'typed', dob: 'typed', tob: 'typed', pob: 'typed' },
  };

  async function startRun() {
    storage['astromatch.session'] = session();
    const port = connect();
    port.onMessage.fire({ type: 'match/start', title: 'Match — Someone', profile: CONFIRMED });
    await settle();
    return port;
  }

  it('records the chat id the moment the chat exists — in LOCAL storage', async () => {
    scriptFetch();
    await startRun();
    expect(local['astromatch.pending_deletes']).toEqual([
      { chatId: 'chat-7', noticedAt: expect.any(Number) },
    ]);
    // …and never in the session bag, which dies with the browser
    expect(JSON.stringify(storage)).not.toContain('pending_deletes');
  });

  it('issues the DELETE when the panel closes, and forgets the id', async () => {
    scriptFetch();
    const port = await startRun();
    calls.length = 0;
    port.onDisconnect.fire();
    await settle();
    expect(calls).toEqual([
      { url: 'https://chatbackend.yourfinadvisor.com/api/v1/chats/chat-7', method: 'DELETE' },
    ]);
    expect(local['astromatch.pending_deletes']).toEqual([]);
  });

  it('KEEPS the id when that delete fails, and sweeps it on the next open', async () => {
    scriptFetch({ deleteOk: false });
    const port = await startRun();
    port.onDisconnect.fire();
    await settle();
    expect(local['astromatch.pending_deletes']).toEqual([
      { chatId: 'chat-7', noticedAt: expect.any(Number) },
    ]);

    // the panel opens again: the worker collects what it still owes and says so
    scriptFetch();
    calls.length = 0;
    const reply = await ask({ type: 'auth/state' });
    await settle();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect((reply.value as { notice: string }).notice).toBe(
      'The reading you left open was deleted just now.',
    );
    expect(local['astromatch.pending_deletes']).toEqual([]);
  });

  it('says NOTHING about a sweep that deleted nothing', async () => {
    storage['astromatch.session'] = session();
    const reply = await ask({ type: 'auth/state' });
    expect((reply.value as { notice: string }).notice).toBe('');
  });

  it('never sweeps a reading the user SAVED', async () => {
    scriptFetch();
    const port = await startRun();
    // PH-40's save answer, on the shipped carrier
    port.onMessage.fire({
      type: 'widget/answer',
      chatId: 'chat-7',
      text: 'Saving.\n\n```input_response\n{"type":"input_response","ask":"save_match_offer",' +
        '"values":{"save_match":"save","person2_name":"Someone"}}\n```',
    });
    await settle();
    calls.length = 0;
    port.onDisconnect.fire();
    await settle();
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  });

  it('does not sweep when nobody is signed in — there is nothing to delete with', async () => {
    storage = {};
    local['astromatch.pending_deletes'] = [{ chatId: 'chat-9', noticedAt: 1 }];
    scriptFetch();
    await ask({ type: 'auth/state' });
    await settle();
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
    // still owed, not forgotten
    expect(local['astromatch.pending_deletes']).toEqual([{ chatId: 'chat-9', noticedAt: 1 }]);
  });
});

describe('sign-out', () => {
  it('clears every key in session storage, not one by name', async () => {
    storage['astromatch.session'] = session();
    storage['something-core-wrote'] = 'x';
    const reply = await ask({ type: 'auth/sign-out' });
    expect(reply.ok).toBe(true);
    expect(storage).toEqual({});
  });

  it('reports signed-out afterwards', async () => {
    await ask({ type: 'auth/sign-out' });
    expect((await ask({ type: 'auth/state' })).value).toEqual({ signedIn: false });
  });
});

describe('the reads and the delete go to the shipped routes', () => {
  beforeEach(() => {
    storage['astromatch.session'] = session();
  });

  it('deletes a reading with DELETE /chats/{id}', async () => {
    nextResponse = { status: 204, body: null };
    const reply = await ask({ type: 'reading/delete', chatId: 'chat-1' });
    expect(reply.ok).toBe(true);
    expect(calls).toEqual([
      { url: 'https://chatbackend.yourfinadvisor.com/api/v1/chats/chat-1', method: 'DELETE' },
    ]);
    expect((reply.value as { status: number }).status).toBe(204);
  });

  it('resolves a place on the engine, and suggests from the gazetteer', async () => {
    await ask({ type: 'place/resolve', place: 'Pune, India' });
    await ask({ type: 'place/suggest', query: 'pun' });
    expect(calls.map((c) => `${c.method} ${c.url.split('/api/v1')[1]}`)).toEqual([
      'POST /astrology/resolve-location',
      'GET /people/self/places?q=pun',
    ]);
  });

  it('refuses every call when nobody is signed in, rather than sending one', async () => {
    storage = {};
    const reply = await ask({ type: 'place/resolve', place: 'Pune' });
    expect(reply).toEqual({ ok: false, error: 'Not signed in.' });
    expect(calls).toEqual([]);
  });

  it('names an unknown request instead of ignoring it', async () => {
    const reply = await ask({ type: 'nonsense/thing' });
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/unknown request/i);
  });

  it('says where a match must be started, rather than doing nothing', async () => {
    const reply = await ask({ type: 'match/start', title: 'x', profile: {} });
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/match port/i);
  });
});

function session() {
  return {
    idToken: 'id-1',
    refreshToken: 'r-1',
    expiresAt: Date.now() + 3_600_000,
    identifier: 'someone@example.com',
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** let the worker's promise chain (three awaited round trips) run out */
async function settle() {
  for (let i = 0; i < 60; i += 1) await flush();
}

function json(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

function sse(text: string) {
  const payload = `event: message_delta\ndata: ${JSON.stringify({
    type: 'message_delta',
    delta: text,
  })}\n\n`;
  const bytes = new TextEncoder().encode(payload);
  let done = false;
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    body: {
      getReader: () => ({
        read: async () =>
          done ? { done: true, value: undefined } : ((done = true), { done: false, value: bytes }),
        cancel: async () => {},
        releaseLock: () => {},
      }),
    },
  } as unknown as Response;
}
