// The reveal control, as a screen uses it (owner ruling, 2026-09-19).
//
// This hook DECIDES NOTHING. Every rule it applies comes from
// `birth-privacy-view.ts` (pure, tested at the workspace root) and every fact
// it consults comes from `birth-privacy.ts` (the native probe). What is here
// is the wiring a pure module cannot own: a mount-time probe, the three
// re-lock triggers, and one timer.
//
// ── the three re-locks, and why each is separate ──────────────────────────
//
//   background   the iOS app switcher photographs the screen as the app
//                leaves. Re-locking on `change` → not-active means that
//                photograph is taken with the values already masked; a
//                re-lock on the way BACK would be a snapshot too late.
//   blur         leaving the screen ends the reveal. Otherwise a user who
//                unlocked Profile and walked to the chart would find it open
//                there too, having authorised one surface and got two.
//   60 seconds   an unlock nobody closed closes itself.
//
// The timer is a courtesy, not the guarantee: `revealed` is recomputed from
// the clock on every read (`isRevealed`), so a suspended timer cannot leave
// a stale reveal on screen.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  msUntilRelock,
  revealFailure,
  revealGate,
  type RevealGate,
} from './birth-privacy-view';
import {
  enrolledLevel,
  installBirthPrivacyRelock,
  onScreenBlur,
  promptForReveal,
  revealSupported,
  useBirthPrivacy,
} from './birth-privacy';
import { CAPABILITIES } from './capabilities';

export interface BirthReveal {
  /** may the exact values be drawn right now */
  revealed: boolean;
  /** what the screen draws where the control would go */
  gate: RevealGate;
  /** ask the phone; on success the values appear for 60 seconds */
  show: () => void;
  /** take them back immediately */
  hide: () => void;
  /** the last refusal, said out loud — cleared by the next attempt */
  notice: string | null;
  /** true while the OS sheet is up, so the control does not double-fire */
  busy: boolean;
}

export function useBirthReveal(): BirthReveal {
  const state = useBirthPrivacy((s) => s.state);
  const dispatch = useBirthPrivacy((s) => s.dispatch);
  const [level, setLevel] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supported = revealSupported();

  // The probe. Its answer can change while the app is installed (a user can
  // set a passcode in Settings and come back), so it is re-asked whenever
  // the app returns to the foreground rather than once per install.
  useEffect(() => {
    let alive = true;
    const probe = () => {
      if (!supported) return;
      void enrolledLevel().then((l) => { if (alive) setLevel(l); });
    };
    probe();
    // ONE subscription, and the DECISION is not in this file: the re-lock on
    // the way out (so the switcher snapshot is already masked) and the
    // re-probe on the way back are both `installBirthPrivacyRelock`'s, which
    // a test drives with a fake AppState. It used to be an `if` inside this
    // closure, and Role-3 measured that flipping that `if` to its opposite —
    // re-locking on the way BACK, one frame too late — left the whole suite
    // green.
    const off = installBirthPrivacyRelock(AppState, probe);
    return () => { alive = false; off(); };
  }, [supported, dispatch]);

  // Leaving the screen re-locks. `useFocusEffect` and not `useEffect`: a
  // pushed screen does not unmount the one under it.
  useFocusEffect(
    useCallback(() => () => {
      onScreenBlur();
      setNotice(null);
    }, []),
  );

  // …and the minute.
  const revealed = useBirthPrivacy((s) => s.revealed());
  useEffect(() => {
    if (state.unlockedAt === null) return;
    const ms = msUntilRelock(state, Date.now());
    const t = setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), ms + 50);
    return () => clearTimeout(t);
  }, [state, dispatch]);

  const gate = revealGate({
    capability: CAPABILITIES.birthDetailsReveal,
    moduleAvailable: supported,
    enrolledLevel: level,
  });

  const show = useCallback(() => {
    if (busy) return;
    setNotice(null);
    setBusy(true);
    void promptForReveal()
      .then((result) => {
        if (result.ok) dispatch({ type: 'unlocked', at: Date.now() });
        else setNotice(revealFailure(result.error));
      })
      .finally(() => setBusy(false));
  }, [busy, dispatch]);

  const hide = useCallback(() => {
    setNotice(null);
    dispatch({ type: 'hide' });
  }, [dispatch]);

  return { revealed, gate, show, hide, notice, busy };
}
