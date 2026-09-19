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
import { claimKept } from '../pending-deletes';
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
const commandListeners: Listener[] = [];
const suspendListeners: Listener[] = [];
const menuListeners: Listener[] = [];

/**
 * What `chrome.tabs.captureVisibleTab` does in this run.
 *
 * A function rather than a value, so a case can make Chrome REFUSE — which
 * is F159's pessimistic branch and the one the panel's instruction state
 * exists for. The refusal sentence is the one measured in Chromium 145
 * (`e2e/spike-f159.mjs`), not an invented one.
 */
export const PERMISSION_REFUSAL =
  "Either the '<all_urls>' or 'activeTab' permission is required.";
let captureAnswer: () => Promise<string> = async () => 'data:image/png;base64,AAAA';
/** What `chrome.scripting.executeScript` answers, and what it was handed. */
let selectionAnswer: () => Promise<Array<{ result?: unknown }>> = async () => [
  { result: 'Name: Asha Verma' },
];
let injections: Array<{ target: { tabId: number }; func: () => string }> = [];
let storage: Record<string, unknown> = {};
let local: Record<string, unknown> = {};
let calls: Array<{ url: string; method: string; body?: string }> = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: {} };

beforeAll(async () => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'astromatch-test',
      onMessage: { addListener: (fn: Listener) => messageListeners.push(fn) },
      onConnect: { addListener: (fn: Listener) => connectListeners.push(fn) },
      onInstalled: { addListener: () => {} },
      // R3: the worker lets go of an uncollected capture when Chrome puts it
      // to sleep, so the fake has the door it registers on.
      onSuspend: { addListener: (fn: Listener) => suspendListeners.push(fn) },
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
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    action: { setTitle: async () => {}, setBadgeText: async () => {} },
    tabs: {
      onActivated: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      // PH-40. `captureVisibleTab` answers whatever the case under test set:
      // an image, or a rejection with Chrome's own permission sentence.
      captureVisibleTab: async () => captureAnswer(),
      // PH-41. The worker asks for the active tab's ID and nothing else —
      // this fake answers with no `url` and no `title`, exactly as Chrome
      // does without the `tabs` permission this manifest refuses.
      query: async () => [{ id: 99 }],
    },
    scripting: {
      // PH-41. `executeScript` answers whatever the case under test set: the
      // page's selection, or a rejection with Chrome's permission sentence.
      executeScript: async (args: { target: { tabId: number }; func: () => string }) => {
        injections.push(args);
        return selectionAnswer();
      },
    },
    contextMenus: {
      create: (_item: unknown, done?: () => void) => done?.(),
      onClicked: { addListener: (fn: Listener) => menuListeners.push(fn) },
    },
    commands: {
      onCommand: { addListener: (fn: Listener) => commandListeners.push(fn) },
      getAll: async () => [{ name: 'capture', shortcut: 'Alt+Shift+M' }],
    },
  };

  installDefaultFetch();
  await import('../../sw');
});

/** The plain one-reply fetch. Re-installed before every case, because one
 *  test below swaps in a three-stream script and would otherwise leak it. */
