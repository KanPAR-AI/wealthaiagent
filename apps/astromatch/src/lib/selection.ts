/**
 * "Read my selection" — the decisions (docs/73 ASTRAL-338, X-2/X-3).
 *
 * Pure: no `chrome.*`, no React. The worker does the injecting; this module
 * holds the function that gets injected, the states it can produce and the
 * words each state is said in.
 *
 * ── what the injected function is allowed to be ───────────────────────────
 *
 * `readSelectionInPage` is serialised by Chrome and run ONCE, in the page, on
 * the user's gesture. It reads `window.getSelection().toString()`, returns
 * it, and is done. It stores nothing, posts nothing, keeps no reference and
 * never runs again until it is invoked again — there is no `content_scripts`
 * key in this manifest, no persistent script, and no listener left behind.
 *
 * It also contains, deliberately, NO site knowledge: no hostname, no CSS
 * selector, no per-site map. The product works because the user points at the
 * text, not because we learned somebody's DOM (X-2, X-3). `selection.test.ts`
 * greps this function's own source for `fetch`, `chrome.` and `localStorage`,
 * and `no-site-adapters.test.ts` greps the whole SOURCE TREE and the BUILT
 * BUNDLE for a hostname.
 *
 * ── the text never leaves the browser ─────────────────────────────────────
 *
 * What comes back goes into the SAME local parser the paste path uses
 * (`parse-profile.ts`) and onto the same review screen. Nothing is sent
 * anywhere: no extractor call, no capture allowance spent, no image. The one
 * thing that ever leaves is the object the user confirms, on the shipped chat
 * carrier — which is the whole reason this path exists beside the camera.
 *
 * ── F159 applies here too ─────────────────────────────────────────────────
 *
 * `chrome.scripting.executeScript` needs `activeTab`, which is granted by a
 * gesture ON THE EXTENSION. The spike measured (for the camera, same grant)
 * that a panel-button click may not carry one, so this path ASKS per click
 * and, when Chrome refuses, prints the two gestures that grant it
 * unambiguously — the `selection` command and the "Read my selection into
 * AstroMatch" context-menu item, both of which ship with their listeners.
 */

import { PENDING_CAPTURE_TTL_MS, isPermissionRefusal, type CaptureGesture } from './capture';

/**
 * THE INJECTED FUNCTION. Everything it may do is on these three lines.
 *
 * It must be self-contained: Chrome serialises it and runs it in the page's
 * own world, so a reference to anything in this module would be `undefined`
 * there. That is why the bound below is applied by the CALLER
 * (`classifySelection`) and not in here.
 */
export function readSelectionInPage(): string {
  const selection = window.getSelection();
  return selection ? selection.toString() : '';
}

export const SELECTION_MENU_ID = 'astromatch.selection';
export const SELECTION_MENU_TITLE = 'Read my selection into AstroMatch';

/**
 * The bound, applied here rather than in the page.
 *
 * A user can select a whole page. The parser reads a record's worth of lines
 * and the rest is noise, so the text is cut at a stated length — and because
 * nothing here is transmitted, the bound is about the parse and the screen,
 * never about a payload. It is applied in THIS module so the injected
 * function stays three lines that any reviewer can read at a glance.
 */
export const SELECTION_MAX_CHARS = 20_000;

/**
 * What an attempt to read the selection produced.
 *
 * `empty` is a DESIGNED state, not an error: a click with nothing selected is
 * the commonest way to use this button wrongly, and the honest answer names
 * the missing step. An empty review screen with four blank rows would look
 * like the page had been read and found wanting.
 */
export type SelectionOutcome =
  | { kind: 'selected'; text: string; gesture: CaptureGesture }
  | { kind: 'empty' }
  | { kind: 'needs-gesture' }
  | { kind: 'failed'; reason: string };

export const SELECTION_EMPTY_NOTE =
  'Select the birth details on the page first, then try again.';

/**
 * Chrome's answer → the state the panel renders.
 *
 * `raw` is whatever came back from the injection: a string on success, and
 * `undefined` when the frame answered with nothing. Neither becomes an empty
 * review.
 */
