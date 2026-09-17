// The on-open location step (docs/49 AMB-25, owner 2026-09-17).
//
// On every app open (Home focus + foreground): ask the phone if the binary
// carries `expo-location` and the person has granted it; otherwise fall
// back to the typed city, at most once a session and once a week. The
// decision itself is `lib/location-view.decide` (pure, tested); this hook
// only gathers the inputs and carries out the action.
//
// `expo-location` is loaded with a guarded require: the binary that shipped
// before 2026-09-17 does not carry the native module, and an OTA on it must
// not crash on import — it takes the city path instead.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { track } from '@/lib/analytics';
import { decide, type Decision, type KnownPlace, type Permission } from '@/lib/location-view';
import { fetchSelf, setCurrentPlace } from '@/lib/people';

type LocationModule = {
  getForegroundPermissionsAsync: () => Promise<{ status: string }>;
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{ coords: { latitude: number; longitude: number } }>;
  Accuracy: { Low: number };
};

function loadLocation(): LocationModule | null {
  // Probe the NATIVE module first (`requireOptionalNativeModule` returns
  // null instead of throwing): a binary built before 2026-09-17 has no
  // ExpoLocation, and requiring the JS package on it throws at module
  // evaluation — Metro reports that as an uncaught error even inside a
  // try, and a release build would crash at launch. Measured on the sim.
  try {
    if (!requireOptionalNativeModule('ExpoLocation')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-location');
    return mod && typeof mod.getForegroundPermissionsAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

async function permissionAndFix(): Promise<{ permission: Permission; fix: { latitude: number; longitude: number } | null }> {
  const loc = loadLocation();
  if (!loc) return { permission: 'unavailable', fix: null };
  try {
    let { status } = await loc.getForegroundPermissionsAsync();
    if (status === 'undetermined') {
      track('location_permission_ask');
      status = (await loc.requestForegroundPermissionsAsync()).status;
      track('location_permission_result', { status });
    }
    if (status !== 'granted') return { permission: 'denied', fix: null };
    const pos = await loc.getCurrentPositionAsync({ accuracy: loc.Accuracy.Low });
    return { permission: 'granted', fix: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } };
  } catch (e: unknown) {
    console.warn('[location]', String((e as Error)?.message ?? e));
    return { permission: 'denied', fix: null };
  }
}

export function useCurrentPlace(enabled: boolean, onPlaceChanged: () => void) {
  const [askCity, setAskCity] = useState<null | 'no_place' | 'stale_place'>(null);
  const askedThisSession = useRef(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!enabled || running.current) return;
    running.current = true;
    try {
      const self = await fetchSelf().catch(() => null);
      if (!self || self.state !== 'established' || !self.person) return;
      const place = (self.person.current_place ?? null) as KnownPlace | null;
      const { permission, fix } = await permissionAndFix();
      const d: Decision = decide({
        permission, place, fix,
        nowIso: new Date().toISOString(),
        askedThisSession: askedThisSession.current,
      });
      track('location_decision', { action: d.action, permission });
      if (d.action === 'send_device') {
        await setCurrentPlace({ source: 'device', latitude: d.latitude, longitude: d.longitude });
        onPlaceChanged();
      } else if (d.action === 'ask_city') {
        askedThisSession.current = true;
        setAskCity(d.reason);
      }
    } catch (e: unknown) {
      console.warn('[location]', String((e as Error)?.message ?? e));
    } finally {
      running.current = false;
    }
  }, [enabled, onPlaceChanged]);

  useEffect(() => {
    void run();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void run(); });
    return () => sub.remove();
  }, [run]);

  return { askCity, closeCity: () => setAskCity(null) };
}
