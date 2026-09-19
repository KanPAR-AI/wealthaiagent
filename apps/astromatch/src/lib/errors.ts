/**
 * Reading an error off this backend, in one place.
 *
 * ── the shape, measured rather than assumed ───────────────────────────────
 *
 * The app installs a global exception handler that RESHAPES every
 * `HTTPException` before it leaves, so the `{"detail": "…"}` FastAPI is
 * documented to send is not what arrives. Probed on 2026-09-19 against the
 * local container:
 *
 *     POST /api/v1/astrology/resolve-location   {"place": "Xqzzyzzy…"}
 *     404 {"error":{"code":"NOT_FOUND",
 *                   "message":"Path not found: /api/v1/astrology/resolve-location",
 *                   "method":"POST"}}
 *
 * Two things follow, and both are why this is a module rather than an inline
 * `body.detail`:
 *
 *   1. **Read `error.message`.** A client reading `detail` gets `undefined`
 *      and falls back to a generic sentence — which is how "Please wait
 *      before requesting another code" becomes "Something went wrong" and a
 *      user presses the same button again.
 *   2. **A message is not always showable.** The 404 above is the route's own
 *      "place not found" rewritten by a handler that assumed 404 means a
 *      missing URL. Showing it would tell somebody who typed a village name
 *      that a path is missing. So callers ask for the message and DECIDE;
 *      `review-view.readResolveResponse` deliberately ignores it.
 *
 * The daily capture cap (PH-40, ASTRAL-318) answers 429 with the reset date
 * on the **`X-Resets-On` response header**, not in the body — so the reader
 * takes headers too.
 */

export interface ApiFailure {
  status: number;
  /** the backend's own sentence, or '' when it sent nothing readable */
  message: string;
  /** the backend's machine code, when it sent one */
  code: string;
  /** 429 only — when the allowance comes back, off `X-Resets-On` */
  resetsOn: string | null;
}

/** Anything with a `get`, so a `Headers` or a plain map both work. */
export interface HeaderLike {
  get(name: string): string | null;
}

export const RESETS_ON_HEADER = 'X-Resets-On';

export function readApiFailure(
  status: number,
  body: unknown,
  headers?: HeaderLike | null,
): ApiFailure {
  const bag = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const envelope =
    typeof bag.error === 'object' && bag.error !== null
      ? (bag.error as Record<string, unknown>)
      : {};

  const message =
    str(envelope.message) ||
    // A route whose error was NOT reshaped — and Firebase's own endpoints,
    // which answer `{"error": {"message": "INVALID_ID_TOKEN"}}`. Kept as a
    // fallback rather than removed: "read error.message, not detail" is
    // about which one wins, not about pretending the other never appears.
    str(bag.detail) ||
    '';

  return {
    status,
    message,
    code: str(envelope.code),
    resetsOn: status === 429 ? (headers?.get(RESETS_ON_HEADER) ?? null) : null,
  };
}

/**
 * The sentence to show, or the fallback — never an empty error.
 *
 * A thrown `Error('')` renders as a blank line next to a button that did
 * nothing, which is the failure shape this whole file exists to avoid.
 */
export function failureSentence(failure: ApiFailure, fallback: string): string {
  if (failure.status === 429 && failure.resetsOn) {
    const base = failure.message || fallback;
    return `${base} (it comes back on ${failure.resetsOn})`;
  }
  return failure.message || `${fallback} (${failure.status})`;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
