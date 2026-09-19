/**
 * The §3a message sequence (docs/73 ASTRAL-324, ASTRAL-328).
 *
 * ── it is the SHIPPED chat channel, and that is the whole design ───────────
 *
 * No HTTP route accepts a birth fact (INV-1, F145). So every confirmed value
 * travels as an ```` input_response ```` fence on an ordinary chat message,
 * is parsed deterministically in `node_ingest` (GR-6) and is written by
 * `reconcile` — the one fact-writer. The extension adds no endpoint, no
 * client-writable slot and no birth value on a query string.
 *
 * ── two turns, not one, and the reason is measured ─────────────────────────
 *
 * F155: `_match_switch_due` (`graph.py:4014-4028`) refuses to flip the intent
 * to synastry on a turn that CARRIES third-person birth facts. So "match me
 * with this person, here are their details" in one message falls back to the
 * extractor's judgement — a model call deciding an intent this panel already
 * knows. Two turns keeps the deterministic switch.
 *
 * ── the panel branches on FENCES, never on prose ───────────────────────────
 *
 * `family_add.py:194-208` exists because a client that inferred state from
 * prose put "a green tick over the engine's own refusal". The outcome type
 * below is built only from ```` input_request ````, ```` match_report ```` and
 * the text itself — and the absence of both blocks is a STATED state, not a
 * spinner that waits for something that already finished.
 *
 * ── why this file calls core's stream reader ───────────────────────────────
 *
 * `listenToChatStreamCore` is the workspace's ONE server-sent-events reader,
 * with the TTFB and idle watchdogs that took three incidents to get right. A
 * second one written for this app would be a second set of those bugs. It is
 * a deliberate third caller — see the note this move left in
 * `packages/astral/src/__tests__/structural.test.ts`.
 */

import {
  createChatSession,
  listenToChatStreamCore,
  sendChatMessage,
} from '@wealthai/core';
import {
  buildInputResponseMessage,
  parseInputRequest,
  parseMatchReport,
  splitDataBlocks,
  type InputRequestPayload,
  type InputValue,
  type MatchReportPayload,
} from '@wealthai/astral';

import { PINNED_AGENT } from './config';
import { carrierValues, type ConfirmedProfile } from './confirmed';

/** The opener. It matches `_MATCH_WITH_CUE` (`graph.py:3918`), which is what
 *  makes the intent switch DETERMINISTIC rather than a model's reading. */
export const MATCH_OPENER = 'Match my kundli with theirs.';

/** The fenced types this surface knows. Passed to `splitDataBlocks` so a
 *  half-streamed block draws nothing instead of scrolling past as raw JSON. */
export const DATA_LANGUAGES = ['input_request', 'match_report'] as const;

export type TurnOutcome =
  /** the engine asked something — render it through the ONE input widget */
  | { kind: 'ask'; request: InputRequestPayload; text: string }
  /**
   * The deterministic scorecard, and the save offer if one came with it.
   *
   * `truncated` is B6: the connection died after bytes had arrived. The
   * scorecard is still shown when its fence CLOSED — a fence is complete or
   * it is not, and `parseMatchReport` will not vouch for half of one — but
   * the narration is marked cut off and offered a retry. Serving a partial
   * reading as the whole one is the failure this field exists to remove.
   */
  | {
      kind: 'scorecard';
      report: MatchReportPayload;
      saveOffer: InputRequestPayload | null;
      text: string;
      truncated: boolean;
    }
  /** the engine's own sentence — a refusal, a clarification — rendered AS TEXT */
  | { kind: 'text'; text: string; truncated: boolean }
  /** nothing arrived. A stated state, never a spinner (ASTRAL-324). */
  | { kind: 'empty'; reason: string }
  /**
   * The session is not good any more (B6).
   *
   * Its own state, because the honest response is not "retry" — it is "sign
   * in again". `Failed to connect to SSE stream: Unauthorized` is a sentence
   * about a transport, shown to somebody whose session simply expired.
   */
  | { kind: 'signed-out'; reason: string };

export interface TransportDeps {
  /** a bearer token, or null when nobody is signed in */
  getToken: () => Promise<string | null>;
  /** streamed text, for painting as it arrives */
  onDelta?: (fullText: string) => void;
}

async function requireToken(deps: TransportDeps): Promise<string> {
  const token = await deps.getToken();
  if (!token) {
    // Loud. A turn sent unauthenticated comes back as somebody else's empty
    // account, which reads like "you have no matches" rather than like an
    // error.
    throw new Error('Not signed in.');
  }
  return token;
}

/** §3a step 1 — `POST /chats` with the opener. */
export async function openMatchChat(
  deps: TransportDeps,
  title: string,
): Promise<string> {
  const token = await requireToken(deps);
  const { chatId } = await createChatSession(token, title, MATCH_OPENER, []);
  return chatId;
}

/**
 * §3a steps 2 and 4 — `GET /chats/{id}/stream?force_agent=astrology_ai`.
 *
 * `force_agent` is MANDATORY on this surface: routing is off here exactly as
 * it is in `apps/astro`, and without it an image-bearing or oddly worded turn
 * is classified into the generic agent before the astrology graph ever runs.
 */
export async function runTurn(deps: TransportDeps, chatId: string): Promise<TurnOutcome> {
  const token = await requireToken(deps);
  let text = '';
  let failure: Error | null = null;

  await new Promise<void>((resolve) => {
    void listenToChatStreamCore(
      token,
      chatId,
      (chunk, type) => {
        // core maps every `message_delta` to `text_chunk`; anything else is
        // a structured event (credits, widgets) this surface does not read.
        if (type !== 'text_chunk') return;
        text += chunk;
        deps.onDelta?.(text);
      },
      () => resolve(),
      (error) => {
        failure = error;
        resolve();
      },
      { forceAgent: PINNED_AGENT },
    );
  });

  return classifyTurn(text, failure);
}

