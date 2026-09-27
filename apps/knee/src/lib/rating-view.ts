// When to ask "is your knee any better?", pure (house rule 2). ONE module
// owns the cadence so the answer can never differ between the screen that
// asks and the store that remembers.
//
// Why this exists (owner ask 2026-09-27): "after every 3 days or 5 days pop up
// question asking to rate the overall improvement". The app records sessions
// and pain-at-that-moment, but nothing has ever asked the only question the
// programme is FOR — is the knee better than when you started. Without it
// there is no way to tell a user who is improving from one who is grinding.
//
// Two hard rules the cadence encodes, both from the same telemetry that
// produced `useKeepAwake` (4 starts, 0 saves, two quits at exercise 5 of 15):
//   · it NEVER interrupts a workout — the caller may only ask on the
//     completion summary, and this module is asked once the day is recorded;
//   · it asks rarely. A daily "how are you feeling?" is how an app gets
//     muted, and a recovery programme has nothing new to say day over day.

/** Day numbering: the first day the app saw this user is DAY 1. So the first
 *  ask, at day 3, lands on the third calendar day of use — two days after
 *  first seen. Stated here because "after 3 days" has two readings and the
 *  tests pin this one. */
export const FIRST_ASK_DAY = 3;

/** Then every 5 days — the owner's "3 days or 5 days" read as a first ask at
 *  3 and a rhythm of 5 thereafter. */
export const REPEAT_EVERY_DAYS = 5;

/** The scale, smallest useful set. Four choices, one of them negative: an
 *  improvement question with no way to say "worse" is not a question. */
export type RatingScore = 'much_better' | 'better' | 'same' | 'worse';

export const RATING_CHOICES: readonly RatingScore[] =
  ['much_better', 'better', 'same', 'worse'] as const;

/** The i18n key for a choice's button label. */
export function ratingLabelKey(score: RatingScore): string {
  return `rating.${score}`;
}

/** Whole days from one local calendar date to another (YYYY-MM-DD, as
 *  `localDate()` mints them). UTC noon on both ends so a DST shift between
 *  the two dates cannot round a day away. Negative when `bISO` is earlier. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T12:00:00Z`);
  const b = Date.parse(`${bISO}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Which day of use today is — first seen = day 1. A clock that went
 *  backwards (a device date change) never reads below day 1. */
export function dayNumber(firstSeenISO: string, todayISO: string): number {
  return Math.max(1, daysBetween(firstSeenISO, todayISO) + 1);
}

/**
 * The whole decision, in one place.
 *
 *   firstSeen unknown            → no    (nothing to count from; record it first)
 *   before day 3                 → no    (a programme has said nothing yet)
 *   never asked, day ≥ 3         → YES   (the first ask)
 *   asked today                  → no    (never twice a day — the "Not now"
 *                                         defer and a second recorded session
 *                                         on the same day both land here)
 *   asked < 5 days ago           → no    (still inside the window)
 *   asked ≥ 5 days ago           → YES   (the next window)
 *
 * A "Not now" is recorded as an ASK (the caller stamps the same date), so
 * declining defers to the next window rather than re-asking on the next
 * session that evening.
 */
export function shouldAsk(lastAskedISO: string | null,
                          firstSeenISO: string | null,
                          todayISO: string): boolean {
  if (!firstSeenISO) return false;
  if (dayNumber(firstSeenISO, todayISO) < FIRST_ASK_DAY) return false;
  if (!lastAskedISO) return true;
  return daysBetween(lastAskedISO, todayISO) >= REPEAT_EVERY_DAYS;
}

// ── the question's little machine ──────────────────────────────────────────
//
//   hidden ──ask────▶ asking ──answer──▶ answered   (terminal — "thank you")
//                       │
//                       └────defer───▶ closed      (terminal — "Not now")
//
// Any other (phase, event) pair returns null: the tap is ILLEGAL and the screen
// ignores it — the same double-tap guard `promptNext` gives the exit card.
//
// It is a table and not two booleans on the screen because of review finding
// B3 (2026-09-27): with `ratingAsk`/`ratingSent` living in session.tsx, the
// stamp that makes "we asked" true was written by the two ANSWER paths only, so
// a user who read the question and tapped Done stamped nothing and got asked
// again on the next recorded session — possibly an hour later. `shouldAsk`'s
// "never twice a day" was true of the function and false of the feature. With
// one transition into `asking`, the screen has exactly one place to stamp it.

export type RatingPhase = 'hidden' | 'asking' | 'answered' | 'closed';
export type RatingEvent = 'ask' | 'answer' | 'defer';

export function ratingNext(phase: RatingPhase, event: RatingEvent): RatingPhase | null {
  switch (phase) {
    case 'hidden':
      return event === 'ask' ? 'asking' : null;
    case 'asking':
      if (event === 'answer') return 'answered';
      if (event === 'defer') return 'closed';
      return null;
    default:
      return null; // answered / closed are terminal
  }
}

// ── day 1 belongs to the server ───────────────────────────────────────────
//
// Review finding B4 (2026-09-27): day 1 was the first day THIS BUILD ran, so
// every user already on the programme — including the only returning user, the
// one this feature exists for — would have been counted as starting on the day
// he took the OTA update: his first question two days later regardless of his
// real history, and `improvement_rating {day_n}` reporting day 3 for someone
// three weeks in. The server holds the recorded days
// (`first_session_date` on `GET /knee/progress`) and house rule 3 says the
// client derives nothing the server owns.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD date, or null. Guards the wire: a malformed value would poison
 *  `dayNumber` for good, and this value is written once and kept. */
export function asISODate(value: string | null | undefined): string | null {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

/**
 * Day 1 = the EARLIER of what this device saw and what the server recorded.
 *
 * Earlier, not "server wins": the server's field is capped by the progress
 * read's 60-day window (stated in `compute_progress`), and a user may also have
 * opened the app days before recording anything. Whichever date is earlier is
 * the closer answer to "when did you start", and both are real events.
 * Lexical comparison is exact for YYYY-MM-DD.
 */
export function firstSeenDay(stored: string | null | undefined,
                             serverFirst: string | null | undefined): string | null {
  const a = asISODate(stored);
  const b = asISODate(serverFirst);
  if (!a) return b;
  if (!b) return a;
  return b < a ? b : a;
}
