/**
 * docs/49 AMB-25 — owner ruling 2026-09-17, verbatim: "Take the location on
 * app open, add that permission; if user denies ask to enter current city
 * selectable from suggested places; if location changes do appropriate; if
 * location is provided within last 7 days don't ask if location permission
 * was not given."
 */
import fs from 'fs';
import path from 'path';

import {
  DEVICE_REFRESH_HOURS, MANUAL_ASK_DAYS, MOVED_KM, decide, distanceKm, placeLine,
  type KnownPlace,
} from '../location-view';

const NOW = '2026-09-17T06:00:00Z';
const daysAgo = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();
const BLR = { latitude: 12.9716, longitude: 77.5946 };
const PADRAUNA = { latitude: 26.9, longitude: 83.98 };
const place = (over: Partial<KnownPlace>): KnownPlace => ({
  name: 'Bengaluru', latitude: BLR.latitude, longitude: BLR.longitude,
  timezone: 'Asia/Kolkata', source: 'device', set_at: daysAgo(0), ...over,
});

describe('the module is pure and reads no clock of its own', () => {
  it('has no Date.now / new Date in it — the app passes nowIso', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'location-view.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/new Date\(|Date\.now\(/);
    expect(code).not.toMatch(/from 'react|from 'expo/);
  });
});

describe('with the permission: the phone decides', () => {
  it('sends the fix when there is no place yet', () => {
    expect(decide({ permission: 'granted', place: null, fix: BLR, nowIso: NOW, askedThisSession: false }))
      .toEqual({ action: 'send_device', ...BLR });
  });
  it('sends the fix when the stored place was typed, not measured', () => {
    expect(decide({ permission: 'granted', place: place({ source: 'manual' }), fix: BLR, nowIso: NOW, askedThisSession: false }).action)
      .toBe('send_device');
  });
  it('stays quiet when the fix is where the record already is, and fresh', () => {
    expect(decide({ permission: 'granted', place: place({}), fix: BLR, nowIso: NOW, askedThisSession: false }).action)
      .toBe('quiet');
  });
  it('"if location changes do appropriate": a move of 25 km or more re-sends', () => {
    expect(distanceKm(BLR, PADRAUNA)).toBeGreaterThan(MOVED_KM);
    expect(decide({ permission: 'granted', place: place({}), fix: PADRAUNA, nowIso: NOW, askedThisSession: false }).action)
      .toBe('send_device');
    const nearby = { latitude: BLR.latitude + 0.05, longitude: BLR.longitude };
    expect(distanceKm(BLR, nearby)).toBeLessThan(MOVED_KM);
    expect(decide({ permission: 'granted', place: place({}), fix: nearby, nowIso: NOW, askedThisSession: false }).action)
      .toBe('quiet');
  });
  it('refreshes a day-old fix even without a move', () => {
    expect(decide({ permission: 'granted', place: place({ set_at: daysAgo(DEVICE_REFRESH_HOURS / 24 + 0.1) }), fix: BLR, nowIso: NOW, askedThisSession: false }).action)
      .toBe('send_device');
  });
  it('never asks for a city when the phone answered', () => {
    for (const p of [null, place({}), place({ set_at: daysAgo(30) })]) {
      expect(decide({ permission: 'granted', place: p, fix: BLR, nowIso: NOW, askedThisSession: false }).action)
        .not.toBe('ask_city');
    }
  });
});

describe('without the permission: the typed city, throttled', () => {
  it.each(['denied', 'undetermined', 'unavailable'] as const)('%s with no place asks for a city', (permission) => {
    expect(decide({ permission, place: null, fix: null, nowIso: NOW, askedThisSession: false }))
      .toEqual({ action: 'ask_city', reason: 'no_place' });
  });
  it('"within last 7 days don’t ask": a city set 6 days ago is not asked about', () => {
    expect(decide({ permission: 'denied', place: place({ source: 'manual', set_at: daysAgo(6) }), fix: null, nowIso: NOW, askedThisSession: false }).action)
      .toBe('quiet');
  });
  it('a city older than 7 days is asked about again, as a re-check', () => {
    expect(decide({ permission: 'denied', place: place({ source: 'manual', set_at: daysAgo(MANUAL_ASK_DAYS + 0.5) }), fix: null, nowIso: NOW, askedThisSession: false }))
      .toEqual({ action: 'ask_city', reason: 'stale_place' });
  });
  it('a stale DEVICE place with the permission since withdrawn is also re-checked', () => {
    expect(decide({ permission: 'denied', place: place({ source: 'device', set_at: daysAgo(9) }), fix: null, nowIso: NOW, askedThisSession: false }).action)
      .toBe('ask_city');
  });
  it('asks at most once a session', () => {
    expect(decide({ permission: 'denied', place: null, fix: null, nowIso: NOW, askedThisSession: true }).action)
      .toBe('quiet');
  });
  it('an unparseable timestamp counts as stale, never as fresh', () => {
    expect(decide({ permission: 'denied', place: place({ source: 'manual', set_at: 'garbage' }), fix: null, nowIso: NOW, askedThisSession: false }).action)
      .toBe('ask_city');
  });
});

describe('the line under the week strip', () => {
  it('names the card’s place and invites a change', () => {
    expect(placeLine(place({}), 'Bengaluru')).toEqual({
      text: 'scored for Bengaluru, from your Moon', cta: 'Not here? Set your city',
    });
    expect(placeLine(place({ source: 'manual' }), 'Bengaluru').cta).toBe('Change city');
  });
  it('says the birth place is in use when nothing is set', () => {
    const line = placeLine(null, 'Padrauna');
    expect(line.text).toMatch(/Padrauna/);
    expect(line.text).toMatch(/birth place/);
    expect(line.cta).toBe('Set where you are');
  });
});