function installDefaultFetch() {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init?: { method?: string; body?: unknown },
  ) => {
    calls.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      // PH-40: what is IN the extract request is the assertion (X-3 — the
      // backend must be unable to tell which site a capture came from), so
      // the spy has to see the body, not only the URL.
      ...(init?.body === undefined ? {} : { body: String(init.body) }),
    });
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
  injections = [];
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

  /**
   * F383, found by PH-41's walk and fixed with it.
   *
   * The test above proves the PORT does not delete a saved reading. The SWEEP
   * did: `notePending` records the chat id when the chat is created, and
   * `clearPending` runs only after a successful delete — so a saved reading's
   * id sat in `chrome.storage.local` and the NEXT PANEL OPEN deleted the
   * conversation the user had chosen to keep. PH-40's walk closed the panel,
   * waited, and never opened another one, so it could not see it.
   */
  it('RELEASES the delete promise when the reading is saved, so no later sweep takes it', async () => {
    scriptFetch();
    const port = await startRun();
    expect(JSON.stringify(local['astromatch.pending_deletes'])).toContain('chat-7');
    port.onMessage.fire({
      type: 'widget/answer',
      chatId: 'chat-7',
      text: 'Saving.\n\n```input_response\n{"type":"input_response","ask":"save_match_offer",' +
        '"values":{"save_match":"save","person2_name":"Someone"}}\n```',
    });
    await settle();
    expect(local['astromatch.pending_deletes']).toEqual([]);

    // …and the panel that opens next sweeps NOTHING
    calls.length = 0;
    const reply = await ask({ type: 'auth/state' });
    await settle();
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
    expect((reply.value as { notice: string }).notice).toBe('');
  });

  it('KEEPS the promise when the save turn came back empty — that reading is not saved', async () => {
    // The other half, and it is the reason the promise is released on the
    // OUTCOME rather than on the click: a save that did not land leaves a
    // chat carrying a third party's birth details, still owed a delete.
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string; body?: string },
    ) => {
      const url = String(input);
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
      if (url.includes('/stream')) return sse('');
      if (url.endsWith('/chats')) return json({ chat: { id: 'chat-7' }, messages: [] });
      return json({});
    };
    storage['astromatch.session'] = session();
    const port = connect();
    port.onMessage.fire({ type: 'match/start', title: 'Match — Someone', profile: CONFIRMED });
    await settle();
    port.onMessage.fire({
      type: 'widget/answer',
      chatId: 'chat-7',
      text: 'Saving.\n\n```input_response\n{"type":"input_response","ask":"save_match_offer",' +
        '"values":{"save_match":"save","person2_name":"Someone"}}\n```',
    });
    await settle();
    expect(JSON.stringify(local['astromatch.pending_deletes'])).toContain('chat-7');
  });

  /**
   * ITEM 6 RESIDUE — the four rows of the reviewer's table, re-proved against
   * the DURABLE claim rather than against a WeakSet the worker loses.
   *
   * "This run was saved" used to live in `savedRuns`, keyed by the panel's
   * port. An MV3 worker is torn down whenever Chrome feels like it, including
   * between the save POST and the turn coming back — and the next panel open
   * then swept the conversation the user had chosen to keep. The claim is now
   * written to `chrome.storage.local` BEFORE the save is sent.
   */
  describe('item 6 — the kept claim is durable, and an unsaved reading still dies', () => {
    const SAVE_TEXT =
      'Saving.\n\n```input_response\n{"type":"input_response","ask":"save_match_offer",' +
      '"values":{"save_match":"save","person2_name":"Someone"}}\n```';

    it('(1) save OK → the record is gone, and no sweep or close deletes the chat', async () => {
      scriptFetch();
      const port = await startRun();
      port.onMessage.fire({ type: 'widget/answer', chatId: 'chat-7', text: SAVE_TEXT });
      await settle();
      expect(local['astromatch.pending_deletes']).toEqual([]);
      calls.length = 0;
      port.onDisconnect.fire();
      await ask({ type: 'auth/state' });
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
    });

    it('(0) the claim is on disk BEFORE the save POST leaves — the ordering IS the fix', async () => {
      // The whole point of item 6: a worker torn down between the POST and
      // the turn coming back must leave the claim behind. A claim written
      // AFTER the round trip would be lost in exactly the window it exists
      // for, so the store is read at the instant the request is made.
      storage['astromatch.session'] = session();
      let atPost: string | null = null;
      (globalThis as unknown as { fetch: unknown }).fetch = async (
        input: unknown,
        init?: { method?: string },
      ) => {
        const url = String(input);
        calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
        if (url.includes('/messages') && atPost === null) {
          atPost = JSON.stringify(local['astromatch.pending_deletes'] ?? []);
        }
        if (url.includes('/stream')) return sse('Saved.');
        if (url.endsWith('/chats')) return json({ chat: { id: 'chat-7' }, messages: [] });
        return json({});
      };
      const port = connect();
      port.onMessage.fire({ type: 'match/start', title: 'Match — Someone', profile: CONFIRMED });
      await settle();
      port.onMessage.fire({ type: 'widget/answer', chatId: 'chat-7', text: SAVE_TEXT });
      await settle();
      expect(atPost).not.toBeNull();
      expect(atPost).toContain('kept-claimed');
      expect(atPost).toContain('chat-7');
    });

    it('(2) save came back EMPTY → the claim is RELEASED and the chat is swept', async () => {
      (globalThis as unknown as { fetch: unknown }).fetch = async (
        input: unknown,
        init?: { method?: string },
      ) => {
        const url = String(input);
        calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
        if (url.includes('/stream')) return sse('');
        if (url.endsWith('/chats')) return json({ chat: { id: 'chat-7' }, messages: [] });
        return json({});
      };
      storage['astromatch.session'] = session();
      const port = connect();
      port.onMessage.fire({ type: 'match/start', title: 'Match — Someone', profile: CONFIRMED });
      await settle();
      port.onMessage.fire({ type: 'widget/answer', chatId: 'chat-7', text: SAVE_TEXT });
      await settle();
      // owed again — the state is off the record
      expect(local['astromatch.pending_deletes']).toEqual([
        { chatId: 'chat-7', noticedAt: expect.any(Number) },
      ]);
      calls.length = 0;
      // The panel is still OPEN on it, so the sweep leaves it alone — a chat
      // with a live port is in use, not left over. Leaving is what deletes
      // it, and the released claim is what allows that.
      await ask({ type: 'auth/state' });
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
      port.onDisconnect.fire();
      await settle();
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('chat-7'))).toBe(true);
    });

    it('(3) the worker was KILLED mid-save, and the claim is FRESH → kept for now', async () => {
      // Exactly what a torn-down worker leaves behind: the claim, unresolved.
      // The WeakSet is gone with the worker; this is what survives — and
      // inside the grace the save may still be finishing.
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-killed', noticedAt: Date.now(), state: 'kept-claimed' },
      ];
      scriptFetch();
      calls.length = 0;
      const reply = await ask({ type: 'auth/state' });
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
      expect((reply.value as { notice: string }).notice).toBe('');
      // …and it is still on the record, not silently forgotten
      expect(JSON.stringify(local['astromatch.pending_deletes'])).toContain('kept-claimed');
    });

    it('(3a) a STALE claim asks the engine — nothing stored → the chat is deleted', async () => {
      // The residual this round closed: a claim used to be immortal, so the
      // unsaved reading's chat — a third party's birth details — was never
      // deleted and the user was never told.
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-stale', noticedAt: Date.now() - 20 * 60_000, state: 'kept-claimed' },
      ];
      nextResponse = { status: 200, body: { groups: [], total: 0 } };
      calls.length = 0;
      const reply = await ask({ type: 'auth/state' });
      await settle();
      expect(calls.some((c) => c.url.includes('/people/matches'))).toBe(true);
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('chat-stale'))).toBe(true);
      expect((reply.value as { notice: string }).notice).toBe(
        'The reading you left open was deleted just now.',
      );
      expect(local['astromatch.pending_deletes']).toEqual([]);
    });

    it('(3b) a STALE claim whose save LANDED keeps the chat and drops the record', async () => {
      const claimedAt = Date.now() - 20 * 60_000;
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-saved', noticedAt: claimedAt, state: 'kept-claimed' },
      ];
      nextResponse = {
        status: 200,
        body: {
          groups: [
            {
              key: 'complete',
              label: 'Scored out of 36',
              rows: [{ pair_key: 'p_x__self', computed_at: new Date(claimedAt + 60_000).toISOString() }],
            },
          ],
          total: 1,
        },
      };
      calls.length = 0;
      await ask({ type: 'auth/state' });
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
      expect(local['astromatch.pending_deletes']).toEqual([]);
    });

    it('(3e) a match stored BEFORE the claim is not evidence — the chat is deleted', async () => {
      // The question is "was anything stored SINCE this claim was made?".
      // An account that already had matches must not make every stale claim
      // look like a save that landed.
      const claimedAt = Date.now() - 20 * 60_000;
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-older', noticedAt: claimedAt, state: 'kept-claimed' },
      ];
      nextResponse = {
        status: 200,
        body: {
          groups: [
            {
              key: 'complete',
              label: 'Scored out of 36',
              rows: [
                {
                  pair_key: 'p_old__self',
                  // a month before the claim
                  computed_at: new Date(claimedAt - 30 * 24 * 60 * 60_000).toISOString(),
                },
              ],
            },
          ],
          total: 1,
        },
      };
      calls.length = 0;
      await ask({ type: 'auth/state' });
      await settle();
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('chat-older'))).toBe(true);
      expect(local['astromatch.pending_deletes']).toEqual([]);
    });

    it('(3c) an engine that cannot be asked keeps the claim and retries', async () => {
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-unknown', noticedAt: Date.now() - 20 * 60_000, state: 'kept-claimed' },
      ];
      nextResponse = { status: 500, body: { error: { message: 'boom' } } };
      calls.length = 0;
      await ask({ type: 'auth/state' });
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
      expect(JSON.stringify(local['astromatch.pending_deletes'])).toContain('kept-claimed');
    });

    it('(3d) at the CEILING the claim is cleaned up, and the user is told', async () => {
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        {
          chatId: 'chat-ancient',
          noticedAt: Date.now() - 8 * 24 * 60 * 60_000,
          state: 'kept-claimed',
        },
      ];
      scriptFetch();
      calls.length = 0;
      const reply = await ask({ type: 'auth/state' });
      await settle();
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('chat-ancient'))).toBe(true);
      expect((reply.value as { notice: string }).notice).toContain('could not be confirmed');
      expect(local['astromatch.pending_deletes']).toEqual([]);
    });

    it('(4) the panel CLOSED mid-save → the claim, not the WeakSet, decides', async () => {
      scriptFetch();
      const port = await startRun();
      // the claim lands before the save is sent; the port dies before the
      // turn returns, and this worker's `savedRuns` is not consulted here
      await claimKept(pendingStore(), 'chat-7', 1);
      calls.length = 0;
      port.onDisconnect.fire();
      await settle();
      expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
    });

    it('(5) an UNSAVED reading is still deleted on close AND on the next sweep', async () => {
      scriptFetch();
      const port = await startRun();
      calls.length = 0;
      port.onDisconnect.fire();
      await settle();
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('chat-7'))).toBe(true);
    });

    it('(6) a claim on one chat never protects another', async () => {
      storage['astromatch.session'] = session();
      local['astromatch.pending_deletes'] = [
        { chatId: 'chat-kept', noticedAt: Date.now(), state: 'kept-claimed' },
        { chatId: 'chat-owed', noticedAt: 2 },
      ];
      scriptFetch();
      calls.length = 0;
      await ask({ type: 'auth/state' });
      await settle();
      const deleted = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
      expect(deleted.some((u) => u.includes('chat-owed'))).toBe(true);
      expect(deleted.some((u) => u.includes('chat-kept'))).toBe(false);
    });
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

