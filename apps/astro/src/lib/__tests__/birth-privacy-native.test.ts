/**
 * The native half, on the binary that does NOT have it (owner ruling,
 * 2026-09-19; TestFlight build 13).
 *
 * This is the case every OTA has to survive: `expo-local-authentication` is
 * not in build 13, the same JS bundle reaches it, and a module that reached
 * for the package at import time would take the app down on launch rather
 * than degrade. So the probe is mocked to `null` — which is exactly what
 * `requireOptionalNativeModule` returns on that binary — and the module is
 * required afterwards, in the test, so the import itself is under test.
 *
 * `virtual: true` on both mocks: this project is the WEB app's jest project
 * and neither Expo package is resolvable from it, which is also why the
 * screens themselves cannot be imported here (they pull `react-native`).
 * What stands in for that is `birth-privacy-structure.test.ts`, which proves
 * no screen imports the package at all, and the simulator walk on a dev
 * binary that likewise lacks the module.
 */

const probe = jest.fn();

jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: probe }), { virtual: true });

 
const nativeDouble = {
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
};
jest.mock('expo-local-authentication', () => nativeDouble, { virtual: true });

import {
  birthDetailsRevealed,
  enrolledLevel,
  promptForReveal,
  relockBirthDetails,
  revealSupported,
  useBirthPrivacy,
} from '../birth-privacy';
import { LOCKED, REVEAL_WINDOW_MS } from '../birth-privacy-view';

beforeEach(() => {
  probe.mockReset();
  nativeDouble.getEnrolledLevelAsync.mockReset();
  nativeDouble.authenticateAsync.mockReset();
  useBirthPrivacy.setState({ state: LOCKED });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('build 13 — the authenticator is not in this binary', () => {
  beforeEach(() => probe.mockReturnValue(null));

  it('the module loads, and says plainly that it cannot reveal', () => {
    // The import at the top of this file already ran with the probe
    // returning null. If a top-level `import 'expo-local-authentication'`
    // ever appeared, that import would have thrown before this line.
    expect(revealSupported()).toBe(false);
  });

  it('reports no enrolled level rather than guessing one', async () => {
    // null, never 0 and never a number: "I could not ask" is not "there is
    // no screen lock", and only one of them has a sentence for the user.
    await expect(enrolledLevel()).resolves.toBeNull();
  });

  it('refuses to reveal — it does not fall through to showing', async () => {
    await expect(promptForReveal()).resolves.toEqual({ ok: false, error: 'not_available' });
    expect(birthDetailsRevealed()).toBe(false);
  });

  it('never touches the package when the registry says it is absent', () => {
    revealSupported();
    expect(nativeDouble.getEnrolledLevelAsync).not.toHaveBeenCalled();
    expect(nativeDouble.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('build 14 — the authenticator is present', () => {
  beforeEach(() => probe.mockReturnValue({}));

  it('reports the enrolled level the phone gives', async () => {
    nativeDouble.getEnrolledLevelAsync.mockResolvedValue(0);
    await expect(enrolledLevel()).resolves.toBe(0);
    nativeDouble.getEnrolledLevelAsync.mockResolvedValue(3);
    await expect(enrolledLevel()).resolves.toBe(3);
  });

  it('a probe that throws reports null, not a level', async () => {
    nativeDouble.getEnrolledLevelAsync.mockRejectedValue(new Error('boom'));
    await expect(enrolledLevel()).resolves.toBeNull();
  });

  it('prompts with the DEVICE FALLBACK allowed — passcode counts', async () => {
    nativeDouble.authenticateAsync.mockResolvedValue({ success: true });
    await expect(promptForReveal()).resolves.toEqual({ ok: true });
    const options = nativeDouble.authenticateAsync.mock.calls[0][0];
    // The ruling is "a screen lock OR face lock": `disableDeviceFallback`
    // false is what makes the policy `deviceOwnerAuthentication`, so a phone
    // with a passcode and no biometrics can still reveal.
    expect(options.disableDeviceFallback).toBe(false);
    expect(String(options.promptMessage)).toMatch(/birth details/i);
  });

  it('carries the refusal REASON back rather than a boolean', async () => {
    nativeDouble.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(promptForReveal()).resolves.toEqual({ ok: false, error: 'user_cancel' });
  });

  it('a throwing prompt is a refusal, never a reveal', async () => {
    nativeDouble.authenticateAsync.mockRejectedValue(new Error('LAContext exploded'));
    const result = await promptForReveal();
    expect(result.ok).toBe(false);
    expect(birthDetailsRevealed()).toBe(false);
  });
});

describe('the shared unlock', () => {
  it('starts locked and is not written anywhere', () => {
    expect(birthDetailsRevealed()).toBe(false);
    expect(useBirthPrivacy.getState().state).toEqual(LOCKED);
  });

  it('opens on an unlock event and closes on background', () => {
    const now = Date.now();
    useBirthPrivacy.getState().dispatch({ type: 'unlocked', at: now });
    expect(birthDetailsRevealed()).toBe(true);
    relockBirthDetails();
    expect(birthDetailsRevealed()).toBe(false);
  });

  it('closes by itself after the window, with no event at all', () => {
    useBirthPrivacy.getState().dispatch({
      type: 'unlocked', at: Date.now() - REVEAL_WINDOW_MS - 1,
    });
    // No tick fired. The read is recomputed from the clock, so a suspended
    // timer cannot leave a stale reveal on screen.
    expect(birthDetailsRevealed()).toBe(false);
  });
});
