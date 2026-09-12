// Owner ruling 2026-09-12: sign-in is mandatory for any reading. The one
// rule, pinned — including the auth-race edge.

import { GATE_BODY, GATE_TITLE, readingBlocked } from '../auth-gate';

describe('readingBlocked', () => {
  const acct = (anonymous: boolean) =>
    ({ uid: 'u1', anonymous, displayName: null, email: null,
       provider: anonymous ? null : 'google.com' }) as never;

  it('a guest is blocked', () => {
    expect(readingBlocked(acct(true))).toBe(true);
  });

  it('a signed-in account reads freely', () => {
    expect(readingBlocked(acct(false))).toBe(false);
  });

  it('the auth race blocks too — a gate that fails open is not a gate', () => {
    expect(readingBlocked(null)).toBe(true);
  });

  it('the copy says why, without shouting', () => {
    expect(GATE_TITLE).toMatch(/sign in/i);
    expect(GATE_BODY).toMatch(/record/i);
    expect(GATE_BODY.toLowerCase()).not.toContain('error');
  });
});