/**
 * The AUTHENTICATION sentence, recognised rather than guessed at.
 *
 * `listenToChatStreamCore` throws `Failed to connect to SSE stream: ${status}
 * ${statusText}` for a non-OK response, so the status arrives inside a
 * sentence. Reading it here is not prose-inference about a READING — it is
 * one transport error being classified, and the alternative is showing that
 * sentence to a user.
 */
export function isAuthFailure(error: Error | null): boolean {
  if (!error) return false;
  return /\b401\b|unauthorized|forbidden|\b403\b|not signed in/i.test(error.message);
}

export const TRUNCATED_NOTE =
  'The reading was cut off before it finished — the connection dropped.';

export const SIGNED_OUT_NOTE =
  'Your sign-in has expired. Sign in again and the reading will run from the top.';

/**
 * What the panel shows, given what arrived AND what went wrong (B6).
 *
 * Exported and pure, because the four interesting cases — an error after
 * text, an error after a complete fence, an error INSIDE a fence, a 401
 * before any bytes — are all about the pairing of the two arguments, and a
 * test can only pin them if it can call this.
 */
export function classifyTurn(text: string, failure: Error | null): TurnOutcome {
  if (isAuthFailure(failure)) return { kind: 'signed-out', reason: SIGNED_OUT_NOTE };

  const outcome = readTurn(text);
  if (!failure) return outcome;

  switch (outcome.kind) {
    case 'scorecard':
      // The fence CLOSED, so the deterministic half of the turn is whole.
      // The narration is not, and says so.
      return { ...outcome, truncated: true };
    case 'ask':
      // An ask whose stream died is not an ask we can answer honestly: the
      // block parsed, but we cannot know the engine finished asking.
      return { kind: 'empty', reason: `${TRUNCATED_NOTE} ${failure.message}` };
    case 'text':
      return { kind: 'text', text: outcome.text, truncated: true };
    case 'empty':
      return { kind: 'empty', reason: failure.message };
    default:
      return outcome;
  }
}

/**
 * The branch, over fences only. Exported because it is the part worth testing
 * against a recorded stream, and because it must be provable that no sentence
 * anywhere decides what the panel shows.
 */
export function readTurn(text: string): TurnOutcome {
  const segments = splitDataBlocks(text, DATA_LANGUAGES);
  let report: MatchReportPayload | null = null;
  let ask: InputRequestPayload | null = null;
  let saveOffer: InputRequestPayload | null = null;
  const prose: string[] = [];

  for (const segment of segments) {
    if (segment.kind === 'text') {
      prose.push(segment.text);
      continue;
    }
    if (segment.type === 'match_report') {
      report = parseMatchReport(segment.value) ?? report;
    } else if (segment.type === 'input_request') {
      const request = parseInputRequest(segment.value);
      if (!request) continue;
      // The save offer arrives WITH the scorecard; a details ask arrives
      // instead of one. Distinguished by the ask's own name, which the
      // engine declares — not by where it sat in the text.
      if (request.ask === SAVE_MATCH_ASK) saveOffer = request;
      else ask = request;
    }
  }

  const readable = stripAgentTag(prose.join('').trim());

  if (report) return { kind: 'scorecard', report, saveOffer, text: readable, truncated: false };
  if (ask) return { kind: 'ask', request: ask, text: readable };
  if (readable) return { kind: 'text', text: readable, truncated: false };
  return {
    kind: 'empty',
    reason: 'The reading came back empty — nothing to show yet.',
  };
}

/** The engine's own name for the save offer (`graph.py:12951`). */
export const SAVE_MATCH_ASK = 'save_match_offer';

/** The platform's routing banner, which is plumbing rather than a sentence. */
function stripAgentTag(text: string): string {
  return text.replace(/^\[Using [a-z_]+ agent\]\s*/i, '').trim();
}

/**
 * §3a step 3 — `POST /chats/{id}/messages?auto_reply=false` with the carrier.
 *
 * `auto_reply=false` is MANDATORY and is core's own hard-coded query string:
 * the default generates the whole turn a second time, which is two model
 * calls and two bills for one answer (docs/19 §1.9b).
 *
 * The message itself is built by `buildInputResponseMessage` — the ONE place
 * in the workspace a widget answer becomes a message. This module builds no
 * string of its own, which is what keeps the engine's parse deterministic
 * instead of a model's guess at a sentence (F18).
 */
export async function answerAsk(
  deps: TransportDeps,
  chatId: string,
  request: InputRequestPayload,
  values: Record<string, InputValue>,
): Promise<void> {
  const token = await requireToken(deps);
  await sendChatMessage(token, chatId, buildInputResponseMessage(request, values), []);
}

/**
 * Can this ask be answered from what the user already confirmed?
 *
 * ASTRAL-328's rule, in one function: the ENGINE decides which fields are
 * missing, and the panel never hard-codes a field set. When the ask's fields
 * are the partner's, the confirmed object answers it; when they are the
 * user's OWN (which is what arrives when their chart is not on file —
 * `graph.py:4040-4056`), it cannot be, and the panel renders the ask through
 * the one input widget for the user to answer themselves.
 */
export function planAnswer(
  request: InputRequestPayload,
  profile: ConfirmedProfile,
): { kind: 'send'; values: Record<string, InputValue> } | { kind: 'ask' } {
  const keys = request.fields.map((f) => f.key);
  const values = carrierValues(profile, keys);
  const required = request.fields.filter((f) => f.required).map((f) => f.key);
  const answerable = required.length > 0 && required.every((key) => key in values);
  return answerable ? { kind: 'send', values } : { kind: 'ask' };
}
