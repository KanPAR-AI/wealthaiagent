// The birth-details privacy lock — the NATIVE half, and the one shared
// in-memory unlock (owner ruling, 2026-09-19).
//
// Every RULE lives next door in `birth-privacy-view.ts`, which is pure and
// tested at the workspace root. What is here is the three things a rule
// cannot answer for itself: does THIS binary contain the authenticator, does
// this phone have a screen lock, and did the person in front of it just
// prove they are the owner.
//
// ── three rules this file obeys, and the measured reason for each ──────────
//
//  1. THE NATIVE MODULE IS PROBED BEFORE IT IS REQUIRED. `expo-local-
//     authentication` is NOT in TestFlight build 13, and every OTA reaches
//     build 13 too. A top-level `import` would run `requireNativeModule` at
//     module evaluation and take the whole bundle down on that binary — the
//     failure `use-current-place.ts` measured on the simulator and `push.ts`
//     is written around. `requireOptionalNativeModule('ExpoLocalAuthen-
//     tication')` is the honest question (the name is the module's own,
//     `ios/LocalAuthenticationModule.swift:6` / `build/ExpoLocalAuthen-
//     tication.js`), and only a truthy answer earns the lazy `require`.
//
//  2. NOTHING HERE IS PERSISTED. `useBirthPrivacy` holds a timestamp in
//     memory. There is no storage key in this file and there must not be
//     one: a persisted unlock is a lock that asks once, ever.
//
//  3. A FAILURE IS NAMED, NEVER SWALLOWED INTO A REVEAL. Every path that
//     cannot prove the owner is present leaves the state LOCKED and returns
//     the reason, which the screen says out loud. There is no `catch` here
//     whose result is "show it".

import { requireOptionalNativeModule } from 'expo-modules-core';
import { create } from 'zustand';

import {
  LOCKED,
  REVEAL_PROMPT,
  eventForAppState,
  eventForScreenBlur,
  isRevealed,
  reduce,
  type PrivacyEvent,
  type UnlockState,
} from './birth-privacy-view';

type LocalAuth = typeof import('expo-local-authentication');

/**
 * The package, or null on a binary that does not contain it.
 *
 * The probe result is not cached in a module constant: `requireOptional-
 * NativeModule` is a cheap registry lookup, and a cached null taken during
 * an early import would outlive the reason for it.
 */
