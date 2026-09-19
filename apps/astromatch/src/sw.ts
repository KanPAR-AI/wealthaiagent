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
import { CAPTURE_COMMAND, SELECTION_COMMAND } from './lib/manifest';
import {
  MATCH_PORT,
  type CaptureReply,
  type MatchEvent,
  type PanelRequest,
  type SelectionReply,
} from './lib/messages';
import {
  SELECTION_MENU_ID,
  SELECTION_MENU_TITLE,
  classifySelection,
  classifySelectionError,
  readSelectionInPage,
  takePendingSelection,
  selectionIsFresh,
  type PendingSelection,
  type SelectionOutcome,
} from './lib/selection';
import {
  HANDOFF_REFUSED_NOTE,
  MATCH_CHATS_KEY,
  forgetLink,
  linkFor,
  loadLinks,
  parseMatchChatHandoff,
  rememberLink,
} from './lib/match-chat';
import {
  claimKept,
  clearPending,
  notePending,
  owedNow,
  readPending,
  releaseKept,
  sweepNotice,
  sweepPending,
  type KeyValueStore,
} from './lib/pending-deletes';
import { BUILD_MODE } from './lib/runtime';
import {
  answerAsk,
  openChatWith,
  openMatchChat,
  planAnswer,
  runTurn,
} from './lib/transport';

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
      // FLAG-8 — the match-chat links go too, and for `saveSession(null)`'s
      // own reason: they are this ACCOUNT's chat ids, and signing out on a
      // shared machine must not leave the next person's panel holding a map
      // into somebody else's conversations. (The pending DELETES stay: they
      // are a promise about chats that still exist, and the next sign-in is
      // what can keep it.)
      await pendingStore.set({ [MATCH_CHATS_KEY]: [] });
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
    case 'selection/request':
      // The PANEL BUTTON, asking. Same shape as the camera's ask and for the
      // same measured reason (F159): a worker holding an `activeTab` grant
      // reads the selection; one that does not answers `needs-gesture` and
      // the panel prints the two gestures that grant one.
      return selectionReply(await readSelection('panel-button'));
    case 'selection/pending': {
      // Text a GESTURE produced before this panel existed. Handed over ONCE.
      const { taken, slot } = takePendingSelection(pendingSelection, Date.now());
      pendingSelection = slot;
      return taken;
    }
    case 'matches/list':
      // ASTRAL-339: the shortlist is a VIEW of the People store. Served as
      // sent — three labelled groups with their own printed sort rules — and
      // nothing is cached, ordered or re-grouped on the way through.
      return get('/people/matches');
    case 'matches/detail':
      // ASTRAL-340: one stored scorecard, read. Reads recompute nothing.
      return get(`/people/matches/${encodeURIComponent(message.pairKey)}`);
    case 'person/star':
      // ASTRAL-339: favourite rides the SHIPPED label patch. A label is not a
      // birth fact and this route takes none (INV-1, `test_people_api.py`).
      return patch(`/people/${encodeURIComponent(message.personId)}`, {
        favourite: message.favourite,
      });
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

/**
 * Did a match get stored on this account AFTER a claim was made?
 *
 * The question a stale `kept-claimed` record is resolved with (item 6, second
 * residual). It is the shipped list read and nothing else — no new route, no
 * new engine work — and it answers in three ways, which is why the return
 * type has a `null`: a question that could not be asked is not a "no", and a
 * chat is never deleted on one.
 *
 * `computed_at` is the engine's own stamp on the stored match. A save that
 * landed writes one after the claim was made; a save that never happened
 * leaves the newest stamp where it was.
 */
