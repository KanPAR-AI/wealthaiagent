/**
 * The DECLARED formatting helpers (docs/49 ASTRAL-19).
 *
 * ASTRAL-19 forbids a renderer from computing, averaging, rounding into a new
 * unit, or inferring a score, band, orb or sign: "every displayed number is
 * present verbatim in the payload. Formatting (degree -> 23°14′) is permitted;
 * arithmetic that creates a new claim is not."
 *
 * This module is the whole of the permitted set. It is the ONLY place in the
 * package where a payload number is touched at all, which is what makes the
 * structural test in `__tests__/no-derivation.test.ts` checkable: that test
 * greps every other renderer/view module for arithmetic operators and fails if
 * one appears. If you need a new number on screen, the answer is almost always
 * "ask the backend to put it in the payload", not "add a helper here".
 *
 * The line each helper below must not cross: it may change the NOTATION of a
 * quantity, never the quantity. 85.25° and 85°15′ are the same fact written
 * two ways. 85.25° -> "25°15′ of Gemini" is a different fact (see the note on
 * `formatDegrees`) and is not done here.
 */

/**
 * A payload degree as degrees-and-arcminutes.
 *
 *   85.25  ->  "85°15′"
 *
 * IMPORTANT: `degree` on a planet, `degree` on a house cusp and
 * `ascendant_degree` are all ABSOLUTE ecliptic longitudes in 0..360
 * (`natal.py` builds them from kerykeion's `abs_pos`), NOT degrees within the
 * sign. The Moon at "Gemini, degree 73.42" is 73.42° of the zodiac.
 *
 * This helper only re-notates whatever it is given; it does NOT know which of
 * the two it received. Callers rendering a degree beside a sign name must pass
 * `sign_degree` / `ascendant_sign_degree`, never `degree` — "Gemini 73°25′" is
 * impossible, since a sign spans 30°.
 *
 * That was filed as A6#13 when this package was written, because the
 * sign-relative degree was not in the payload and deriving it here would have
 * needed a subtraction against a sign boundary — exactly the "arithmetic that
 * creates a new claim" ASTRAL-19 bans. The engine now supplies it verbatim
 * (natal_chart v4), so the renderer shows it rather than computing it, and a
 * pre-v4 chart with a null `sign_degree` shows no degree at all.
 */
export function formatDegrees(value: unknown): string | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let whole = Math.floor(abs);
  // The fractional part re-expressed in arcminutes. Same quantity, base 60.
  let minutes = Math.round((abs - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${sign}${whole}°${String(minutes).padStart(2, '0')}′`;
}

/**
 * A koota/guna point value as it should read on screen.
 *
 * The engine emits floats (`21.5`, `0.0`, `8.0`) because half-points are real
 * in Ashtakoota. `0.0` must read as "0" and `21.5` as "21.5" — this drops a
 * trailing ".0" and does nothing else. It is the TS equivalent of the `:g`
 * the backend already uses on the same values in `graph.py`.
 */
export function formatPoints(value: unknown): string | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  // `String` already drops a trailing ".0" for whole floats (0.0 -> "0",
  // 8.0 -> "8") and keeps a real half point (21.5 -> "21.5").
  return String(n);
}

/**
 * "21.5 / 36" — two payload values placed side by side.
 *
 * Deliberately a concatenation and never a division. `points / max` is how a
 * percentage gets invented, and INV-5 / ASTRAL-16 ban that outright.
 */
export function formatFraction(points: unknown, max: unknown): string | null {
  const p = formatPoints(points);
  const m = formatPoints(max);
  if (p === null || m === null) return null;
  return `${p} / ${m}`;
}

/**
 * A muhurta window score, verbatim.
 *
 * The payload carries 0..1 floats (`0.88`). It is rendered AS `0.88`, never as
 * "88%": multiplying by 100 is "rounding into a new unit" under ASTRAL-19, and
 * a percentage against an interpretive construct is the exact shape INV-5
 * exists to keep off the screen.
 */
export function formatScore(value: unknown): string | null {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  return String(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Split an ISO-8601 instant into its already-present parts.
 *
 * Parsed by string, NOT by `new Date(...)`, on purpose. The backend emits a
 * local wall-clock time with its offset ("2026-09-01T14:15:00+05:30"); `Date`
 * would re-express that in the viewer's timezone and a muhurta shown at 09:45
 * to a user in London is a wrong answer, not a cosmetic one. The characters in
 * the payload are the characters on screen.
 */
export function splitIsoInstant(iso: unknown): { date: string; time: string } | null {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const monthIndex = Number(m[2]) - 1;
  const month = MONTHS[monthIndex] ?? m[2];
  return {
    date: `${Number(m[3])} ${month} ${m[1]}`,
    time: `${m[4]}:${m[5]}`,
  };
}

/** "1994-05-14" -> "14 May 1994". Date-only payload fields (birth_data). */
export function formatIsoDate(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim() || null;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Title Case a payload word for a heading ("very good" -> "Very Good"). */
export function titleCase(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * The one numeric guard. Returns null for anything that is not a real number,
 * which is how a missing/`null` payload field becomes an ABSENT row rather
 * than "NaN°" or a confident zero.
 */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * "23:45" → "11:45 pm". DISPLAY ONLY (docs/49 ASTRAL-89's echo).
 *
 * Lives here because `format.ts` is one of the two modules the ASTRAL-19
 * structural test declares may do arithmetic on a value a user reads. The
 * 24-hour form is what travels on the wire and what the engine stores; this
 * is only what the sentence in the transcript says.
 */
export function formatClockTime(value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const hour24 = Number(m[1]);
  const suffix = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${m[2]} ${suffix}`;
}
