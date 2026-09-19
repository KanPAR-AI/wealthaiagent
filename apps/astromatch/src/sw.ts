/**
 * The service worker — the only thing in this extension with network
 * (docs/73 F154, ASTRAL-322/323/324).
 *
 * It holds the session, makes every request, and hands the panel back values
 * and states. The panel is a document that renders; it has no credential and
 * no fetch of its own, which is what `transport.test.ts`'s and
 * `panel-render.test.tsx`'s greps assert rather than assume.
 *
 * Nothing here decides anything about astrology. The sequence is
 * `lib/transport.ts`, the trust boundary is `lib/confirmed.ts`, and this file
 * is plumbing between them and Chrome.
 */

import { initCore, sendChatMessage, type PlatformAdapter } from '@wealthai/core';

import {
  sendOtp,
  tokenFor,
  verifyOtp,
  type AuthDeps,
  type Session,
} from './lib/auth';
import {
  CONTEXT_MENU_ID,
  CONTEXT_MENU_TITLE,
  CURRENT_WINDOW,
  classifyCaptureError,
  pendingIsFresh,
  takePending,
  type CaptureGesture,
  type CaptureOutcome,
  type PendingCapture,
} from './lib/capture';
import { apiUrl } from './lib/config';
import { FIREBASE_API_KEY } from './lib/config';
import { parseConfirmedProfile, type ConfirmedProfile } from './lib/confirmed';
import { RESETS_ON_HEADER } from './lib/errors';
import {
  CONSENT_LOG_KEY,
  CONSENT_TEXT,
  CONSENT_VERSION,
  appendConsentLog,
  extractRequestBody,
} from './lib/consent';
import { CAPTURE_COMMAND } from './lib/manifest';
import {
  MATCH_PORT,
  type CaptureReply,
  type MatchEvent,
  type PanelRequest,
} from './lib/messages';
import {
  clearPending,
  notePending,
  sweepNotice,
  sweepPending,
  type KeyValueStore,
} from './lib/pending-deletes';
import { BUILD_MODE } from './lib/runtime';
import { answerAsk, openMatchChat, planAnswer, runTurn } from './lib/transport';

// ── the session, in memory-backed session storage ──────────────────────────
//
// `chrome.storage.session` is cleared when the browser closes and is not
// readable from a content script. No raw token is written to
// `chrome.storage.local`, which survives on disk.

const SESSION_KEY = 'astromatch.session';

async function loadSession(): Promise<Session | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY);
  const value = bag[SESSION_KEY];
  return value && typeof value === 'object' ? (value as Session) : null;
}

async function saveSession(session: Session | null): Promise<void> {
  if (!session) {
    // CLEAR, not remove-one-key (follow-up 6). `chrome.storage.session` is
    // this extension's own namespace and nothing else writes to it; the
    // platform adapter below can put keys there too, and a sign-out that
    // removed one key by name would leave whatever else had accumulated —
    // which is the shape of "signed out" that is not signed out. It is
    // memory-backed, so there is nothing here worth keeping across a
    // sign-out anyway.
    await chrome.storage.session.clear();
    return;
  }
  await chrome.storage.session.set({ [SESSION_KEY]: session });
}

const authDeps: AuthDeps = {
  fetch: (input, init) => fetch(input, init),
  apiUrl: (endpoint) => apiUrl(BUILD_MODE, endpoint),
  firebaseApiKey: FIREBASE_API_KEY,
};

async function currentToken(): Promise<string | null> {
  return tokenFor(authDeps, await loadSession(), saveSession);
}

// ── @wealthai/core runs on the worker's own fetch ──────────────────────────

const adapter: PlatformAdapter = {
  fetch: (input, init) => fetch(input, init),
  getApiUrl: (endpoint) => apiUrl(BUILD_MODE, endpoint),
  storage: {
    getItem: async (key) => {
      const bag = await chrome.storage.session.get(key);
      const value = bag[key];
      return typeof value === 'string' ? value : null;
    },
    setItem: async (key, value) => chrome.storage.session.set({ [key]: value }),
    removeItem: async (key) => chrome.storage.session.remove(key),
  },
  // No in-app event bus in a worker: the panel is the only listener and it
  // listens on a port. An emitter that dropped events silently would be a
  // worse answer than not having one.
  events: { emit: () => {}, on: () => () => {} },
};
initCore(adapter);

