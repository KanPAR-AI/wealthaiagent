/**
 * Sign-in, in the service worker (docs/73 ASTRAL-323, AMB-72(a)).
 *
 * ── the round trip ────────────────────────────────────────────────────────
 *
 *   POST /auth/otp/send    { channel: "email", identifier }
 *   POST /auth/otp/verify  { channel, identifier, code }   → a Firebase
 *                                                            CUSTOM token
 *   POST identitytoolkit  accounts:signInWithCustomToken    → an ID token
 *   POST securetoken      token (grant_type=refresh_token)  → a fresh one
 *
 * It lands on the SAME account the app uses, and that is a fact about the
 * backend rather than a hope: `otp.py:_mint_custom_token` does
 * `fb_auth.get_user_by_email(ident)` first and only creates a user when that
 * raises `UserNotFoundError`. An owner who signs into the apps with an email
 * and password therefore gets a custom token for their EXISTING uid, and
 * sees their own saved matches here.
 *
 * ── why not the Firebase Web SDK ──────────────────────────────────────────
 *
 * The spec's wording is "signInWithCustomToken with the Firebase Web SDK
 * bundled locally". These two REST calls ARE what that SDK does, and doing
 * them directly is strictly smaller on every axis a Web Store review cares
 * about: no ~200 kB of auth SDK inside an MV3 service worker (where the SDK's
 * persistence layer expects IndexedDB and a document that a worker does not
 * have), no remote code, no `chrome.identity`, no offscreen document and no
 * OAuth client. Both hosts are Google's own and are CORS-open — the SDK calls
 * them from arbitrary web origins for a living — so neither needs a host
 * permission. Reported as a deliberate deviation rather than done quietly.
 *
 * ── what is stored, and where ─────────────────────────────────────────────
 *
 * The session lives in `chrome.storage.session`, which is memory-backed,
 * cleared when the browser closes and unreadable from a content script. The
 * panel never holds a long-lived credential: it asks the worker to make
 * calls. This module itself stores nothing — it is pure, takes its `fetch`,
 * and is therefore testable against a stubbed backend.
 */

import { failureSentence, readApiFailure } from './errors';

export interface Session {
  idToken: string;
  refreshToken: string;
  /** epoch ms. The refresh happens BEFORE this, never after a 401. */
  expiresAt: number;
  /** the email the user signed in with, shown so the account is never a guess */
  identifier: string;
}

export interface AuthDeps {
  fetch: typeof globalThis.fetch;
  /** `/auth/otp/send` → the full backend URL */
  apiUrl: (endpoint: string) => string;
  firebaseApiKey: string;
  now?: () => number;
}

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken';
const SECURE_TOKEN = 'https://securetoken.googleapis.com/v1/token';

/** Refresh this long before the hour runs out. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readError(res: Response, fallback: string): Promise<string> {
  // `readApiFailure` knows the envelope this backend actually sends —
  // `{"error": {"code", "message"}}`, not `{"detail"}` — and the 429 header
  // the capture cap answers with. One reader, measured once (see errors.ts).
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // a non-JSON error body is not a crash; the fallback below carries the
    // status so the failure is still nameable
  }
  return failureSentence(readApiFailure(res.status, body, res.headers), fallback);
}

export async function sendOtp(deps: AuthDeps, identifier: string): Promise<void> {
  const res = await deps.fetch(deps.apiUrl('/auth/otp/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'email', identifier }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not send the code'));
}

export async function verifyOtp(
  deps: AuthDeps,
  identifier: string,
  code: string,
): Promise<Session> {
  const res = await deps.fetch(deps.apiUrl('/auth/otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'email', identifier, code }),
  });
  if (!res.ok) throw new Error(await readError(res, 'That code did not work'));
  const body = await res.json();
  const customToken = typeof body?.token === 'string' ? body.token : '';
  if (!customToken) throw new Error('The sign-in came back without a token.');
  return signInWithCustomToken(deps, customToken, identifier);
}

async function signInWithCustomToken(
  deps: AuthDeps,
  token: string,
  identifier: string,
): Promise<Session> {
  const res = await deps.fetch(`${IDENTITY_TOOLKIT}?key=${deps.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Firebase refused the sign-in'));
  const body = await res.json();
  return sessionFrom(deps, identifier, body?.idToken, body?.refreshToken, body?.expiresIn);
}

export async function refreshSession(deps: AuthDeps, session: Session): Promise<Session> {
  const res = await deps.fetch(`${SECURE_TOKEN}?key=${deps.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not refresh the session'));
  const body = await res.json();
  return sessionFrom(
    deps,
    session.identifier,
    body?.id_token,
    body?.refresh_token,
    body?.expires_in,
  );
}

function sessionFrom(
  deps: AuthDeps,
  identifier: string,
  idToken: unknown,
  refreshToken: unknown,
  expiresIn: unknown,
): Session {
  if (typeof idToken !== 'string' || !idToken) {
    throw new Error('Firebase returned no ID token.');
  }
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new Error('Firebase returned no refresh token.');
  }
  const seconds = Number(expiresIn);
  // A missing or unreadable lifetime is NOT silently treated as an hour:
  // guessing long makes every call fail at an unpredictable moment. Guess
  // short and the worst case is one extra refresh.
  const lifetime = Number.isFinite(seconds) && seconds > 0 ? seconds : 300;
  return {
    idToken,
    refreshToken,
    expiresAt: (deps.now?.() ?? Date.now()) + lifetime * 1000,
    identifier,
  };
}

export function needsRefresh(session: Session, now: number): boolean {
  return now >= session.expiresAt - REFRESH_MARGIN_MS;
}

/**
 * The token for a call, refreshed first if it is close to the end.
 *
 * `null` when nobody is signed in — the caller states that rather than
 * sending an unauthenticated request, which comes back as an empty account
 * and reads like "you have no matches".
 */
export async function tokenFor(
  deps: AuthDeps,
  session: Session | null,
  save: (session: Session) => Promise<void>,
): Promise<string | null> {
  if (!session) return null;
  if (!needsRefresh(session, deps.now?.() ?? Date.now())) return session.idToken;
  const fresh = await refreshSession(deps, session);
  await save(fresh);
  return fresh.idToken;
}
