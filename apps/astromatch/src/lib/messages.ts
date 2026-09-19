/**
 * The panel ↔ service-worker protocol (docs/73 F154, ASTRAL-323/326).
 *
 * ALL NETWORK LIVES IN THE SERVICE WORKER. The panel is a document; the
 * worker holds the session and makes every request. Two reasons, and neither
 * is style:
 *
 *   1. A service worker's fetch to a host in `host_permissions` is not a
 *      CORS request, so the backend needs no `chrome-extension://` origin —
 *      and it could not have one, because `allow_credentials=True` forbids a
 *      `*` origin (F154). A panel-side fetch would need a backend change.
 *   2. The panel is the document that will eventually show a captured crop
 *      of somebody else's page. Keeping the credential out of it is the
 *      cheapest honest boundary there is.
 *
 * The one type that crosses this boundary carrying birth values is
 * `ConfirmedProfile`, and it crosses as a STRUCTURED CLONE — which drops the
 * compile-time brand. That is why `confirmed.parseConfirmedProfile` re-checks
 * the tag and every field on the worker's side before anything is sent.
 */

import type { CaptureGesture, CaptureOutcome } from './capture';
import type { ConfirmedProfile } from './confirmed';
import type { TurnOutcome } from './transport';

export type PanelRequest =
  | { type: 'auth/state' }
  | { type: 'auth/send-otp'; identifier: string }
  | { type: 'auth/verify-otp'; identifier: string; code: string }
  | { type: 'auth/sign-out' }
  /** the whole §3a sequence, run in the worker */
  | { type: 'match/start'; title: string; profile: ConfirmedProfile }
  | { type: 'place/suggest'; query: string }
  | { type: 'place/resolve'; place: string }
  /**
   * Delete the chat an UNSAVED reading created (docs/73 B1).
   *
   * Not a birth-fact route and not a new endpoint: `DELETE /chats/{id}` is
   * the shipped one the app already uses. It is here because the panel has
   * no network and because the worker is the only thing holding the token.
   */
  | { type: 'reading/delete'; chatId: string }
  /**
   * PH-40 — the camera (ASTRAL-330/331/332).
   *
   * `capture/request` is the PANEL BUTTON asking. It is not an assertion
   * that a capture is possible: the worker answers with the image or with
   * `needs-gesture`, and the panel renders the instruction. F159's question
   * is answered at run time, per click, rather than assumed once.
   *
   * `capture/pending` collects a capture a GESTURE produced while the panel
   * was closed. The worker holds exactly one, in memory, and hands it over
   * once (`capture.takePending`).
   *
   * `capture/extract` carries the CROP — the only image that ever leaves
   * this browser, after the per-capture consent (ASTRAL-332). Its body on
   * the wire is built by `consent.extractRequestBody`: one key, no page URL,
   * no title, no site name.
   */
  | { type: 'capture/request' }
  | { type: 'capture/pending' }
  | { type: 'capture/extract'; image: string }
  /**
   * The user's own record of what they agreed to (ASTRAL-332).
   *
   * Kept LOCALLY and never transmitted. It carries the words, the version
   * and the time, and nothing about any capture — no image, no candidate, no
   * page. The panel reads it back so the sentence "we record what you agreed
   * to" is something the user can actually check.
   */
  | { type: 'consent/log' };

export type WorkerReply =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * The worker's answer to a capture ask.
 *
 * `shortcut` is what CHROME ACTUALLY BOUND, read from
 * `chrome.commands.getAll()` — not the manifest's suggestion. Another
 * extension may hold Alt+Shift+M, in which case ours is unbound and an
 * instruction naming it would be an instruction that does nothing.
 */
export interface CaptureReply {
  outcome: CaptureOutcome;
  shortcut: string | null;
}

/** What a gesture-initiated capture hands to an already-open panel. */
export interface CaptureDelivered {
  type: 'capture/delivered';
  image: string;
  gesture: CaptureGesture;
}

/** What a running match sends back as it happens. */
export type MatchEvent =
  | { type: 'delta'; text: string }
  | { type: 'outcome'; outcome: TurnOutcome }
  | { type: 'failed'; error: string };

/** the port name the panel connects on for a match run */
export const MATCH_PORT = 'astromatch.match';

/**
 * The typed door a confirmed profile leaves through.
 *
 * Its parameter is `ConfirmedProfile`, and `ParsedProfile` is not assignable
 * to it — `type-fixtures/sends-parsed.ts` proves that with the compiler
 * rather than with a comment. Nothing else in this app constructs a
 * `match/start`.
 */
export function requestMatch(profile: ConfirmedProfile, title: string): PanelRequest {
  return { type: 'match/start', title, profile };
}