/** The same bag `sw.ts` writes to, so a test can put the worker's own claim
 *  there without reaching into the module. */
function pendingStore() {
  return {
    get: async (key: string) => ({ [key]: local[key] }),
    set: async (items: Record<string, unknown>) => {
      local = { ...local, ...items };
    },
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

// ── PH-40 · the camera (docs/73 ASTRAL-330/331/332) ────────────────────────

describe('the camera, at the worker (ASTRAL-330)', () => {
  beforeEach(() => {
    storage['astromatch.session'] = session();
    captureAnswer = async () => 'data:image/png;base64,Q0FQVFVSRQ==';
  });

  it('captures the visible tab when the panel asks and Chrome allows it', async () => {
    const reply = await ask({ type: 'capture/request' });
    expect(reply.ok).toBe(true);
    expect(reply.value).toEqual({
      outcome: {
        kind: 'captured',
        image: 'data:image/png;base64,Q0FQVFVSRQ==',
        gesture: 'panel-button',
      },
      shortcut: 'Alt+Shift+M',
    });
    // a capture is not a network call
    expect(calls).toEqual([]);
  });

  it('answers a REFUSAL with needs-gesture, and the shortcut to name', async () => {
    captureAnswer = async () => {
      throw new Error(PERMISSION_REFUSAL);
    };
    const reply = await ask({ type: 'capture/request' });
    expect(reply.ok).toBe(true);
    expect(reply.value).toEqual({
      outcome: { kind: 'needs-gesture' },
      shortcut: 'Alt+Shift+M',
    });
  });

  it('names a non-permission failure rather than sending the user round a loop', async () => {
    captureAnswer = async () => {
      throw new Error('Failed to capture tab: chrome://extensions/');
    };
    const reply = (await ask({ type: 'capture/request' })) as {
      value: { outcome: { kind: string; reason?: string } };
    };
    expect(reply.value.outcome.kind).toBe('failed');
    expect(reply.value.outcome.reason).toContain('chrome://extensions');
  });

  it('treats an EMPTY answer from Chrome as a failure, not as a capture', async () => {
    captureAnswer = async () => '';
    const reply = (await ask({ type: 'capture/request' })) as {
      value: { outcome: { kind: string } };
    };
    expect(reply.value.outcome.kind).toBe('failed');
  });

  it('hands a gesture capture to an open panel, and stores nothing', async () => {
    let pushed: unknown = null;
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async (m: unknown) => {
      pushed = m;
      return undefined;
    };
    commandListeners[0]('capture', { id: 7 });
    await settle();
    expect(pushed).toEqual({
      type: 'capture/delivered',
      image: 'data:image/png;base64,Q0FQVFVSRQ==',
      gesture: 'command',
    });
    // nothing was held, so a later panel gets nothing
    expect(await ask({ type: 'capture/pending' })).toEqual({ ok: true, value: null });
    expect(JSON.stringify(local)).not.toContain('Q0FQVFVSRQ');
  });

  it('HOLDS a gesture capture when no panel is listening, and hands it over once', async () => {
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async () => {
      throw new Error('Could not establish connection.');
    };
    menuListeners[0]({ menuItemId: 'astromatch.capture' }, { id: 7 });
    await settle();
    const first = (await ask({ type: 'capture/pending' })) as {
      value: { image: string; gesture: string } | null;
    };
    expect(first.value?.image).toBe('data:image/png;base64,Q0FQVFVSRQ==');
    expect(first.value?.gesture).toBe('context-menu');
    // ONCE. A second ask gets nothing (ASTRAL-337 — no capture lingers).
    expect(await ask({ type: 'capture/pending' })).toEqual({ ok: true, value: null });
    // and it never touched storage on the way past
    expect(JSON.stringify(local)).not.toContain('Q0FQVFVSRQ');
  });

  it('ignores a context-menu click that is not ours', async () => {
    let captured = false;
    captureAnswer = async () => {
      captured = true;
      return 'data:image/png;base64,Q0FQVFVSRQ==';
    };
    menuListeners[0]({ menuItemId: 'somebody.else' }, { id: 7 });
    await settle();
    expect(captured).toBe(false);
  });

  it('ignores a command that is not ours', async () => {
    let captured = false;
    captureAnswer = async () => {
      captured = true;
      return 'data:image/png;base64,Q0FQVFVSRQ==';
    };
    commandListeners[0]('some-other-command', { id: 7 });
    await settle();
    expect(captured).toBe(false);
  });
});

describe('the crop goes to the extractor, and NOTHING else goes with it (ASTRAL-332)', () => {
  beforeEach(() => {
    storage['astromatch.session'] = session();
  });

  it('posts ONE key to the one route', async () => {
    nextResponse = { status: 200, body: { candidates: {} } };
    await ask({ type: 'capture/extract', image: 'data:image/png;base64,Q1JPUA==' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://chatbackend.yourfinadvisor.com/api/v1/astrology/extract-profile',
    );
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toEqual({ image: 'data:image/png;base64,Q1JPUA==' });
  });

  it('carries no page URL, title or site name (X-3)', async () => {
    nextResponse = { status: 200, body: { candidates: {} } };
    await ask({ type: 'capture/extract', image: 'data:image/png;base64,Q1JPUA==' });
    expect(Object.keys(JSON.parse(calls[0].body!))).toEqual(['image']);
  });

  it('refuses to send when nobody is signed in', async () => {
    storage = {};
    const reply = await ask({ type: 'capture/extract', image: 'data:image/png;base64,Q1JPUA==' });
    expect(reply).toEqual({ ok: false, error: 'Not signed in.' });
    expect(calls).toEqual([]);
  });
});

// ── PH-41 · the selection read, the shortlist, compare and the star ────────

describe('the selection read, at the worker (ASTRAL-338)', () => {
  beforeEach(() => {
    storage['astromatch.session'] = session();
    selectionAnswer = async () => [{ result: 'Name: Asha Verma' }];
  });

  it('injects ONE function into the active tab and returns what it read', async () => {
    const reply = await ask({ type: 'selection/request' });
    expect(reply.ok).toBe(true);
    expect(reply.value).toEqual({
      outcome: { kind: 'selected', text: 'Name: Asha Verma', gesture: 'panel-button' },
      // the SELECTION command's shortcut, not the camera's
      shortcut: null,
    });
    expect(injections).toHaveLength(1);
    expect(injections[0].target).toEqual({ tabId: 99 });
    // …and what was injected is the three-line reader, not a closure
    expect(String(injections[0].func)).toContain('getSelection');
    expect(String(injections[0].func)).not.toContain('fetch');
    // a selection read is not a network call, and never a paid one
    expect(calls).toEqual([]);
  });

  it('answers a REFUSAL with needs-gesture rather than an error', async () => {
    selectionAnswer = async () => {
      throw new Error(PERMISSION_REFUSAL);
    };
    const reply = await ask({ type: 'selection/request' });
    expect(reply.value).toEqual({ outcome: { kind: 'needs-gesture' }, shortcut: null });
  });

  it('an empty selection is `empty`, so the panel can say what is missing', async () => {
    selectionAnswer = async () => [{ result: '   ' }];
    const reply = (await ask({ type: 'selection/request' })) as {
      value: { outcome: { kind: string } };
    };
    expect(reply.value.outcome.kind).toBe('empty');
  });

  it('a frame that answered with nothing is `empty`, not a silent success', async () => {
    selectionAnswer = async () => [];
    const reply = (await ask({ type: 'selection/request' })) as {
      value: { outcome: { kind: string } };
    };
    expect(reply.value.outcome.kind).toBe('empty');
  });

  it('hands a gesture selection to an open panel, and stores nothing', async () => {
    let pushed: unknown = null;
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async (m: unknown) => {
      pushed = m;
      return undefined;
    };
    commandListeners[0]('selection', { id: 7 });
    await settle();
    expect(pushed).toEqual({
      type: 'selection/delivered',
      text: 'Name: Asha Verma',
      gesture: 'command',
    });
    expect(injections[0].target).toEqual({ tabId: 7 });
    expect(await ask({ type: 'selection/pending' })).toEqual({ ok: true, value: null });
    expect(JSON.stringify(local)).not.toContain('Asha');
  });

  it('HOLDS a gesture selection when no panel is listening, and hands it over ONCE', async () => {
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async () => {
      throw new Error('Could not establish connection.');
    };
    menuListeners[0]({ menuItemId: 'astromatch.selection' }, { id: 7 });
    await settle();
    const first = (await ask({ type: 'selection/pending' })) as {
      value: { text: string; gesture: string } | null;
    };
    expect(first.value?.text).toBe('Name: Asha Verma');
    expect(first.value?.gesture).toBe('context-menu');
    expect(await ask({ type: 'selection/pending' })).toEqual({ ok: true, value: null });
    // the text is somebody's page: it never touches storage on the way past
    expect(JSON.stringify(local)).not.toContain('Asha');
  });

  it('the CAPTURE menu item still captures — the two gestures do not cross', async () => {
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async () => {
      throw new Error('Could not establish connection.');
    };
    captureAnswer = async () => 'data:image/png;base64,Q0FQ';
    menuListeners[0]({ menuItemId: 'astromatch.capture' }, { id: 7 });
    await settle();
    expect(injections).toEqual([]);
    const held = (await ask({ type: 'capture/pending' })) as { value: { image: string } | null };
    expect(held.value?.image).toBe('data:image/png;base64,Q0FQ');
  });
});

describe('the shortlist, the compare read and the star go to the shipped routes', () => {
  beforeEach(() => {
    storage['astromatch.session'] = session();
  });

  it('reads the three groups with GET /people/matches', async () => {
    nextResponse = { status: 200, body: { groups: [], total: 0 } };
    const reply = await ask({ type: 'matches/list' });
    expect(reply.ok).toBe(true);
    expect(calls).toEqual([
      { url: 'https://chatbackend.yourfinadvisor.com/api/v1/people/matches', method: 'GET' },
    ]);
  });

  it('reads ONE stored match by its pair key, encoded', async () => {
    await ask({ type: 'matches/detail', pairKey: 'p_abc__self' });
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/people/matches/p_abc__self');
  });

  it('stars a person with the shipped label PATCH, carrying a label and nothing else', async () => {
    await ask({ type: 'person/star', personId: 'p_abc', favourite: true });
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toContain('/people/p_abc');
    expect(JSON.parse(calls[0].body as string)).toEqual({ favourite: true });
    // INV-1: no birth fact may ride on any HTTP route
    for (const fact of ['dob', 'tob', 'pob', 'date_of_birth', 'time_of_birth', 'place_of_birth']) {
      expect(calls[0].body).not.toContain(fact);
    }
  });

  it('sends none of the three when nobody is signed in', async () => {
    storage = {};
    for (const message of [
      { type: 'matches/list' },
      { type: 'matches/detail', pairKey: 'p_abc__self' },
      { type: 'person/star', personId: 'p_abc', favourite: true },
    ]) {
      expect(await ask(message)).toEqual({ ok: false, error: 'Not signed in.' });
    }
    expect(calls).toEqual([]);
  });
});

describe('FLAG-8 — sign-out lets go of the match-chat map, and nothing holds page text', () => {
  const HANDOFF = {
    personId: 'p_abc',
    pairKey: 'p_abc__self',
    opener: 'Tell me more about my match with Meera.',
    title: 'Match — Meera',
  };

  it('clears the links on sign-out, for `saveSession(null)`\'s own reason', async () => {
    storage['astromatch.session'] = session();
    local['astromatch.match_chats'] = [{ pairKey: 'p_abc__self', chatId: 'chat-1' }];
    await ask({ type: 'auth/sign-out' });
    expect(local['astromatch.match_chats']).toEqual([]);
    // …and the session bag is cleared whole, as it always was
    expect(storage).toEqual({});
  });

  it('keeps the pending DELETES across a sign-out — they are a promise', async () => {
    storage['astromatch.session'] = session();
    local['astromatch.pending_deletes'] = [{ chatId: 'chat-owed', noticedAt: 1 }];
    await ask({ type: 'auth/sign-out' });
    expect(local['astromatch.pending_deletes']).toEqual([{ chatId: 'chat-owed', noticedAt: 1 }]);
  });

  it('NO selection text is anywhere in either storage area', async () => {
    // The selection is a page's text. It rides the hand-off slot in worker
    // MEMORY and is handed to the panel once; nothing about it may reach
    // `session` or `local`. Scanned whole, rather than by checking a list of
    // keys (the `outcomes.test.tsx` rule).
    storage['astromatch.session'] = session();
    selectionAnswer = async () => [{ result: 'Name: Asha Verma\nDate of Birth: 14 May 1994' }];
    (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime
      .sendMessage = async () => {
      throw new Error('Could not establish connection.');
    };
    commandListeners[0]('selection', { id: 7 });
    await settle();
    await ask({ type: 'selection/pending' });
    for (const area of [storage, local]) {
      const written = JSON.stringify(area);
      expect(written).not.toContain('Asha');
      expect(written).not.toContain('14 May 1994');
      expect(written).not.toContain('Date of Birth');
    }
  });

  it('the 51st match chat drops the oldest link and opens a new chat for it', async () => {
    storage['astromatch.session'] = session();
    // A full store, written by earlier sessions.
    local['astromatch.match_chats'] = Array.from({ length: 50 }, (_, n) => ({
      pairKey: `p_${n}__self`,
      chatId: `chat-${n}`,
    }));
    let created = 0;
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string },
    ) => {
      const url = String(input);
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
      if (url.includes('/stream')) return sse('Here it is.');
      if (url.endsWith('/chats')) {
        created += 1;
        return json({ chat: { id: `chat-new-${created}` }, messages: [] });
      }
      return json({});
    };
    const port = connect();
    port.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    const links = local['astromatch.match_chats'] as Array<{ pairKey: string; chatId: string }>;
    expect(links).toHaveLength(50);
    // the oldest went, the new one is there, and the user was told nothing
    // about a bound — it simply behaves
    expect(links.some((l) => l.pairKey === 'p_0__self')).toBe(false);
    expect(links[links.length - 1]).toEqual({ pairKey: 'p_abc__self', chatId: 'chat-new-1' });
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'chat', chatId: 'chat-new-1' });
  });

  it('…and the match whose link was dropped simply opens a fresh chat', async () => {
    storage['astromatch.session'] = session();
    local['astromatch.match_chats'] = [];
    let created = 0;
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string },
    ) => {
      const url = String(input);
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
      if (url.includes('/stream')) return sse('Here it is.');
      if (url.endsWith('/chats')) {
        created += 1;
        return json({ chat: { id: `chat-fresh-${created}` }, messages: [] });
      }
      return json({});
    };
    const port = connect();
    port.onMessage.fire({
      type: 'match/ask',
      handoff: { ...HANDOFF, pairKey: 'p_0__self', title: 'Match — Someone' },
    });
    await settle();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'chat', chatId: 'chat-fresh-1' });
  });
});