export function classifySelection(raw: unknown, gesture: CaptureGesture): SelectionOutcome {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { kind: 'empty' };
  return { kind: 'selected', text: text.slice(0, SELECTION_MAX_CHARS), gesture };
}

/**
 * The sentence Chrome refuses an UNGRANTED INJECTION with — and it is NOT the
 * camera's (finding F382, measured).
 *
 * `captureVisibleTab` says "Either the '<all_urls>' or 'activeTab' permission
 * is required."; `scripting.executeScript` says, measured in Chromium 145 on
 * 2026-09-19 through `e2e/ph41-walk.mjs`:
 *
 *   "Cannot access contents of the page. Extension manifest must request
 *    permission to access the respective host."
 *
 * It names neither `activeTab` nor a host pattern, so the camera's predicate
 * calls it an ordinary failure — and the panel then shows that sentence to a
 * user instead of the two gestures that would grant the access. The whole
 * point of ASTRAL-338's instruction state is that this cannot happen, so the
 * refusal is recognised on its own tokens as well as on the camera's.
 *
 * Matched on tokens rather than on the whole string, for the reason
 * `capture.isPermissionRefusal` gives: the wording has changed across Chrome
 * versions before and a client that pinned it would show a raw API error to a
 * user the day it changes again.
 */
export function isInjectionRefusal(message: string): boolean {
  const text = String(message || '');
  if (isPermissionRefusal(text)) return true;
  if (/cannot access contents of the page/i.test(text)) return true;
  return /must request permission/i.test(text) && /host|page/i.test(text);
}

/**
 * A thrown injection → a state.
 *
 * Every refusal Chrome has for "you may not touch that page" becomes the
 * INSTRUCTION, because they all have the same next step for the user; every
 * other error keeps its own sentence.
 */
export function classifySelectionError(message: string): SelectionOutcome {
  if (isInjectionRefusal(message)) return { kind: 'needs-gesture' };
  return {
    kind: 'failed',
    reason: message || 'Chrome would not let me read the selection on this page.',
  };
}

export interface SelectionInstruction {
  headline: string;
  steps: string[];
}

/**
 * The instruction, built from the shortcut CHROME ACTUALLY BOUND.
 *
 * Its own function rather than the camera's, because the gestures are
 * different: a different command and a different menu item, and naming the
 * camera's here would send the user to a door that takes a picture instead of
 * reading what they highlighted.
 */
export function selectionInstructionFor(shortcut: string | null): SelectionInstruction {
  const steps: string[] = [];
  if (shortcut) {
    steps.push(`Select the details on the page, then press ${shortcut}.`);
  } else {
    steps.push(
      'Chrome has not given this extension a shortcut for the selection read — ' +
        'you can set one at chrome://extensions/shortcuts.',
    );
  }
  steps.push(`Or select the details, right-click them and choose "${SELECTION_MENU_TITLE}".`);
  return {
    headline: 'Chrome needs you to point at the page first.',
    steps,
  };
}

/**
 * The hand-off slot between a gesture and an open panel — the camera's twin.
 *
 * One selection, in memory, taken exactly once, dropped when it goes stale
 * and when Chrome suspends the worker. It is never written to
 * `chrome.storage.*`: the text is somebody's page, and "it would not be
 * handed over" is a weaker promise than "it is gone".
 *
 * The TTL is IMPORTED rather than restated — one freshness rule for both
 * hand-offs, so a change to one cannot leave the other behind.
 */
export interface PendingSelection {
  text: string;
  gesture: CaptureGesture;
  at: number;
}

export function selectionIsFresh(pending: PendingSelection | null, now: number): boolean {
  if (!pending) return false;
  return now - pending.at < PENDING_CAPTURE_TTL_MS;
}

/** Take it, and empty the slot whichever branch ran. */
export function takePendingSelection(
  pending: PendingSelection | null,
  now: number,
): { taken: PendingSelection | null; slot: null } {
  return { taken: selectionIsFresh(pending, now) ? pending : null, slot: null };
}
