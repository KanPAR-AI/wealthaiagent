// Drawn spans — the geometry a timeline bar is made of (docs/49
// ASTRAL-239/240).
//
// PURE, and deliberately CLOCK-FREE. Everything here turns two payload dates
// into a WIDTH, which is the same permission `geometry.ringDash` has in the
// shared package: a picture of a payload fact, never a new claim. What it may
// not do — and cannot, because it has no access to one — is read a clock. Which
// leg of a Sade Sati is current, and which mahadasha contains today, are
// decided by the ENGINE (`sub_phases[].current`, the timeline's `cursor`), for
// the reason `chart.py` states about `is_current`: a flag decided on the
// device disagrees with the reading the same phone shows a second later.
//
// ── why the date maths is written out rather than using `Date` ────────────
//
// `new Date('2025-03-30')` parses as UTC midnight and the app's own grep bans
// the constructor outright, because west of Greenwich it silently moves a day
// (`format.ts` has the same note about birthdays). A span's width does not
// need a calendar — it needs a count of days between two ISO dates — so this
// counts them with integer arithmetic and never constructs a date at all.

/** Days from 1970-01-01 for an ISO `YYYY-MM-DD`, or null if it is not one.
 *
 *  Howard Hinnant's civil-from-days, inverted: exact for every date this
 *  product can produce, with no timezone in it anywhere. */
export function daysFromCivil(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) return null;
  const y0 = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = y0 - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;                                   // [0, 399]
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5)
    + day - 1;                                                 // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Whole days between two ISO dates, or null when either is unreadable. */
export function daysBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const a = daysFromCivil(start);
  const b = daysFromCivil(end);
  if (a === null || b === null) return null;
  return b - a;
}

export interface Segment {
  /** where this segment starts inside the bar, 0..1 */
  offset: number;
  /** how much of the bar it occupies, 0..1 */
  fraction: number;
}

/**
 * One segment's place inside a span.
 *
 * Returns null when the dates cannot produce one — an unreadable date, a
 * zero-length span, a segment outside its own bar. A null is drawn as
 * NOTHING: a segment placed at a guessed offset is a picture of a fact
 * nobody computed, and on a seven-year bar it is years of wrong.
 */
export function segmentOf(
  spanStart: string | null | undefined,
  spanEnd: string | null | undefined,
  segStart: string | null | undefined,
  segEnd: string | null | undefined,
): Segment | null {
  const total = daysBetween(spanStart, spanEnd);
  const from = daysBetween(spanStart, segStart);
  const length = daysBetween(segStart, segEnd);
  if (total === null || from === null || length === null) return null;
  if (total <= 0 || length < 0 || from < 0 || from + length > total) return null;
  return { offset: from / total, fraction: length / total };
}
