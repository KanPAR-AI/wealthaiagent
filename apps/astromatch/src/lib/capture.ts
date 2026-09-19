/**
 * The camera's decisions (docs/73 ASTRAL-330, F159) — pure, no `chrome.*`.
 *
 * ── what F159 asked, and what was measured ────────────────────────────────
 *
 * `chrome.tabs.captureVisibleTab` needs `activeTab` or a host permission for
 * the captured tab. `activeTab` is granted by a gesture ON THE EXTENSION —
 * the toolbar action, a keyboard command, a context-menu item — and the spec
 * refused to assert from documentation whether that grant reaches a button
 * INSIDE the side panel minutes later.
 *
 * Measured in Chromium 145.0.7632.6 with the built extension loaded
 * (`e2e/spike-f159.mjs`), on 2026-09-19:
 *
 *   panel document → captureVisibleTab, no gesture, https page
 *     REFUSED: "Either the '<all_urls>' or 'activeTab' permission is required."
 *   service worker → the same, same sentence.
 *   service worker → a localhost page, with `http://localhost:8080/*` in
 *     host_permissions: REFUSED with the same sentence — a match pattern
 *     does NOT wildcard the port, so the dev build's host does not cover a
 *     page served on another one.
 *   service worker → the extension's OWN page: REFUSED, same sentence. There
 *     is no implicit self-grant.
 *
 * What the spike could NOT do is click Chrome's toolbar, press a
 * browser-level shortcut or open a native context menu: all three are
 * browser-process gestures and Playwright drives the renderer. So the exact
 * F159 question is answered by a human at a real Chrome, and this build does
 * not wait for it.
 *
 * ── therefore: ask, and say what happened ─────────────────────────────────
 *
 * The camera button does not assume a grant. It ASKS the worker to capture:
 *
 *   - the worker holds a grant  → an image comes back and the crop opens;
 *   - the worker holds none     → `needs-gesture`, and the panel renders the
 *                                 INSTRUCTION naming the shortcut Chrome has
 *                                 actually bound and the context-menu item.
 *
 * A button that cannot capture becomes words. It is never a silent no-op,
 * never a toast, and never a spinner — which is ASTRAL-330's whole clause.
 */

/** The three ways a capture can be asked for. Every one is a user action. */
export type CaptureGesture =
  /** `chrome.commands.onCommand` — grants activeTab unambiguously */
  | 'command'
  /** `chrome.contextMenus.onClicked` — grants activeTab unambiguously */
  | 'context-menu'
  /** a click on the camera inside the panel — grant NOT guaranteed (F159) */
  | 'panel-button';

/**
 * `chrome.windows.WINDOW_ID_CURRENT`, as a constant (R4).
 *
 * Written out rather than read off `chrome.windows` so the capture stays ONE
 * call with one argument shape — the grep in `capture.test.ts` proves there
 * is exactly one `captureVisibleTab` in the worker, and a two-branch call
 * would have made it two. The value is fixed in Chrome's own API surface.
 */
export const CURRENT_WINDOW = -2;

export const CONTEXT_MENU_ID = 'astromatch.capture';
export const CONTEXT_MENU_TITLE = 'Read this page into AstroMatch';

/**
 * What a capture attempt produced.
 *
 * `needs-gesture` is a DESIGNED state, not an error: it is the honest answer
 * to "I have no page access right now", and it carries the two gestures that
 * do grant it.
 */
export type CaptureOutcome =
  | { kind: 'captured'; image: string; gesture: CaptureGesture }
  | { kind: 'needs-gesture' }
  /** Chrome refused for a reason that is not about permission */
  | { kind: 'failed'; reason: string };

/**
 * The sentence Chrome refuses an ungranted capture with, measured above.
 *
 * Matched on its two stable tokens rather than on the whole string: the
 * wording has changed across Chrome versions (`'<all_urls>' permission` vs
 * `'<all_urls>' or`) and a client that pinned the full sentence would show a
 * raw API error to a user the day it changed.
 */
export function isPermissionRefusal(message: string): boolean {
  const text = String(message || '');
  return /activeTab/.test(text) && /permission|required/i.test(text);
}

/**
 * Chrome's error → the state the panel renders.
 *
 * Never "it failed, try again": a permission refusal has a next step the user
 * can actually take, and anything else is named with its own sentence.
 */
export function classifyCaptureError(message: string): CaptureOutcome {
  if (isPermissionRefusal(message)) return { kind: 'needs-gesture' };
  return {
    kind: 'failed',
    reason: message || 'Chrome would not give me a picture of this tab.',
  };
}

/**
 * The instruction, built from the shortcut CHROME ACTUALLY BOUND.
 *
 * `suggested_key` is a suggestion: another extension may already hold
 * Alt+Shift+M, in which case Chrome leaves ours unbound and
 * `chrome.commands.getAll()` returns an empty `shortcut`. Naming the
 * suggestion anyway would be an instruction that does nothing — the failure
 * this whole path exists to remove — so an unbound command is said as such,
 * with the two doors that still work.
 */
export interface Instruction {
  headline: string;
  /** the steps, in order, each one a thing the user can do right now */
  steps: string[];
}

export function instructionFor(shortcut: string | null): Instruction {
  const steps: string[] = [];
  if (shortcut) {
    steps.push(`Click the page you want to read, then press ${shortcut}.`);
  } else {
    steps.push(
      'Chrome has not given this extension a keyboard shortcut — you can set ' +
        'one at chrome://extensions/shortcuts.',
    );
  }
  steps.push(`Or right-click the page and choose "${CONTEXT_MENU_TITLE}".`);
  return {
    headline: 'Chrome needs you to point at the page first.',
    steps,
  };
}

/**
 * The hand-off slot between a gesture and an open panel.
 *
 * A command or a menu click can arrive with no panel open. The worker holds
 * ONE capture, in memory, for as long as it takes the panel to start — and
 * `take` CLEARS it, so a capture is delivered exactly once and never becomes
 * a cache that outlives the review (ASTRAL-337). It is never written to
 * `chrome.storage.*`; the storage scan in
 * `panel/__tests__/outcomes.test.tsx` is what keeps
 * that true rather than this sentence.
 */
export interface PendingCapture {
  image: string;
  gesture: CaptureGesture;
  at: number;
}

/** Long enough for a side panel to boot, short enough that a forgotten
 *  capture is gone rather than waiting. */
export const PENDING_CAPTURE_TTL_MS = 60_000;

export function pendingIsFresh(pending: PendingCapture | null, now: number): boolean {
  if (!pending) return false;
  return now - pending.at < PENDING_CAPTURE_TTL_MS;
}

/**
 * Take the pending capture, if there is a fresh one.
 *
 * Returns the capture AND the slot's new value, rather than mutating: the
 * caller assigns, and a test can see that the slot is empty afterwards
 * whichever branch ran.
 */
export function takePending(
  pending: PendingCapture | null,
  now: number,
): { taken: PendingCapture | null; slot: null } {
  return { taken: pendingIsFresh(pending, now) ? pending : null, slot: null };
}
