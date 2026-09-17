// Where the person IS, for the day's sky (docs/49 AMB-25 — owner ruling,
// 2026-09-17, verbatim: "Take the location on app open, add that permission;
// if user denies ask to enter current city selectable from suggested places;
// if location changes do appropriate; if location is provided within last 7
// days don't ask if location permission was not given").
//
// PURE: no React, no react-native, no expo. The hook in
// `components/use-current-place.ts` asks the phone and the server; this
// module decides. It computes distance between two device coordinates —
// that is geometry about the phone, not astrology about the sky: the card's
// place, its timezone and its name all come back from the engine.

export type Permission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface KnownPlace {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: 'device' | 'manual' | string;
  set_at: string;
}

export interface PolicyInput {
  permission: Permission;
  /** the place on the person's record, if any */
  place: KnownPlace | null;
  /** the phone's fix this open, if the permission is granted */
  fix: { latitude: number; longitude: number } | null;
  /** the app's own clock — ONLY for the 7-day / 24-hour arithmetic on
   *  timestamps the server stamped; never to decide what day it is */
  nowIso: string;
  /** the city sheet was already shown this session (dismissed) */
  askedThisSession: boolean;
}

export type Decision =
  | { action: 'send_device'; latitude: number; longitude: number }
  | { action: 'ask_city'; reason: 'no_place' | 'stale_place' }
  | { action: 'quiet'; reason: string };

/** A move worth re-casting the day for. Below this the sky is the same. */
export const MOVED_KM = 25;
/** With the permission, a fix older than this is refreshed on open. */
export const DEVICE_REFRESH_HOURS = 24;
/** Without the permission, a typed city is not asked about again for this
 *  long (the owner's "within last 7 days don't ask"). */
export const MANUAL_ASK_DAYS = 7;

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function hoursSince(iso: string, nowIso: string): number {
  const t = Date.parse(iso);
  const n = Date.parse(nowIso);
  if (Number.isNaN(t) || Number.isNaN(n)) return Number.POSITIVE_INFINITY;
  return (n - t) / 3_600_000;
}

/** The one decision, on app open. */
export function decide(input: PolicyInput): Decision {
  const { permission, place, fix, nowIso, askedThisSession } = input;

  if (permission === 'granted' && fix) {
    if (!place || place.source !== 'device') {
      return { action: 'send_device', latitude: fix.latitude, longitude: fix.longitude };
    }
    const moved = distanceKm(place, fix) >= MOVED_KM;
    const old = hoursSince(place.set_at, nowIso) >= DEVICE_REFRESH_HOURS;
    if (moved || old) {
      return { action: 'send_device', latitude: fix.latitude, longitude: fix.longitude };
    }
    return { action: 'quiet', reason: 'device place is current' };
  }

  // No permission (denied, undetermined-but-no-fix, or no module in this
  // binary): the typed city, asked at most once a week and once a session.
  if (askedThisSession) return { action: 'quiet', reason: 'asked this session' };
  if (!place) return { action: 'ask_city', reason: 'no_place' };
  if (hoursSince(place.set_at, nowIso) >= MANUAL_ASK_DAYS * 24) {
    return { action: 'ask_city', reason: 'stale_place' };
  }
  return { action: 'quiet', reason: 'place set within 7 days' };
}

/** The line under the week strip, and whether it invites a change. */
export function placeLine(place: KnownPlace | null, cardPlaceName: string | null): {
  text: string;
  cta: string;
} {
  if (place) {
    return {
      text: `scored for ${cardPlaceName || place.name}, from your Moon`,
      cta: place.source === 'device' ? 'Not here? Set your city' : 'Change city',
    };
  }
  return {
    text: `scored for ${cardPlaceName || 'your birth place'} — your birth place`,
    cta: 'Set where you are',
  };
}