// ── the panel's requests ───────────────────────────────────────────────────

/**
 * Is this message from OUR OWN extension page? (follow-up 3)
 *
 * `chrome.runtime.onMessage` is reachable from any web page that knows the
 * extension id (through `externally_connectable`, which this manifest does
 * not declare) and from any other extension. The id check is the one that
 * matters; the URL check adds that it came from an extension PAGE of ours
 * rather than from a content script we injected into somebody's site — this
 * worker holds the session token and makes authenticated calls, so the door
 * is worth naming rather than assuming.
 */
function fromOurPanel(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (sender.url && !sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    return false;
  }
  return true;
}

chrome.runtime.onMessage.addListener((message: PanelRequest, sender, sendResponse) => {
  dropStalePending();
  if (!fromOurPanel(sender)) {
    // Refused by name rather than ignored: a silent drop looks like a hung
    // panel to whoever is debugging it.
    sendResponse({ ok: false, error: 'This extension only answers its own panel.' });
    return false;
  }
  void (async () => {
    try {
      sendResponse({ ok: true, value: await handle(message) });
    } catch (error) {
      // Never swallowed. The panel shows the sentence; a silent failure here
      // is a button that does nothing.
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true; // the response is async
});

async function handle(message: PanelRequest): Promise<unknown> {
  switch (message.type) {
    case 'auth/state': {
      const session = await loadSession();
      if (!session) return { signedIn: false };
      // The panel asks for this the moment it opens, which is the honest
      // place to finish a delete the browser interrupted (B1).
      await sweep();
      const notice = lastSweepNotice;
      lastSweepNotice = '';
      return { signedIn: true, identifier: session.identifier, notice };
    }
    case 'auth/send-otp':
      await sendOtp(authDeps, message.identifier);
      return { sent: true };
    case 'auth/verify-otp': {
      const session = await verifyOtp(authDeps, message.identifier, message.code);
      await saveSession(session);
      return { signedIn: true, identifier: session.identifier };
    }
    case 'auth/sign-out':
      await saveSession(null);
      return { signedIn: false };
    case 'place/suggest':
      return get(`/people/self/places?q=${encodeURIComponent(message.query)}`);
    case 'place/resolve':
      return post('/astrology/resolve-location', { place: message.place });
    case 'reading/delete': {
      const reply = await del(`/chats/${encodeURIComponent(message.chatId)}`);
      const gone = reply.status === 204 || reply.status === 200 || reply.status === 404;
      if (gone) await clearPending(pendingStore, message.chatId);
      return reply;
    }
    case 'capture/request':
      // The PANEL BUTTON. F159's open question, asked at run time instead of
      // assumed: if this worker holds an `activeTab` grant for the tab the
      // user is looking at, an image comes back; if it does not, the reply
      // is `needs-gesture` and the panel prints the two gestures that grant
      // one. It is never a button that appears to work and does not.
      return captureReply(await captureTab('panel-button'));
    case 'capture/pending': {
      // A capture a GESTURE produced before this panel existed. Handed over
      // ONCE: `takePending` returns the new slot value, which is always
      // null, so a capture cannot be collected twice or linger (ASTRAL-337).
      const { taken, slot } = takePending(pendingCapture, Date.now());
      pendingCapture = slot;
      return taken;
    }
    case 'capture/extract': {
      // The CROP, and the only image that ever leaves this browser. The body
      // is built by `consent.extractRequestBody` — one key — so there is one
      // place to assert that no page URL, title or site name travels (X-3).
      //
      // The user's copy of what they agreed to is written FIRST and locally:
      // a send that happens is a consent that was given, and recording it
      // after the round trip would lose it whenever the round trip failed.
      await recordConsent();
      return post('/astrology/extract-profile', extractRequestBody(message.image));
    }
    case 'consent/log':
      return (await pendingStore.get(CONSENT_LOG_KEY))[CONSENT_LOG_KEY] ?? [];
    case 'match/start':
      // Started on a PORT, not here — a match is a stream of states, not one
      // answer. Named rather than ignored, so a caller that sends it the
      // wrong way gets a sentence instead of silence.
      throw new Error('Start a match on the match port, not on a one-shot message.');
    default: {
      const exhaustive: never = message;
      throw new Error(`Unknown request: ${JSON.stringify(exhaustive)}`);
    }
  }
}

async function authorized(): Promise<string> {
  const token = await currentToken();
  if (!token) throw new Error('Not signed in.');
  return token;
}

/**
 * A reply the panel can read.
 *
 * `resetsOn` is carried across the boundary explicitly because the panel is a
 * different context and never sees a `Headers` object — the daily capture cap
 * answers 429 with its reset date on `X-Resets-On` (PH-38), and a value
 * dropped here would be a cap the user cannot be told the end of.
 */
interface Reply {
  status: number;
  body: unknown;
  resetsOn: string | null;
}

async function reply(res: Response): Promise<Reply> {
  return {
    status: res.status,
    body: await res.json().catch(() => null),
    resetsOn: res.headers.get(RESETS_ON_HEADER),
  };
}

async function get(endpoint: string): Promise<Reply> {
  const token = await authorized();
  return reply(
    await fetch(apiUrl(BUILD_MODE, endpoint), { headers: { Authorization: `Bearer ${token}` } }),
  );
}

/**
 * The ids of unsaved readings we still owe a delete (docs/73 B1).
 *
 * `local`, NOT `session`: `session` dies with the browser, which is exactly
 * the case the sweep exists for. IDS ONLY — see `pending-deletes.ts`.
 */
const pendingStore: KeyValueStore = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};

/** 204 and 404 both mean "it is gone", which is what the caller asked. */
async function removeChat(chatId: string): Promise<boolean> {
  const reply = await del(`/chats/${encodeURIComponent(chatId)}`);
  return reply.status === 204 || reply.status === 200 || reply.status === 404;
}

/**
 * Delete everything we still owe, and remember what we told the panel.
 *
 * Runs at worker start and again when the panel asks for its auth state —
 * which is the first thing it does on open. A worker that was torn down
 * mid-delete, or a browser that quit with the panel open, both land here.
 */
let lastSweepNotice = '';

async function sweep(): Promise<void> {
  if (!(await currentToken())) return; // nothing to delete with; try again later
  const result = await sweepPending(pendingStore, removeChat, openChats);
  const notice = sweepNotice(result);
  if (notice) lastSweepNotice = notice;
  if (result.remaining.length) {
    console.warn(
      `[astromatch] ${result.remaining.length} reading(s) still owed a delete — ` +
        'will try again on the next open',
    );
  }
}

/**
 * The shipped delete (docs/73 B1). 204 is success and 404 is "already gone",
 * which is the same outcome from the user's point of view and must not be
 * reported as a failure they can act on.
 */
async function del(endpoint: string): Promise<Reply> {
  const token = await authorized();
  const res = await fetch(apiUrl(BUILD_MODE, endpoint), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: null, resetsOn: null };
}

async function post(endpoint: string, body: unknown): Promise<Reply> {
  const token = await authorized();
  return reply(
    await fetch(apiUrl(BUILD_MODE, endpoint), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// ── the match run, on a port ───────────────────────────────────────────────

/**
 * The confirmed profile, for the LIFE OF THE RUN (follow-up 4).
 *
 * The partner's details are confirmed once, at the review screen. When the
 * user's OWN chart is not on file the engine asks for their details first —
 * and the run used to end there, so the partner ask that came next had
 * nothing to answer it: the user was asked to type the same three values a
 * second time, and the capture stamps (`capture_source` / `capture_edited`)
 * were lost with them, which is the provenance ladder defeated by a dropped
 * variable.
 *
 * Keyed by PORT, so it dies with the panel rather than living in the worker.
 */
const runProfiles = new WeakMap<chrome.runtime.Port, ConfirmedProfile>();

/**
 * The chat each open port created, and whether the user KEPT it.
 *
 * `saved` is always false in PH-39 — the save offer is never answered here —
 * but it is a field rather than a constant because PH-40 adds the save, and a
 * reading the user chose to keep must never be swept away by a panel close.
 */
const runChats = new WeakMap<chrome.runtime.Port, string>();
/**
 * The chat ids a panel is OPEN on right now — never swept.
 *
 * Measured in the browser walk: without this, opening a second panel swept
 * the reading the first one was still showing, because an id becomes
 * "pending" when the chat is CREATED rather than when it is abandoned. A chat
 * with a live port is in use, not left over.
 */
const openChats = new Set<string>();
const savedRuns = new WeakSet<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  dropStalePending();
  if (port.name !== MATCH_PORT) return;
  // FAIL CLOSED. An absent `sender` is not "it must be us" — it is a fact we
  // do not have about a port that is about to be handed a birth-details run
  // and this worker's token.
  if (!port.sender || !fromOurPanel(port.sender)) {
    console.warn('[astromatch] refused a match port with no verifiable sender');
    port.disconnect();
    return;
  }
  port.onMessage.addListener((message: { type: string; [k: string]: unknown }) => {
    if (message.type === 'match/start') {
      void runMatch(port, message.profile, String(message.title ?? 'Match'));
    } else if (message.type === 'widget/answer') {
      // PH-40's save answer travels on this carrier. A reading the user KEPT
      // must never be swept away by a panel close, so the run is marked here
      // rather than being discovered later by guessing.
      if (/"save_match"\s*:\s*"save"/.test(String(message.text ?? ''))) savedRuns.add(port);
      void sayAndRun(port, String(message.chatId ?? ''), String(message.text ?? ''));
    }
  });
  /**
   * The panel closed (B1).
   *
   * A side panel closing is the commonest way to leave a reading and it used
   * to delete nothing — the promise on the card was true of three buttons and
   * false of the X. The worker holds the chat id and the token, so it does
   * the delete itself; the id stays in `chrome.storage.local` until that
   * succeeds, so a worker torn down mid-request still owes it and the next
   * open collects.
   */
  port.onDisconnect.addListener(() => {
    const chatId = runChats.get(port);
    const saved = savedRuns.has(port);
    runProfiles.delete(port);
    runChats.delete(port);
    // No longer in use by an open panel, whichever way this goes.
    if (chatId) openChats.delete(chatId);
    if (!chatId || saved) return;
    void removeChat(chatId)
      .then((gone) => (gone ? clearPending(pendingStore, chatId) : undefined))
      .catch((e: unknown) => {
        console.warn('[astromatch] delete on panel close failed; still owed', e);
      });
  });
});

function send(port: chrome.runtime.Port, event: MatchEvent & { chatId?: string }): void {
  port.postMessage(event);
}

/**
 * §3a, end to end.
 *
 * `parseConfirmedProfile` is the door: the object arrived through a
 * structured clone, which dropped the compile-time brand, so it is re-checked
 * field by field before anything is sent (ASTRAL-326). A parse that got here
 * by mistake is refused with a sentence, not sent.
 */
async function runMatch(port: chrome.runtime.Port, raw: unknown, title: string): Promise<void> {
  const profile = parseConfirmedProfile(raw);
  if (!profile) {
    send(port, { type: 'failed', error: 'Those details have not been confirmed.' });
    return;
  }
  runProfiles.set(port, profile);
  const deps = {
    getToken: currentToken,
    onDelta: (text: string) => send(port, { type: 'delta', text }),
  };
  try {
    const chatId = await openMatchChat(deps, title);
    // Recorded BEFORE anything else can go wrong: from this moment there is
    // a chat carrying a third party's birth details, and the promise to
    // delete it must survive a worker teardown (B1).
    await notePending(pendingStore, chatId, Date.now());
    runChats.set(port, chatId);
    openChats.add(chatId);
    port.postMessage({ type: 'chat', chatId });

    const first = await runTurn(deps, chatId);
    if (first.kind === 'ask') {
      const plan = planAnswer(first.request, profile);
      if (plan.kind === 'send') {
        await answerAsk(deps, chatId, first.request, plan.values);
        send(port, { type: 'outcome', outcome: await runTurn(deps, chatId) });
        return;
      }
    }
    // Anything else — the engine's own ask for the USER's details, a
    // refusal, an empty turn — is handed to the panel AS IT IS. The panel
    // renders the ask through the one input widget and answers it on the one
    // carrier; it never builds an ask of its own (ASTRAL-328).
    send(port, { type: 'outcome', outcome: first });
  } catch (error) {
    send(port, { type: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * The user answered a widget themselves — post it and read the next turn.
 *
 * A different door from `match/start` and deliberately so: what travels here
 * is the text the SHARED input widget composed from what the user typed
 * (`buildInputResponseMessage`, the one carrier in the workspace), not a
 * machine's reading of somebody's page. The confirmed-profile door stays
 * narrow because that is the one a parse could slip through.
 */
async function sayAndRun(port: chrome.runtime.Port, chatId: string, text: string): Promise<void> {
  if (!chatId || !text) {
    send(port, { type: 'failed', error: 'Nothing to send.' });
    return;
  }
  const deps = {
    getToken: currentToken,
    onDelta: (streamed: string) => send(port, { type: 'delta', text: streamed }),
  };
  try {
    // STATICALLY IMPORTED, and that is the fix rather than the style (F306).
    //
    // This was `await import('@wealthai/core')`. In an MV3 service worker a
    // dynamic import after the worker has been evaluated does not resolve:
    // the promise never settles, nothing throws, and the caller waits
    // forever. Measured — the panel's "Add to my matches" posted the carrier,
    // the worker RECEIVED it (the port log proved that), and then nothing
    // happened at all: no message on the chat, no error, no state.
    //
    // PH-39 never met it because `sayAndRun` is only reached when the USER
    // answers a widget, and PH-39's walk had the worker auto-answer the
    // partner ask through `answerAsk`, which uses the static import at the
    // top of `transport.ts`. PH-40's save is its first live caller.
    await sendChatMessage(await authorized(), chatId, text, []);
    let outcome = await runTurn(deps, chatId);

    // Follow-up 4: the user has just answered the engine's ask for their OWN
    // details, and the next thing the engine asks for is the partner's —
    // which this run already holds, confirmed, with its capture stamps. Answer
    // it from there rather than making them type it twice.
    const profile = runProfiles.get(port);
    if (profile && outcome.kind === 'ask') {
      const plan = planAnswer(outcome.request, profile);
      if (plan.kind === 'send') {
        await answerAsk(deps, chatId, outcome.request, plan.values);
        outcome = await runTurn(deps, chatId);
      }
    }
    send(port, { type: 'outcome', outcome });
  } catch (error) {
    send(port, { type: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * The user's own record of the consent (ASTRAL-332).
 *
 * `chrome.storage.local`, deliberately: it is theirs to read back, and a
 * session-scoped copy would vanish before they looked. The entry carries the
 * WORDS, the version and the time — and nothing about the capture. The
 * storage scan in `outcomes.test.tsx` is what keeps that true.
 *
 * A failure here never blocks the send: the consent was given, and losing our
 * note of it is not a reason to refuse the thing the user asked for. It is
 * logged rather than swallowed.
 */
async function recordConsent(): Promise<void> {
  try {
    const bag = await pendingStore.get(CONSENT_LOG_KEY);
    await pendingStore.set({
      [CONSENT_LOG_KEY]: appendConsentLog(bag[CONSENT_LOG_KEY], {
        version: CONSENT_VERSION,
        text: CONSENT_TEXT,
        at: new Date().toISOString(),
      }),
    });
  } catch (e: unknown) {
    console.warn('[astromatch] could not record the consent locally', e);
  }
}

// ── the camera (docs/73 ASTRAL-330) ───────────────────────────────────────

/**
 * THE ONE CALL SITE, and it is reachable only from a gesture handler.
 *
 * `capture.test.ts` greps this module: `chrome.tabs.captureVisibleTab`
 * appears exactly once, `captureTab` is called exactly three times, and each
 * call names its gesture as a literal — `'command'`, `'context-menu'`,
 * `'panel-button'` — so a fourth caller would have to invent a fourth
 * gesture, which the type forbids. There is no capture on panel open, on a
 * tab change, or on a timer.
 *
 * The visible viewport only. No DOM is read on this path, by anything: the
 * extension has no `content_scripts`, and `scripting` is not used here.
 */
async function captureTab(
  gesture: CaptureGesture,
  windowId?: number,
): Promise<CaptureOutcome> {
  try {
    // THE WINDOW THE GESTURE FIRED IN (R4). `captureVisibleTab` with no
    // window captures the LAST FOCUSED one, and an `activeTab` grant can be
    // held on a tab in a different window — so the default could hand back a
    // picture of a page the user was not pointing at, which on this surface
    // is somebody else's data in somebody else's reading. The panel button
    // has no tab of its own and falls back to the current window, which is
    // the window the panel is in.
    const image = await chrome.tabs.captureVisibleTab(windowId ?? CURRENT_WINDOW, {
      format: 'png',
    });
    if (!image) {
      // Chrome answered without an error and without an image — a real
      // outcome on a tab that cannot be captured (a devtools window, a
      // chrome:// page). Named, because "nothing happened" is the failure
      // this whole path exists to remove.
      return { kind: 'failed', reason: 'Chrome gave me no picture of this tab.' };
    }
    return { kind: 'captured', image, gesture };
  } catch (error) {
    return classifyCaptureError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * The shortcut Chrome ACTUALLY BOUND, for the instruction to name.
 *
 * `suggested_key` is a suggestion: another extension may already hold
 * Alt+Shift+M, and Chrome then leaves ours unbound. An instruction naming a
 * key that does nothing is the same dead affordance as a button that does
 * nothing, one indirection further away.
 */
async function boundShortcut(): Promise<string | null> {
  try {
    const commands = await chrome.commands.getAll();
    const capture = commands.find((c) => c.name === CAPTURE_COMMAND);
    return capture?.shortcut ? capture.shortcut : null;
  } catch {
    // The API is absent in a context that has no commands (and in the tests'
    // fake chrome). Not knowing the shortcut is not a failure to capture —
    // the instruction drops to the context-menu door, which always exists.
    return null;
  }
}

/**
 * Wrap an outcome with the shortcut the instruction will name.
 *
 * Deliberately not an indirection that takes the gesture as a PARAMETER: that
 * would be a fourth call site of `captureTab` whose argument is a variable,
 * and the grep proving "the capture is reachable only from a gesture handler"
 * would have to reason about it. Three call sites, three literals, one per
 * handler.
 */
async function captureReply(outcome: CaptureOutcome): Promise<CaptureReply> {
  return { outcome, shortcut: await boundShortcut() };
}

/**
 * The hand-off slot: ONE capture, in memory, never in storage.
 *
 * A gesture can fire with no panel open. The image waits here until the panel
 * asks for it and is dropped the moment it is taken — `takePending` returns
 * the new slot value rather than mutating, so both branches empty it. It is
 * never written to `chrome.storage.*`, which `panel/__tests__/outcomes.test.tsx` asserts by
 * scanning the whole store rather than by checking a list of keys.
 */
let pendingCapture: PendingCapture | null = null;

/**
 * Drop a stale hand-off for real (R3).
 *
 * `takePending` only FILTERS at read time, so an uncollected capture — a
 * shortcut pressed with no panel open, and no panel ever opened — sat in
 * this worker's memory until something overwrote it. The bytes are a
 * screenshot of somebody else's page and "it would not be handed over" is
 * not the same promise as "it is gone".
 *
 * THE BOUND, stated: a capture is dropped at the first worker event after
 * `PENDING_CAPTURE_TTL_MS` (60 s) — every message, every port connect, every
 * gesture — and unconditionally when Chrome suspends the worker. In the
 * worst case (no event at all after the gesture) it lives until the worker
 * is torn down, which is Chrome's own 30-second idle timeout, and it is
 * never written anywhere that survives that. No timer is used: a timer near
 * `captureTab` is the shape `capture.test.ts` bans by name.
 */
function dropStalePending(): void {
  if (pendingCapture && !pendingIsFresh(pendingCapture, Date.now())) {
    pendingCapture = null;
  }
}

/**
 * A gesture captured something. Get it to a panel.
 *
 * Tried in the order that loses nothing: hand it to an open panel first; if
 * no panel is listening, hold it and open one. `chrome.sidePanel.open` needs
 * a user gesture, and a command or context-menu click IS one — which is the
 * second reason these two gestures are the fallbacks F159 names.
 */
async function deliverCapture(outcome: CaptureOutcome, tabId?: number): Promise<void> {
  if (outcome.kind !== 'captured') {
    // A gesture that could not capture still has to say so. It cannot draw
    // anything itself, so the panel is opened on the instruction state by
    // holding nothing and letting the panel ask (`capture/request`).
    console.warn('[astromatch] a gesture capture did not produce an image:', outcome.kind);
    return;
  }
  try {
    await chrome.runtime.sendMessage({
      type: 'capture/delivered',
      image: outcome.image,
      gesture: outcome.gesture,
    });
    return;
  } catch {
    // Nothing was listening — the panel is closed. Hold it and open one.
  }
  pendingCapture = { image: outcome.image, gesture: outcome.gesture, at: Date.now() };
  try {
    if (tabId !== undefined) await chrome.sidePanel.open({ tabId });
  } catch (e: unknown) {
    console.warn('[astromatch] could not open the panel for a capture', e);
  }
}

/**
 * F159's first designed fallback — a keyboard gesture, which grants
 * `activeTab` unambiguously.
 *
 * It ships in the same commit as this listener. docs/73 B5 removed the
 * `commands` block in PH-39 precisely because nothing answered it.
 */
chrome.commands.onCommand.addListener((command, tab) => {
  dropStalePending();
  if (command !== CAPTURE_COMMAND) return;
  void captureTab('command', tab?.windowId).then((outcome) =>
    deliverCapture(outcome, tab?.id),
  );
});

/**
 * F159's second designed fallback — a context-menu item, same reason.
 *
 * Created HERE rather than in the manifest because a menu item is created by
 * the phase that can honour it (PH-39's note said so and this is that
 * phase). The title claims nothing about having looked: "Read this page into
 * AstroMatch" is an offer, and the reading happens after the user crops and
 * consents.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    { id: CONTEXT_MENU_ID, title: CONTEXT_MENU_TITLE, contexts: ['page', 'selection', 'image'] },
    () => {
      // `lastError` READ, not ignored: an un-read lastError is an unhandled
      // rejection in the worker's log and a menu item that silently is not
      // there.
      if (chrome.runtime.lastError) {
        console.warn('[astromatch] context menu:', chrome.runtime.lastError.message);
      }
    },
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  dropStalePending();
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  void captureTab('context-menu', tab?.windowId).then((outcome) =>
    deliverCapture(outcome, tab?.id),
  );
});

// ── the toolbar ────────────────────────────────────────────────────────────

/**
 * Worker start (B1).
 *
 * An MV3 worker is torn down whenever Chrome feels like it and restarted on
 * the next event, so "on start" is the other half of the sweep: whatever a
 * previous life owed is collected here, before the panel is even open.
 */
/**
 * Chrome is putting this worker to sleep: let go of the capture now rather
 * than relying on the process going away (R3).
 */
chrome.runtime.onSuspend.addListener(() => {
  pendingCapture = null;
});

void sweep().catch((e: unknown) => {
  console.warn('[astromatch] start-up sweep failed; the ids are still owed', e);
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e: unknown) => {
    // Named, not swallowed: a panel that will not open on the toolbar click
    // is the whole product not starting.
    console.warn('[astromatch] could not set the panel behaviour', e);
  });
});

/**
 * The context-menu item IS created in this build (PH-40).
 *
 * PH-39 deliberately did not create it: "Read this page into AstroMatch" had
 * nothing to read a page into — `capabilities.snapshot` was false — and a
 * menu item that answers with "not in this build" is the dead affordance
 * doctrine 8 forbids. The condition that note set has been met, so the item
 * is created above, beside the command that shares its job.
 *
 * `scripting` is still declared and still unused; it belongs to PH-41's
 * selection read and is named on `manifest.SHIPS_WITH_PH40` for exactly that
 * reason. If PH-41 slips, it comes out of the manifest.
 */

/**
 * THERE IS NO PER-TAB BADGE, and the reason is a measurement (docs/73 B5,
 * finding F193).
 *
 * ASTRAL-322 asks for a badge "computed from the tab URL alone". It is not
 * implementable on the permissions this extension declares: `tab.url` and
 * `changeInfo.url` are only populated when the extension holds the `tabs`
 * permission or a host permission matching that tab — and this manifest holds
 * neither, by design (X-2/X-3: no site host, and `tabs` would grant the URL
 * and title of every tab, which is more page knowledge than the product
 * needs). The listeners this file used to carry therefore read `undefined` on
 * every page and set the IDLE title everywhere, which is a badge that is
 * always wrong rather than a badge computed from a URL.
 *
 * So the toolbar keeps its single honest `action.default_title` — "Check this
 * match" — which promises nothing about the page and claims nothing about
 * having looked at it. `badge.ts` and its tests stay: the function is the
 * decision, and PH-40 (which gets `activeTab` on a real gesture) is where a
 * URL can honestly be read.
 */