async function savedSince(noticedAt: number): Promise<boolean | null> {
  try {
    const reply = await get('/people/matches');
    if (reply.status !== 200 || !reply.body || typeof reply.body !== 'object') return null;
    const groups = (reply.body as { groups?: Array<{ rows?: Array<{ computed_at?: string }> }> })
      .groups;
    if (!Array.isArray(groups)) return null;
    for (const group of groups) {
      for (const row of group.rows ?? []) {
        const at = Date.parse(String(row.computed_at ?? ''));
        if (Number.isFinite(at) && at >= noticedAt) return true;
      }
    }
    return false;
  } catch (e: unknown) {
    // NOT a "no". The claim is kept and the question asked again next time.
    console.warn('[astromatch] could not ask whether a claimed save landed', e);
    return null;
  }
}

async function sweep(): Promise<void> {
  if (!(await currentToken())) return; // nothing to delete with; try again later
  const result = await sweepPending(pendingStore, removeChat, {
    inUse: openChats,
    savedSince,
  });
  const notice = sweepNotice(result);
  if (notice) lastSweepNotice = notice;
  if (result.remaining.length) {
    console.warn(
      `[astromatch] ${result.remaining.length} reading(s) still owed a delete — ` +
        'will try again on the next open',
    );
  }
  if (result.kept.length) {
    console.info(
      `[astromatch] ${result.kept.length} save(s) still unresolved — kept for now`,
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

async function patch(endpoint: string, body: unknown): Promise<Reply> {
  const token = await authorized();
  return reply(
    await fetch(apiUrl(BUILD_MODE, endpoint), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
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
 * The chat each open port created.
 *
 * Whether the user KEPT it is deliberately NOT here any more: that fact has
 * to survive this worker being torn down, so it lives in
 * `chrome.storage.local` as the pending record's `kept-claimed` state (item 6
 * residue). This map is only "which chat does this port own".
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
    } else if (message.type === 'match/ask') {
      // ASTRAL-341 — the conversation about a SAVED match. A different door
      // from `match/start`: nothing is confirmed here and no birth value
      // travels, because the facts are already on the People store.
      void askAboutMatch(port, message.handoff);
    } else if (message.type === 'match/say') {
      void sayInMatchChat(port, String(message.chatId ?? ''), String(message.text ?? ''));
    } else if (message.type === 'widget/answer') {
      // PH-40's save answer travels on this carrier. A reading the user KEPT
      // must never be swept away by a panel close, so the run is marked here
      // rather than being discovered later by guessing.
      const isSave = /"save_match"\s*:\s*"save"/.test(String(message.text ?? ''));
      const chatId = String(message.chatId ?? '');
      const text = String(message.text ?? '');
      void (async () => {
        // THE CLAIM IS WRITTEN BEFORE THE SAVE LEAVES (item 6 residue).
        // `savedRuns` is a WeakSet keyed by the port and dies with the
        // worker, which Chrome tears down whenever it likes — including
        // between this POST and the turn returning. The durable claim is what
        // the sweep reads, so it has to exist before the request that might
        // outlive this worker.
        if (isSave && chatId) await claimKept(pendingStore, chatId, Date.now());
        await sayAndRun(port, chatId, text, isSave);
      })();
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
    runProfiles.delete(port);
    runChats.delete(port);
    // No longer in use by an open panel, whichever way this goes.
    if (chatId) openChats.delete(chatId);
    if (!chatId) return;
    /**
     * ONE SOURCE OF TRUTH for "the user asked to keep this" (item 6 residue).
     *
     * This used to read a `WeakSet` keyed by the port, set at the moment the
     * save was CLICKED. Two things were wrong with it: it died with the
     * worker, so a teardown mid-save lost the fact and the next sweep deleted
     * a kept conversation; and it was never cleared when the save turn came
     * back EMPTY, so closing the panel after a failed save left a stranger's
     * details in a chat nothing deleted. The durable claim in
     * `chrome.storage.local` answers both — written before the save leaves,
     * released the moment the turn says it did not land.
     */
    void (async () => {
      // The promise list is the authority: a chat we do not owe a delete for
      // is not ours to delete. A saved reading's record was cleared when the
      // save landed; a save in flight is `kept-claimed`; an unsaved reading
      // is owed and goes now.
      if (!owedNow(await readPending(pendingStore), chatId)) return;
      const gone = await removeChat(chatId);
      if (gone) await clearPending(pendingStore, chatId);
    })().catch((e: unknown) => {
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
async function sayAndRun(
  port: chrome.runtime.Port,
  chatId: string,
  text: string,
  /**
   * This answer was "Add to my matches" (finding F383).
   *
   * The port's `onDisconnect` already honours `savedRuns`, so closing the
   * panel did not delete a kept reading. THE SWEEP DID. `notePending` records
   * the chat id the moment the chat is created and `clearPending` runs only
   * after a successful delete — so a saved reading's id stayed in
   * `chrome.storage.local` for ever, and the next panel open (which sweeps,
   * by design, to finish what a closed browser interrupted) deleted the
   * conversation the user had chosen to keep.
   *
   * Measured, not theorised: PH-41's walk saved a match, opened the shortlist
   * in a new panel seconds later, and the saved chat was gone. PH-40's walk
   * could not see it — leg 21 closes the panel, waits six seconds and never
   * opens another one.
   *
   * The promise is released when the TURN COMES BACK, not when the click
   * arrives: a save whose turn failed is still an unsaved reading, and its
   * chat is still owed a delete.
   */
  saved = false,
): Promise<void> {
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
    // F383: the reading is KEPT, so the promise to delete it is released —
    // in the one store the sweep reads.
    //
    // AN EMPTY STREAM DOES NOT PROVE THE SAVE FAILED. The engine writes the
    // match BEFORE it narrates, so a turn that produced no bytes may well
    // have saved. What it proves is that WE cannot say it did — and between
    // the two mistakes available here, we resolve toward deleting the
    // CONVERSATION, because the match itself survives in the People store and
    // the conversation is the copy of a third party's birth details. The
    // panel says exactly that ("I couldn't tell whether that saved — open
    // your matches to check"), and the sweep's own engine question resolves
    // the same record honestly when a worker dies before this point.
    if (saved) {
      if (outcome.kind === 'signed-out' || outcome.kind === 'empty') {
        await releaseKept(pendingStore, chatId);
      } else {
        await clearPending(pendingStore, chatId);
      }
    }
    send(port, { type: 'outcome', outcome });
  } catch (error) {
    // A save that THREW did not land — release the claim, so the ordinary
    // sweep still owns the chat. (A network error mid-POST is the one case
    // where the engine may have written anyway; the panel says it cannot tell
    // and the user can press it again, which is idempotent on the pair.)
    if (saved) {
      await releaseKept(pendingStore, chatId).catch((e: unknown) => {
        console.warn('[astromatch] could not release the kept claim', e);
      });
    }
    send(port, { type: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── one chat per saved match (docs/73 ASTRAL-341) ─────────────────────────

/**
 * Open — or REOPEN — the conversation about one stored match.
 *
 * Three properties, and each one is a line of code rather than a promise:
 *
 *   · the payload is parsed at this door and REFUSED if it carries anything
 *     but the four declared keys, or a digit in its opener
 *     (`parseMatchChatHandoff` — a restated birth value cannot get through);
 *   · the chat id is REUSED, so a match has one conversation and the engine's
 *     slot store and event log work unchanged;
 *   · the chat is NOT noted for deletion. It belongs to a match the user
 *     SAVED, and the sweep is for readings they did not — a per-match chat
 *     swept on close would be the panel deleting the user's own history.
 */
async function askAboutMatch(port: chrome.runtime.Port, raw: unknown): Promise<void> {
  const handoff = parseMatchChatHandoff(raw);
  if (!handoff) {
    console.warn('[astromatch] refused a match-chat handoff that was not in shape');
    send(port, { type: 'failed', error: HANDOFF_REFUSED_NOTE });
    return;
  }
  const deps = {
    getToken: currentToken,
    onDelta: (text: string) => send(port, { type: 'delta', text }),
  };
  try {
    const existing = linkFor(await loadLinks(pendingStore), handoff.pairKey);
    let chatId = existing;
    if (chatId) {
      const said = await trySay(chatId, handoff.opener);
      if (!said) {
        // The chat this match used is gone — deleted in the app, or expired
        // with the account. Named and handled, never swallowed: the link is
        // dropped and a fresh conversation is opened below.
        console.warn('[astromatch] the stored chat for this match is gone; opening a new one');
        await forgetLink(pendingStore, handoff.pairKey);
        chatId = null;
      }
    }
    if (!chatId) {
      chatId = await openChatWith(deps, handoff.title, handoff.opener);
      await rememberLink(pendingStore, { pairKey: handoff.pairKey, chatId });
    }
    port.postMessage({ type: 'chat', chatId });
    send(port, { type: 'outcome', outcome: await runTurn(deps, chatId) });
  } catch (error) {
    send(port, { type: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

/** A follow-up the user typed, in the match's own chat. */
async function sayInMatchChat(
  port: chrome.runtime.Port,
  chatId: string,
  text: string,
): Promise<void> {
  if (!chatId || !text) {
    send(port, { type: 'failed', error: 'Nothing to ask.' });
    return;
  }
  const deps = {
    getToken: currentToken,
    onDelta: (streamed: string) => send(port, { type: 'delta', text: streamed }),
  };
  try {
    await sendChatMessage(await authorized(), chatId, text, []);
    send(port, { type: 'outcome', outcome: await runTurn(deps, chatId) });
  } catch (error) {
    send(port, { type: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

/** Post into an existing chat; `false` when that chat is not there any more. */
async function trySay(chatId: string, text: string): Promise<boolean> {
  try {
    await sendChatMessage(await authorized(), chatId, text, []);
    return true;
  } catch (error) {
    // Handled explicitly rather than swallowed: the caller opens a new chat
    // and the user is told nothing was lost, because nothing was.
    console.warn('[astromatch] could not post into the stored match chat', error);
    return false;
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

// ── the selection read (docs/73 ASTRAL-338) ───────────────────────────────

/**
 * THE ONE INJECTION SITE, and it is reachable only from a gesture handler.
 *
 * `selection.test.ts` greps this module: `chrome.scripting.executeScript`
 * appears exactly once, `readSelection` is called exactly three times, and
 * each call names its gesture as a literal — `'command'`, `'context-menu'`,
 * `'panel-button'`. There is no injection on panel open, on a tab change or
 * on a timer, and there is no `content_scripts` key for one to hide in.
 *
 * `func` is the module-level `readSelectionInPage` — a named function a
 * reviewer can read whole — rather than an inline closure, because Chrome
 * serialises what it is given and an inline one would be invisible to the
 * grep that proves what the page runs.
 *
 * `chrome.tabs.query` is used for the TAB ID only. It needs no `tabs`
 * permission (which this manifest does not declare, by design): without it
 * Chrome returns the tab with no `url` and no `title`, which is all this
 * needs and deliberately less than it could have.
 */
async function readSelection(
  gesture: CaptureGesture,
  tabId?: number,
): Promise<SelectionOutcome> {
  try {
    // THE TAB THE GESTURE FIRED IN (F312's lesson, applied here before it
    // could happen again): a menu click and a command both carry their tab,
    // and only the panel button has none — it falls back to the active tab
    // of the current window, which is the window the panel is in.
    const target = tabId ?? (await activeTabId());
    if (target === undefined) {
      return { kind: 'failed', reason: 'Chrome did not tell me which tab to read.' };
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: target },
      func: readSelectionInPage,
    });
    return classifySelection(results?.[0]?.result, gesture);
  } catch (error) {
    return classifySelectionError(error instanceof Error ? error.message : String(error));
  }
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function selectionReply(outcome: SelectionOutcome): Promise<SelectionReply> {
  return { outcome, shortcut: await boundShortcut(SELECTION_COMMAND) };
}

/**
 * The selection hand-off slot: ONE selection, in memory, never in storage.
 *
 * The camera's twin, and it is a separate slot rather than a shared one
 * because the two states are different things: an image and a page's text.
 * A single slot would make a keyboard capture silently discard a selection
 * the user made a moment earlier.
 */
let pendingSelection: PendingSelection | null = null;

/**
 * Get a gesture's selection to a panel — `deliverCapture`'s twin.
 *
 * Same order, and for the same reason: hand it to an open panel first; hold
 * it and open one only when nothing is listening.
 */
async function deliverSelection(outcome: SelectionOutcome, tabId?: number): Promise<void> {
  if (outcome.kind !== 'selected') {
    // A gesture that read nothing still has to say so. It cannot draw
    // anything itself, so the panel is opened with an empty slot and asks
    // (`selection/request`), which lands on the same stated states.
    console.warn('[astromatch] a gesture selection read produced no text:', outcome.kind);
    if (tabId !== undefined) {
      await chrome.sidePanel.open({ tabId }).catch((e: unknown) => {
        console.warn('[astromatch] could not open the panel for a selection', e);
      });
    }
    return;
  }
  try {
    await chrome.runtime.sendMessage({
      type: 'selection/delivered',
      text: outcome.text,
      gesture: outcome.gesture,
    });
    return;
  } catch {
    // Nothing was listening — the panel is closed. Hold it and open one.
  }
  pendingSelection = { text: outcome.text, gesture: outcome.gesture, at: Date.now() };
  try {
    if (tabId !== undefined) await chrome.sidePanel.open({ tabId });
  } catch (e: unknown) {
    console.warn('[astromatch] could not open the panel for a selection', e);
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
async function boundShortcut(name: string = CAPTURE_COMMAND): Promise<string | null> {
  try {
    const commands = await chrome.commands.getAll();
    const bound = commands.find((c) => c.name === name);
    return bound?.shortcut ? bound.shortcut : null;
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
  // The selection slot is dropped on the same events and by the same rule:
  // a page's text left in a worker is the same promise as a page's picture.
  if (pendingSelection && !selectionIsFresh(pendingSelection, Date.now())) {
    pendingSelection = null;
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
  if (command === SELECTION_COMMAND) {
    // ASTRAL-338's keyboard gesture. It ships with this listener, exactly as
    // the capture command did: a shortcut Chrome lists and nothing answers is
    // a dead affordance with a key binding.
    void readSelection('command', tab?.id).then((outcome) =>
      deliverSelection(outcome, tab?.id),
    );
    return;
  }
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
  // ASTRAL-338's menu gesture. `contexts: ['selection']` is the point: Chrome
  // shows this item only when the user has text selected, so the offer cannot
  // appear where it would do nothing. Its callback is written out rather than
  // shared with the one above, so the "lastError is read" property is visible
  // AT each call site instead of one indirection away.
  chrome.contextMenus.create(
    { id: SELECTION_MENU_ID, title: SELECTION_MENU_TITLE, contexts: ['selection'] },
    () => {
      if (chrome.runtime.lastError) {
        console.warn('[astromatch] selection menu:', chrome.runtime.lastError.message);
      }
    },
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  dropStalePending();
  if (info.menuItemId === SELECTION_MENU_ID) {
    void readSelection('context-menu', tab?.id).then((outcome) =>
      deliverSelection(outcome, tab?.id),
    );
    return;
  }
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
  pendingSelection = null;
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
 * `scripting` is USED as of PH-41: `readSelection` above is its one call
 * site, on the user's gesture, and it came off `manifest.SHIPS_WITH_PH40`
 * in the same commit — from both sides, which is what that list is for.
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