describe('one chat per saved match, at the worker (ASTRAL-341)', () => {
  const ANSWER = 'Nadi scores 0 because you share a Nadi.';
  const HANDOFF = {
    personId: 'p_abc',
    pairKey: 'p_abc__self',
    opener: 'Tell me more about my match with Meera.',
    title: 'Match — Meera',
  };

  /** A backend that creates a chat, takes messages and streams one answer. */
  function chatFetch(options: { sayStatus?: number } = {}) {
    let created = 0;
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      input: unknown,
      init?: { method?: string; body?: string },
    ) => {
      const url = String(input);
      calls.push({
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        ...(init?.body === undefined ? {} : { body: String(init.body) }),
      });
      if (url.includes('/stream')) return sse(ANSWER);
      if (url.endsWith('/chats')) {
        created += 1;
        return json({ chat: { id: `chat-${created}` }, messages: [] });
      }
      if (url.includes('/messages')) {
        if (options.sayStatus && options.sayStatus >= 400) {
          return json({ error: { message: 'gone' } }, options.sayStatus);
        }
        return json({ id: 'm' });
      }
      return json({});
    };
  }

  it('opens ONE chat, remembers it, and reuses it next time', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const first = connect();
    first.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    expect(first.postMessage).toHaveBeenCalledWith({ type: 'chat', chatId: 'chat-1' });
    expect(calls.filter((c) => c.url.endsWith('/chats') && c.method === 'POST')).toHaveLength(1);
    // the opener travelled as the chat's first message and carried no fact
    const opened = calls.find((c) => c.url.endsWith('/chats') && c.method === 'POST');
    expect(opened?.body).toContain('match with Meera');
    expect(opened?.body).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    // …and the SECOND entry posts into the same chat rather than creating one
    calls = [];
    const second = connect();
    second.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    expect(calls.filter((c) => c.url.endsWith('/chats') && c.method === 'POST')).toHaveLength(0);
    expect(calls.some((c) => c.url.includes('/chats/chat-1/messages'))).toBe(true);
    expect(second.postMessage).toHaveBeenCalledWith({ type: 'chat', chatId: 'chat-1' });
  });

  it('keeps IDS ONLY in storage — no name, no birth value', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const port = connect();
    port.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    const written = JSON.stringify(local['astromatch.match_chats']);
    expect(written).toContain('p_abc__self');
    expect(written).not.toContain('Meera');
    expect(written).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('does NOT owe the match chat a delete — it belongs to a saved match', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const port = connect();
    port.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    // the pending-delete store is what the sweep reads; a per-match chat that
    // landed there would be the panel deleting the user's own history
    expect(JSON.stringify(local['astromatch.pending_deletes'] ?? [])).not.toContain('chat-1');
    calls = [];
    port.onDisconnect.fire();
    await settle();
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  });

  it('opens a NEW chat when the remembered one is gone, and says nothing was lost', async () => {
    storage['astromatch.session'] = session();
    local['astromatch.match_chats'] = [{ pairKey: 'p_abc__self', chatId: 'chat-old' }];
    chatFetch({ sayStatus: 404 });
    const port = connect();
    port.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'chat', chatId: 'chat-1' });
    expect(JSON.stringify(local['astromatch.match_chats'])).toContain('chat-1');
    expect(JSON.stringify(local['astromatch.match_chats'])).not.toContain('chat-old');
  });

  it('REFUSES a handoff that carries anything but the four declared keys', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const port = connect();
    port.onMessage.fire({
      type: 'match/ask',
      handoff: { ...HANDOFF, dob: '1994-05-14' },
    });
    await settle();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'failed',
      error: 'I could not open a conversation about that match. Nothing was sent.',
    });
    expect(calls).toEqual([]);
  });

  it('REFUSES an opener with a birth value written into it', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const port = connect();
    port.onMessage.fire({
      type: 'match/ask',
      handoff: { ...HANDOFF, opener: 'My match with Meera, born 1994-05-14.' },
    });
    await settle();
    expect(calls).toEqual([]);
  });

  it('a follow-up goes into the same chat and reaches no astrology route', async () => {
    storage['astromatch.session'] = session();
    chatFetch();
    const port = connect();
    port.onMessage.fire({ type: 'match/ask', handoff: HANDOFF });
    await settle();
    calls = [];
    port.onMessage.fire({ type: 'match/say', chatId: 'chat-1', text: 'why is Nadi zero' });
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url.split('/api/v1')[1].split('?')[0]}`)).toEqual([
      'POST /chats/chat-1/messages',
      'GET /chats/chat-1/stream',
    ]);
    expect(calls.some((c) => c.url.includes('/astrology/'))).toBe(false);
  });
});
