/**
 * `useReadingGate` and `useReadingBlocked` — the REAL hooks, driven under
 * React DOM with the account subscription and the router replaced by
 * doubles (the `use-birth-reveal.test.tsx` pattern: the hooks render no
 * components, so React DOM is enough).
 *
 * Bug 29c19678, E2 round 2: two mutations survived the pure tests because
 * they live in hooks — `uid` hard-wired to null (account-swap protection
 * silently off) and the "already prompted" flag never set (the gate
 * re-pushes, or the screen sits on a spinner forever). Both are pinned here.
 */

const push = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => push(...a) } }), { virtual: true });

type Account = { uid: string; anonymous: boolean; email: null; displayName: null; provider: string | null };
let emit: ((a: Account | null) => void) | null = null;
jest.mock('../auth', () => ({
  subscribeToAccount: (fn: (a: Account | null) => void) => {
    emit = fn;
    return () => { emit = null; };
  },
}));

import { act, renderHook } from '@testing-library/react';

import { useReadingBlocked } from '../use-account';
import { useReadingGate } from '../use-reading-gate';

const guest: Account = { uid: 'anon-arun', anonymous: true, email: null, displayName: null, provider: null };
const arun: Account = { uid: 'anon-arun', anonymous: false, email: null, displayName: null, provider: 'google.com' };
const kabir: Account = { uid: 'google-kabir', anonymous: false, email: null, displayName: null, provider: 'google.com' };

const say = (a: Account | null) => act(() => { emit?.(a); });

beforeEach(() => {
  push.mockReset();
  emit = null;
});

describe('useReadingBlocked carries the uid (surviving mutation A)', () => {
  it('reports the signed-in uid, not null', () => {
    const { result } = renderHook(() => useReadingBlocked());
    say(kabir);
    expect(result.current).toEqual({ blocked: false, resolved: true, uid: 'google-kabir' });
  });

  it('a guest is blocked and still carries its uid (the parked turn records it)', () => {
    const { result } = renderHook(() => useReadingBlocked());
    say(guest);
    expect(result.current).toEqual({ blocked: true, resolved: true, uid: 'anon-arun' });
  });

  it('before auth reports: unresolved, blocked, no uid', () => {
    const { result } = renderHook(() => useReadingBlocked());
    expect(result.current).toEqual({ blocked: true, resolved: false, uid: null });
  });
});

describe('useReadingGate — push once, come back to the card (surviving mutation C)', () => {
  it('unresolved: waits, pushes nothing', () => {
    const { result } = renderHook(() => useReadingGate());
    expect(result.current.gate).toBe('wait');
    expect(result.current.mayRead).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('a guest is pushed to the gate EXACTLY once, and the screen then shows the card', () => {
    const { result, rerender } = renderHook(() => useReadingGate());
    say(guest);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    // back from the gate without signing in: more renders, more emissions
    rerender();
    say(guest);
    rerender();
    expect(push).toHaveBeenCalledTimes(1);
    expect(result.current.gate).toBe('card');
    expect(result.current.mayRead).toBe(false);
  });

  it('a signed-in account proceeds and is never pushed', () => {
    const { result } = renderHook(() => useReadingGate());
    say(arun);
    expect(result.current.gate).toBe('proceed');
    expect(result.current.mayRead).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('a guest who signs in (same uid, linked) proceeds on the same mount', () => {
    const { result } = renderHook(() => useReadingGate());
    say(guest);
    say(arun);
    expect(result.current.gate).toBe('proceed');
    expect(result.current.uid).toBe('anon-arun');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('signed out while the screen is up: pushed once, then the card', () => {
    const { result } = renderHook(() => useReadingGate());
    say(arun);
    say(null);
    expect(push).toHaveBeenCalledTimes(1);
    expect(result.current.gate).toBe('card');
  });

  it('openGate pushes on purpose and marks the visit prompted', () => {
    const { result } = renderHook(() => useReadingGate());
    say(arun);
    act(() => { result.current.openGate(); });
    expect(push).toHaveBeenCalledTimes(1);
    // …so a sign-out now lands on the card, not a second automatic push
    say(null);
    expect(push).toHaveBeenCalledTimes(1);
    expect(result.current.gate).toBe('card');
  });
});
