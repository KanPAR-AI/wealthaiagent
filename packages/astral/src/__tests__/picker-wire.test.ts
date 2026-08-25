/**
 * The picker's wire format, both directions (docs/49 ASTRAL-96).
 *
 * These four functions are the seam between a native OS picker, which speaks
 * `Date`, and the carrier, which speaks ISO `YYYY-MM-DD` and 24-hour `HH:MM`.
 * They live in `format.ts` rather than in the React Native adapter for
 * exactly this reason: the adapter cannot be imported by the root jest
 * project (no RN preset, F21 #4), so logic that lives there is logic no CI
 * test can see — and the bug this seam invites is invisible in the timezone
 * most of us develop in.
 *
 * The bug: `new Date('1990-08-02')` parses as UTC midnight, which is the
 * EVENING OF 1 AUGUST anywhere west of Greenwich. A birthday round-tripped
 * through the obvious one-liner comes back a day early for every user in the
 * Americas, and a chart cast on the 1st looks exactly as convincing as one
 * cast on the 2nd.
 */

import {
  DEFAULT_BIRTH_YEARS_AGO,
  defaultBirthYear,
  hhmmOfLocalDate,
  isoOfLocalDate,
  localDateOfHhmm,
  localDateOfIso,
} from '../format';

describe('ISO ⇄ Date, in local time', () => {
  it('round-trips a date without moving it', () => {
    for (const iso of ['1990-08-02', '1900-01-01', '2026-12-31', '1989-04-03']) {
      expect(isoOfLocalDate(localDateOfIso(iso)!)).toBe(iso);
    }
  });

  it('anchors at LOCAL midday, so no real UTC offset can shift the day', () => {
    const d = localDateOfIso('1990-08-02')!;
    expect(d.getHours()).toBe(12);
    expect(d.getFullYear()).toBe(1990);
    expect(d.getMonth()).toBe(7); // August, zero-based
    expect(d.getDate()).toBe(2);
  });

  it('is NOT `new Date(iso)` — the parse that loses a day west of Greenwich', () => {
    // The property, stated so a "simplification" back to the one-liner fails
    // here rather than on somebody's birthday. UTC midnight and local midday
    // are the same instant only at UTC+12.
    const ours = localDateOfIso('1990-08-02')!;
    const naive = new Date('1990-08-02');
    expect(isoOfLocalDate(ours)).toBe('1990-08-02');
    if (new Date().getTimezoneOffset() > 0) {
      // running west of Greenwich: the naive parse is a day early
      expect(isoOfLocalDate(naive)).toBe('1990-08-01');
    }
  });

  it('pads a year, month and day rather than emitting a short form', () => {
    expect(isoOfLocalDate(new Date(1989, 3, 3, 12))).toBe('1989-04-03');
  });

  it('refuses what it cannot vouch for instead of inventing a date', () => {
    for (const bad of [null, undefined, '', '02/08/1990', '1990-8-2', 'yesterday']) {
      expect(localDateOfIso(bad)).toBeNull();
    }
  });
});

describe('HH:MM ⇄ Date', () => {
  it('round-trips every minute of the day', () => {
    for (const hh of [0, 1, 9, 12, 13, 23]) {
      for (const mm of [0, 5, 45, 59]) {
        const s = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        expect(hhmmOfLocalDate(localDateOfHhmm(s)!)).toBe(s);
      }
    }
  });

  it('keeps 23:45 as 23:45 — F12\'s regression, at the picker seam', () => {
    // F12 was a precise 23:45 being described as approximate. The same value
    // must also survive the trip through the OS picker without being rounded
    // or re-read as 11:45.
    expect(hhmmOfLocalDate(localDateOfHhmm('23:45')!)).toBe('23:45');
  });

  it('refuses an impossible clock rather than normalising it', () => {
    for (const bad of [null, undefined, '', '25:71', '24:00', '11:60', '11.45']) {
      expect(localDateOfHhmm(bad)).toBeNull();
    }
  });
});

describe('where a birth-date picker opens', () => {
  const today = new Date(2026, 7, 25);

  it('opens a plausible lifetime ago, never on the current year', () => {
    expect(defaultBirthYear(2026, today)).toBe(2026 - DEFAULT_BIRTH_YEARS_AGO);
    expect(defaultBirthYear(2026, today)).not.toBe(2026);
  });

  it('never offers a year past the bound it was given', () => {
    expect(defaultBirthYear(1990, today)).toBe(1990);
  });

  it('is a POSITION, not a value — it writes nothing', () => {
    // Stated as a type fact because it is the property that matters: the
    // function returns a number for a wheel to scroll to. Committing it would
    // make an untouched form look answered, which is how a stranger's
    // birthday becomes a chart.
    expect(typeof defaultBirthYear(2026, today)).toBe('number');
  });
});
