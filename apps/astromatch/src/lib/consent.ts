/**
 * The per-capture consent (docs/73 ASTRAL-332, INV-10).
 *
 * ── the boundary that moves, said out loud ────────────────────────────────
 *
 * On the text paths the rule is absolute: the parse is local and never
 * leaves the browser (ASTRAL-326). A screenshot cannot be parsed locally —
 * it needs a vision model and the model is server-side — so on THIS path the
 * cropped image is transmitted. The spec's answer is not to pretend
 * otherwise; it is to state the exception, ask every single time, and keep
 * the second half of the rule intact: what comes back are CANDIDATES, and
 * only the object the user confirms reaches the engine.
 *
 * ── every time, and never a checkbox ──────────────────────────────────────
 *
 * A remembered consent is a consent given once about a photograph of one
 * person and then reused for everybody else's. `consentedTo` is keyed by the
 * CAPTURE, and a capture id is minted per capture, so "remember this" is not
 * expressible rather than merely discouraged.
 *
 * The user's own copy of what they agreed to is written locally — the text,
 * its version, the time — and is never transmitted. Nothing about the image
 * or the page is in it: no URL, no title, no site, no bytes, no candidate.
 */

/**
 * The words, exactly as ASTRAL-332 writes them.
 *
 * The send path reads THIS constant and the screen renders THIS constant, so
 * the sentence a user agreed to and the sentence the code acted on cannot
 * drift apart. `panel/__tests__/snapshot.test.tsx` asserts the literal against the row, and against the string the send path reads.
 */
export const CONSENT_TEXT =
  'This crop is sent to Astral to read the birth details. It is not stored, ' +
  'not added to your files, and not kept in our logs. Only the details you ' +
  'confirm on the next screen are saved.';

/** Bumped when the sentence changes. A stored entry says which words. */
export const CONSENT_VERSION = 1;

/** The action's own label — an explicit act, never a pre-ticked box. */
export const CONSENT_ACTION = 'Send this crop to be read';

/** What the user agreed to, for one capture and one capture only. */
export interface Consent {
  captureId: string;
  version: number;
  text: string;
  at: number;
}

export function consentFor(captureId: string, at: number): Consent {
  return { captureId, version: CONSENT_VERSION, text: CONSENT_TEXT, at };
}

/**
 * May this capture be sent?
 *
 * The capture id has to MATCH. A consent for the previous capture does not
 * carry — which is the whole row, expressed as a comparison rather than as a
 * rule somebody has to remember.
 */
export function consentedTo(consent: Consent | null, captureId: string): boolean {
  if (!consent) return false;
  if (consent.captureId !== captureId) return false;
  return consent.version === CONSENT_VERSION && consent.text === CONSENT_TEXT;
}

/**
 * The user's own record of what they agreed to, kept locally.
 *
 * `chrome.storage.local` — deliberately, because it is theirs to read back
 * and a session-scoped copy would vanish before they looked. It carries the
 * VERSION and the TIME and the words, and nothing whatsoever about the
 * capture: `panel/__tests__/outcomes.test.tsx` scans the whole store for any fixture birth
 * value and this is one of the keys it scans.
 */
export const CONSENT_LOG_KEY = 'astromatch.consents';

/** Enough to answer "when did I agree to this?", bounded so it cannot grow. */
export const CONSENT_LOG_MAX = 50;

export interface ConsentLogEntry {
  version: number;
  text: string;
  /** ISO-8601, in the user's own clock */
  at: string;
}

export function appendConsentLog(
  existing: unknown,
  entry: ConsentLogEntry,
): ConsentLogEntry[] {
  const list = Array.isArray(existing) ? (existing as ConsentLogEntry[]) : [];
  const clean = list.filter(
    (e) => e && typeof e.at === 'string' && typeof e.version === 'number',
  );
  return [...clean, entry].slice(-CONSENT_LOG_MAX);
}

/**
 * The body that goes on the wire, built HERE so the assertion has one place
 * to bind to.
 *
 * ONE key. No page URL, no tab title, no site name, no capture id, no
 * gesture, no dimensions — X-3 says the backend must be unable to tell which
 * site a capture came from, and the cheapest way to hold that is for the
 * request to contain nothing that could say.
 */
export function extractRequestBody(image: string): { image: string } {
  return { image };
}
