/**
 * `useBirthReveal` — the hook the screens actually call, driven for real.
 *
 * Role-3's other blocking gap: the probe, the gate, show/hide and the timer
 * had no test at all. This runs the REAL hook under React DOM, with
 * `react-native`'s `AppState`, `expo-router`'s `useFocusEffect` and the
 * native authenticator replaced by doubles. The hook renders no components —
 * it is state and effects — so React DOM is enough, and the alternative (a
 * react-native preset in the root jest project) would be a new toolchain for
 * one file.
 */

const probe = jest.fn();
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: probe }), { virtual: true });

const native = {
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
};
jest.mock('expo-local-authentication', () => native, { virtual: true });

/** the fake AppState, and the handler the hook registers on it */
const listeners: Array<(state: string) => void> = [];
const removals = { count: 0 };
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_type: string, h: (s: string) => void) => {
      listeners.push(h);
      return { remove: () => { removals.count += 1; } };
    },
  },
}), { virtual: true });

/** the focus effect, with its CLEANUP captured so blur can be fired */
const blurs: Array<() => void> = [];
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => (() => void) | void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(() => {
      const cleanup = effect();
      if (cleanup) blurs.push(cleanup);
      return undefined;
    }, [effect]);
  },
}), { virtual: true });

import { act, renderHook } from '@testing-library/react';

import { useBirthPrivacy } from '../birth-privacy';
import { LOCKED, NEEDS_NEW_BUILD, NO_SCREEN_LOCK, REVEAL_WINDOW_MS } from '../birth-privacy-view';
import { useBirthReveal } from '../use-birth-reveal';

const flush = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  probe.mockReset();
  native.getEnrolledLevelAsync.mockReset();
  native.authenticateAsync.mockReset();
  listeners.length = 0;
  blurs.length = 0;
  removals.count = 0;
  useBirthPrivacy.setState({ state: LOCKED });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the gate, on a binary without the authenticator (build 13)', () => {
  beforeEach(() => probe.mockReturnValue(null));

  it('removes the control and says the reveal needs the next version', async () => {
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    expect(result.current.revealed).toBe(false);
    expect(result.current.gate).toEqual({
      kind: 'absent', reason: 'no_native_module', sentence: NEEDS_NEW_BUILD,
    });
    expect(native.getEnrolledLevelAsync).not.toHaveBeenCalled();
  });
});

describe('the gate, on a binary WITH it', () => {
  beforeEach(() => probe.mockReturnValue({}));

  it('is `probing` until the phone answers, then available', async () => {
    let resolve: (v: number) => void = () => undefined;
    native.getEnrolledLevelAsync.mockReturnValue(new Promise<number>((r) => { resolve = r; }));
    const { result } = renderHook(() => useBirthReveal());
    expect(result.current.gate.kind).toBe('probing');
    await act(async () => { resolve(3); await Promise.resolve(); });
    expect(result.current.gate).toEqual({ kind: 'available' });
  });

  it('refuses, with the sentence, when no screen lock is enrolled', async () => {
    native.getEnrolledLevelAsync.mockResolvedValue(0);
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    expect(result.current.gate).toEqual({
      kind: 'absent', reason: 'no_screen_lock', sentence: NO_SCREEN_LOCK,
    });
  });

  it('re-probes when the app comes back — a passcode can be set meanwhile', async () => {
    native.getEnrolledLevelAsync.mockResolvedValue(0);
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    expect(result.current.gate.kind).toBe('absent');

    native.getEnrolledLevelAsync.mockResolvedValue(1);
    await act(async () => { listeners.forEach((h) => h('active')); await Promise.resolve(); });
    expect(result.current.gate).toEqual({ kind: 'available' });
  });
});

describe('show, hide, and the three re-locks', () => {
  beforeEach(() => {
    probe.mockReturnValue({});
    native.getEnrolledLevelAsync.mockResolvedValue(3);
  });

  it('a successful device check reveals; Hide takes it back', async () => {
    native.authenticateAsync.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useBirthReveal());
    await flush();

    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);
    expect(native.authenticateAsync).toHaveBeenCalledTimes(1);

    act(() => result.current.hide());
    expect(result.current.revealed).toBe(false);
  });

  it('a refusal reveals NOTHING and says why', async () => {
    native.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(false);
    expect(result.current.notice).toBe('Left hidden.');
  });

  it('re-locks when the app leaves — and NOT when it comes back', async () => {
    native.authenticateAsync.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);

    act(() => { listeners.forEach((h) => h('inactive')); });
    expect(result.current.revealed).toBe(false);

    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);
    await act(async () => { listeners.forEach((h) => h('active')); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);
  });

  it('re-locks on leaving the screen', async () => {
    native.authenticateAsync.mockResolvedValue({ success: true });
    const { result, unmount } = renderHook(() => useBirthReveal());
    await flush();
    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);

    // the focus effect's CLEANUP is what a blur runs
    act(() => { blurs.forEach((f) => f()); });
    expect(useBirthPrivacy.getState().revealed()).toBe(false);
    unmount();
  });

  it('re-locks by itself after the window, with no event at all', async () => {
    native.authenticateAsync.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    await act(async () => { result.current.show(); await Promise.resolve(); });
    expect(result.current.revealed).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(REVEAL_WINDOW_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.revealed).toBe(false);
  });

  it('does not fire a second prompt while one is up', async () => {
    let settle: (v: { success: boolean }) => void = () => undefined;
    native.authenticateAsync.mockReturnValue(new Promise((r) => { settle = r; }));
    const { result } = renderHook(() => useBirthReveal());
    await flush();
    act(() => { result.current.show(); });
    expect(result.current.busy).toBe(true);
    act(() => { result.current.show(); });
    expect(native.authenticateAsync).toHaveBeenCalledTimes(1);
    await act(async () => { settle({ success: true }); await Promise.resolve(); });
  });
});