function mod(): LocalAuth | null {
  try {
    if (!requireOptionalNativeModule('ExpoLocalAuthentication')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuth;
  } catch (e: unknown) {
    // Not a swallow: the ONLY thing this hides is "the module is absent",
    // and the consequence is that the reveal control disappears and the
    // details stay hidden. It is reported so a binary that HAS the module
    // and still fails here is visible rather than silently degraded.
    console.warn('[birth-privacy] local authentication unavailable:',
                 String((e as Error)?.message ?? e));
    return null;
  }
}

/** Does THIS binary contain the authenticator? (build 13: no; build 14: yes) */
export function revealSupported(): boolean {
  return mod() !== null;
}

/**
 * `getEnrolledLevelAsync()` — 0 (NONE) when this phone has no screen lock at
 * all, 1 (SECRET) for a passcode, higher for Face/Touch ID. `null` means the
 * question could not be asked, which the gate treats as "not yet", never as
 * "go ahead".
 */
export async function enrolledLevel(): Promise<number | null> {
  const m = mod();
  if (!m) return null;
  try {
    return await m.getEnrolledLevelAsync();
  } catch (e: unknown) {
    console.warn('[birth-privacy] enrolled level unreadable:',
                 String((e as Error)?.message ?? e));
    return null;
  }
}

export type RevealResult = { ok: true } | { ok: false; error: string | null };

/**
 * Ask the phone to prove its owner is present.
 *
 * `disableDeviceFallback` is left FALSE on purpose, which is the ruling
 * verbatim ("a screen lock or face lock"): the policy becomes
 * `deviceOwnerAuthentication`, so Face ID is offered first and the device
 * passcode is the fallback — a phone with no enrolled biometrics but a
 * passcode can still reveal. What it never becomes is "no check at all";
 * that case is refused one layer up by `revealGate`, before this is called.
 */
export async function promptForReveal(): Promise<RevealResult> {
  const m = mod();
  if (!m) return { ok: false, error: 'not_available' };
  try {
    const result = await m.authenticateAsync({
      promptMessage: REVEAL_PROMPT,
      disableDeviceFallback: false,
      cancelLabel: 'Keep hidden',
      fallbackLabel: 'Use passcode',
    });
    if (result.success) return { ok: true };
    return { ok: false, error: String(result.error ?? '') || null };
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

// ── the one unlock, shared by every surface, in memory ─────────────────────

interface BirthPrivacyStore {
  state: UnlockState;
  /** apply a lifecycle event (the pure reducer decides) */
  dispatch: (event: PrivacyEvent) => void;
  /** "may the values be drawn right now" — asked at paint time */
  revealed: (now?: number) => boolean;
}

/**
 * ONE store, deliberately.
 *
 * The Profile card, the chart screen's birth block and the kundli card in
 * chat are three surfaces of the same secret. Unlocking on Profile and then
 * opening the chart with it still hidden would train a user to unlock twice;
 * unlocking per screen with independent timers would mean the app has no
 * single answer to "is it showing right now" — which is the question the app
 * must answer correctly when it goes to the background.
 */
export const useBirthPrivacy = create<BirthPrivacyStore>((set, get) => ({
  state: LOCKED,
  dispatch: (event: PrivacyEvent) => set((s) => ({ state: reduce(s.state, event) })),
  revealed: (now?: number) => isRevealed(get().state, now ?? Date.now()),
}));

/** The non-hook read, for the places that are not React (the astral host). */
export function birthDetailsRevealed(): boolean {
  return useBirthPrivacy.getState().revealed();
}

/** The non-hook write, for the root layout's AppState subscription. */
export function relockBirthDetails(event: PrivacyEvent = { type: 'app_backgrounded' }): void {
  useBirthPrivacy.getState().dispatch(event);
}

// ── the re-lock WIRING, in a shape a test can drive ────────────────────────
//
// Role-3 measured four mutations that survived the whole suite: the root
// layout's `state !== 'active'` flipped to `false` and to `=== 'active'`,
// and each of the hook's two dispatches deleted. All four were invisible
// because the logic lived inside a `useEffect` in a `.tsx` the root jest
// project cannot import. It lives here instead, behind a seam that takes the
// subscriber rather than importing it — so a test passes a fake AppState and
// drives the real handler.

/** The shape of `AppState`, structurally — so nothing here imports RN. */
export interface AppStateLike {
  addEventListener: (
    type: 'change',
    handler: (state: string) => void,
  ) => { remove: () => void };
}

/** The handler itself. Exported so the decision can be driven directly. */
export function onAppStateChange(state: string): void {
  const event = eventForAppState(state);
  if (event) useBirthPrivacy.getState().dispatch(event);
}

/** …and leaving a screen. */
export function onScreenBlur(): void {
  useBirthPrivacy.getState().dispatch(eventForScreenBlur());
}

/**
 * Subscribe the re-lock to an AppState. Returns the unsubscribe.
 *
 * `onActive` is how the ONE subscription serves both jobs the app needs on
 * a return to the foreground — re-lock on the way out, re-probe the screen
 * lock on the way back — without two listeners racing each other.
 */
export function installBirthPrivacyRelock(
  appState: AppStateLike,
  onActive?: () => void,
): () => void {
  const sub = appState.addEventListener('change', (state: string) => {
    if (state === 'active') onActive?.();
    onAppStateChange(state);
  });
  return () => sub.remove();
}
