// What a share card may carry — and nothing else.
//
// docs/69 (The Shareable Sky), loop 2: the Day Seal. docs/49 ASTRAL-63 is the
// rule this file exists to keep: a share payload is "verdict, one line of
// reasoning, brand — NO birth data, no palm, no coordinates". So the payload
// is built HERE, from the day view, field by field, and the card component
// receives only this object. It cannot leak what it was never handed: the
// cited reasons (they name the user's natal Moon), the place the day was
// scored for, the tara, the score — none of them are on the type.
//
// The brand is the caller's wordmark token (F35: never a string here).
//
// Selection, not computation: every word is the engine's own (`label`,
// `line`, a window's clock text, the strip's weekday labels and bands).
import type { DayBand, DayView } from './daily-view';

export const SEAL_KEYS = [
  'kind', 'band', 'label', 'dateLabel', 'stance', 'windowLabel', 'window',
  'dots', 'todayIndex', 'hook', 'brand',
] as const;

export interface DaySeal {
  kind: 'day';
  band: DayBand;
  /** "Green day" — the engine's band word */
  label: string;
  dateLabel: string;
  /** the short imperative inside the engine's meaning line ("lean in") */
  stance: string;
  windowLabel: string | null;
  window: string | null;
  dots: Array<DayBand | null>;
  todayIndex: number;
  hook: string;
  brand: string;
}

/** "a green day — lean in: start the thing…" → "lean in". The whole line
 *  when it does not have that shape; never an invented phrase. */
export function sealStance(line: string): string {
  const m = /—\s*([^:—]{2,40}):/.exec(line ?? '');
  if (m) return m[1].trim();
  return (line ?? '').trim();
}

export function daySeal(
  view: DayView | null, dateLabel: string, brand: string,
): DaySeal | null {
  if (!view) return null;
  let windowLabel: string | null = null;
  let window: string | null = null;
  if (view.band !== 'red' && view.golden.length > 0) {
    windowLabel = 'Golden window';
    window = view.golden[0];
  } else {
    const todayAt = view.strip.findIndex((d) => d.isToday);
    const next = view.strip.find((d, i) => i > todayAt && d.band === 'green');
    if (next) {
      windowLabel = 'Next green day';
      window = next.weekday;
    }
  }
  return {
    kind: 'day',
    band: view.band,
    label: view.label,
    dateLabel,
    stance: sealStance(view.line),
    windowLabel,
    window,
    dots: view.strip.map((d) => d.band),
    todayIndex: view.strip.findIndex((d) => d.isToday),
    hook: 'What colour is your day?',
    brand,
  };
}

/** The words that travel beside the image (and alone, where a platform
 *  cannot share a file). Same allowlist: built from the seal only. */
export function sealMessage(seal: DaySeal): string {
  const parts = [`${seal.label} — ${seal.stance}.`];
  if (seal.windowLabel && seal.window) parts.push(`${seal.windowLabel}: ${seal.window}.`);
  parts.push(`${seal.hook} ${seal.brand}`);
  return parts.join(' ');
}
