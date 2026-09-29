// The gate for a PUSHED reading screen (birth details, palm, muhurta) —
// owner ruling 2026-09-12, reshaped for bug 29c19678.
//
// These screens used to gate with `router.replace('/sign-in')`. `replace`
// UNMOUNTS the screen (a typed form, a pending engine ask), and the sign-in
// screen returns with `router.back()`, which cannot come back to a replaced
// screen — so signing in landed the user somewhere else with nothing. And
// none of their sends checked the gate, so in the unresolved-auth window a
// reading turn could reach the engine as the anonymous user (`getToken`
// signs in anonymously on first use).
//
// Now: the gate is PUSHED, once per visit, so signing in comes straight
// back to the same screen, still mounted. Back from the gate without signing
// in leaves `gate === 'card'` — the screen shows the gate card; it does not
// re-push (the loop `replace` was avoiding). Every send on these screens
// returns early unless `mayRead`. The decision itself is `gateStep`'s
// (`lib/gated-draft.ts`), tested at the root; this hook only holds the one
// piece of state a pure function cannot — "already prompted on this visit".

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { gateStep, type GateStep } from './gated-draft';
import { useReadingBlocked } from './use-account';

export interface ReadingGate {
  gate: GateStep;
  /** only `proceed` may ask the engine for anything */
  mayRead: boolean;
  blocked: boolean;
  resolved: boolean;
  uid: string | null;
  /** send the user to the gate on purpose (a parked Continue) */
  openGate: () => void;
}

export function useReadingGate(): ReadingGate {
  const { blocked, resolved, uid } = useReadingBlocked();
  const [prompted, setPrompted] = useState(false);
  const gate = gateStep({ resolved, blocked, prompted });
  useEffect(() => {
    if (gate !== 'prompt') return;
    setPrompted(true);
    router.push('/sign-in');
  }, [gate]);
  const openGate = useCallback(() => {
    setPrompted(true);
    router.push('/sign-in');
  }, []);
  return { gate, mayRead: gate === 'proceed', blocked, resolved, uid, openGate };
}
