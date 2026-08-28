/**
 * The Android date/time ask (owner bug, 2026-08-28): Android rendered crude
 * tap-list columns because the only OS-control branch was iOS-gated, and the
 * Google button was hidden because availability keyed on the iOS client id.
 *
 * Source-level pins, deliberately: rn-primitives renders native views that
 * this jest environment cannot mount, so these tests pin the DECISIONS in
 * the source the way structural.test.ts pins renderer wiring. Each one
 * failed against the pre-fix file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'rn-primitives.tsx'), 'utf8');

describe('the Android Material picker branch', () => {
  it('resolves the Jetpack Compose picker on android, lazily and loudly', () => {
    expect(SRC).toMatch(/jetpackDateTimePicker\(\): JetpackPicker \| null \{\s*\n\s*if \(Platform\.OS !== 'android'\) return null;/);
    // The loud-downgrade discipline: a binary without the module says so.
    expect(SRC).toMatch(/fallback wheels are rendering instead[\s\S]{0,400}NATIVE\s*\n?\s*\*?\s*rebuild/);
  });

  it('both dispatchers consult the Material branch before the fallback wheels', () => {
    const timeDispatch = SRC.match(/function TimeWheel\(props[\s\S]{0,400}?\n\}/)?.[0] ?? '';
    const dateDispatch = SRC.match(/function DateWheel\(props[\s\S]{0,400}?\n\}/)?.[0] ?? '';
    for (const d of [timeDispatch, dateDispatch]) {
      const jet = d.indexOf('jetpackDateTimePicker');
      const fall = d.indexOf('Fallback');
      expect(jet).toBeGreaterThan(-1);
      expect(fall).toBeGreaterThan(-1);
      expect(jet).toBeLessThan(fall);
    }
  });

  it('swallows the mount-time selection event so an empty ask cannot auto-fill', () => {
    // Compose fires onDateSelected on FIRST composition; un-guarded, the ask
    // would answer itself with a birth date the user never stated.
    const dateField = SRC.match(/function MaterialDateField[\s\S]*?\n\}/)?.[0] ?? '';
    const timeField = SRC.match(/function MaterialTimeField[\s\S]*?\n\}/)?.[0] ?? '';
    for (const f of [dateField, timeField]) {
      expect(f).toContain('touched');
      expect(f).toMatch(/if \(!touched\.current && !value && \w+ === seeded/);
    }
  });

  it('reads the date in UTC and the time in local — the two native contracts', () => {
    // Material 3 reports the picked DAY as UTC-midnight millis; the time
    // dial sets hour/minute on a default-locale calendar. Crossing the two
    // reads yesterday's date in negative-offset zones or a shifted time.
    const dateField = SRC.match(/function MaterialDateField[\s\S]*?\n\}/)?.[0] ?? '';
    const timeField = SRC.match(/function MaterialTimeField[\s\S]*?\n\}/)?.[0] ?? '';
    expect(dateField).toContain('getUTCFullYear');
    expect(dateField).not.toContain('getFullYear()');
    expect(timeField).toContain('getHours()');
    expect(timeField).not.toContain('getUTCHours');
  });

  it('the time field seeds noon, never midnight', () => {
    const timeField = SRC.match(/function MaterialTimeField[\s\S]*?\n\}/)?.[0] ?? '';
    expect(timeField).toContain("value ?? '12:00'");
  });
});

describe('the Google sign-in availability gate (both apps)', () => {
  const AUTH_ASTRO = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'apps', 'astro', 'src', 'lib', 'auth.ts'), 'utf8');
  const AUTH_MOBILE = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'apps', 'mobile', 'src', 'lib', 'auth.ts'), 'utf8');

  it.each([['astro', AUTH_ASTRO], ['mobile', AUTH_MOBILE]])(
    '%s: android availability keys on the web client id, not the iOS one',
    (_app, src) => {
      const fn = src.match(/function isGoogleSignInAvailable[\s\S]*?\n\}/)?.[0] ?? '';
      expect(fn).toMatch(/Platform\.OS === 'android'.*FIREBASE_WEB_CLIENT_ID/s);
    },
  );

  it.each([['astro', AUTH_ASTRO], ['mobile', AUTH_MOBILE]])(
    '%s: a stale Google-layer session is cleared before signIn, and a cancel is coded',
    (_app, src) => {
      const signOutAt = src.indexOf('GoogleSignin.signOut().catch');
      const signInAt = src.indexOf('GoogleSignin.signIn()');
      expect(signOutAt).toBeGreaterThan(-1);
      expect(signInAt).toBeGreaterThan(signOutAt);
      expect(src).toContain("result.type === 'cancelled'");
      expect(src).toMatch(/cancel\.code = 'cancelled'/);
    },
  );
});
