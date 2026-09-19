/**
 * docs/73 ASTRAL-323 — the OTP round trip, against a stubbed backend.
 *
 * The shapes below are the ones the real endpoints return:
 * `api/v1/endpoints/otp.py:71` answers `{"token": <custom token>, "linked":
 * false}`, and Google's identity-toolkit answers `{idToken, refreshToken,
 * expiresIn}`. What this proves is the ORDER and the HANDOFF — a custom token
 * is exchanged for an ID token before anything is called with it — plus the
 * two things that go wrong quietly: an error sentence swallowed, and a
 * session that is used past its life.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  needsRefresh,
  refreshSession,
  sendOtp,
  tokenFor,
  verifyOtp,
  type AuthDeps,
  type Session,
} from '../auth';

interface Call {
  url: string;
  body: string;
}

function stub(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  const deps: AuthDeps = {
    firebaseApiKey: 'test-key',
    apiUrl: (endpoint) => `https://backend.test/api/v1${endpoint}`,
    now: () => 1_000_000,
    fetch: (async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? '') });
      const next = responses[Math.min(i++, responses.length - 1)];
      return {
        ok: (next.status ?? 200) < 400,
        status: next.status ?? 200,
        json: async () => next.body,
      } as unknown as Response;
    }) as typeof globalThis.fetch,
  };
  return { deps, calls };
}

const TOKENS = { body: { idToken: 'id-1', refreshToken: 'refresh-1', expiresIn: '3600' } };

describe('the OTP round trip', () => {
  it('asks the backend for a code on the email channel', async () => {
    const { deps, calls } = stub([{ body: { sent: true } }]);
    await sendOtp(deps, 'someone@example.com');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://backend.test/api/v1/auth/otp/send');
    expect(JSON.parse(calls[0].body)).toEqual({
      channel: 'email',
      identifier: 'someone@example.com',
    });
  });

  it('exchanges the custom token for an ID token, in that order', async () => {
    const { deps, calls } = stub([{ body: { token: 'custom-abc', linked: false } }, TOKENS]);
    const session = await verifyOtp(deps, 'someone@example.com', '123456');

    expect(calls.map((c) => c.url)).toEqual([
      'https://backend.test/api/v1/auth/otp/verify',
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test-key',
    ]);
    expect(JSON.parse(calls[1].body)).toEqual({ token: 'custom-abc', returnSecureToken: true });
    expect(session.idToken).toBe('id-1');
    expect(session.identifier).toBe('someone@example.com');
    expect(session.expiresAt).toBe(1_000_000 + 3_600_000);
  });

  it('shows the backend\'s own sentence rather than a generic failure', async () => {
    const { deps } = stub([
      { status: 429, body: { detail: 'Please wait before requesting another code.' } },
    ]);
    await expect(sendOtp(deps, 'someone@example.com')).rejects.toThrow(
      'Please wait before requesting another code.',
    );
  });

  it('refuses a wrong code loudly, naming what the backend said', async () => {
    const { deps } = stub([{ status: 400, body: { detail: 'Incorrect code.' } }]);
    await expect(verifyOtp(deps, 'someone@example.com', '000000')).rejects.toThrow(
      'Incorrect code.',
    );
  });

  it('refuses a verify that came back with no token instead of half-signing-in', async () => {
    const { deps } = stub([{ body: { linked: false } }]);
    await expect(verifyOtp(deps, 'someone@example.com', '123456')).rejects.toThrow(/without a token/);
  });

  it('refuses a Firebase answer with no ID token', async () => {
    const { deps } = stub([{ body: { token: 'custom-abc' } }, { body: { refreshToken: 'r' } }]);
    await expect(verifyOtp(deps, 'someone@example.com', '123456')).rejects.toThrow(/no ID token/);
  });
});

describe('the session is refreshed before it ends, not after a 401', () => {
  const session: Session = {
    idToken: 'id-1',
    refreshToken: 'refresh-1',
    expiresAt: 1_000_000 + 3_600_000,
    identifier: 'someone@example.com',
  };

  it('does not refresh a session with time left', async () => {
    expect(needsRefresh(session, 1_000_000)).toBe(false);
    const { deps, calls } = stub([TOKENS]);
    const saved: Session[] = [];
    const token = await tokenFor(deps, session, async (s) => void saved.push(s));
    expect(token).toBe('id-1');
    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('refreshes inside the five-minute margin', async () => {
    expect(needsRefresh(session, session.expiresAt - 60_000)).toBe(true);
  });

  it('exchanges the refresh token on the secure-token endpoint', async () => {
    const { deps, calls } = stub([
      { body: { id_token: 'id-2', refresh_token: 'refresh-2', expires_in: '3600' } },
    ]);
    const fresh = await refreshSession(deps, session);
    expect(calls[0].url).toBe('https://securetoken.googleapis.com/v1/token?key=test-key');
    expect(calls[0].body).toBe('grant_type=refresh_token&refresh_token=refresh-1');
    expect(fresh.idToken).toBe('id-2');
    expect(fresh.refreshToken).toBe('refresh-2');
  });

  it('guesses SHORT when a lifetime is unreadable', async () => {
    const { deps } = stub([{ body: { id_token: 'id-2', refresh_token: 'r', expires_in: 'soon' } }]);
    const fresh = await refreshSession(deps, session);
    // five minutes, not an hour: the worst case is one extra refresh rather
    // than a call that fails at an unpredictable moment
    expect(fresh.expiresAt).toBe(1_000_000 + 300_000);
  });

  it('says "not signed in" rather than sending an unauthenticated call', async () => {
    const { deps, calls } = stub([TOKENS]);
    expect(await tokenFor(deps, null, async () => {})).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('the module is a pure client of an injected fetch', () => {
  const src = readFileSync(join(__dirname, '..', 'auth.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('never reaches for a global fetch or for chrome.*', () => {
    // Every request goes through `deps.fetch`, which is what lets the test
    // above be a test rather than a network call.
    expect(src).not.toMatch(/(^|[^.])\bfetch\(/m);
    expect(src).not.toMatch(/globalThis\.fetch\(/);
    expect(src).not.toMatch(/\bchrome\./);
  });

  it('holds no token in module state', () => {
    expect(src).not.toMatch(/^let\s+\w*[Ss]ession/m);
    expect(src).not.toMatch(/localStorage/);
  });
});
