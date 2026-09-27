// Where the improvement question's two dates and its answers live: this
// device, via the platform storage adapter (the `knee.lang` / `knee.phase`
// pattern). Plumbing only — every decision belongs to `rating-view.ts`.
//
// On-device is deliberate for now: there is no server field for a subjective
// improvement score, so the ANSWER also goes to telemetry
// (`improvement_rating`, meta {score, day_n}) — that is the copy the owner can
// actually read. When a user_progress field exists, this module is the one
// place that changes.

import { getPlatform } from '@wealthai/core';

import { track } from './telemetry';
import { dayNumber, firstSeenDay, shouldAsk, type RatingScore } from './rating-view';

const FIRST_SEEN_KEY = 'knee.rating.firstSeen';
const LAST_ASKED_KEY = 'knee.rating.lastAsked';
const ANSWERS_KEY = 'knee.rating.answers';

/** How many answers we keep on the device. The trend, not the archive —
 *  telemetry holds every one. */
const MAX_ANSWERS = 24;

export interface RatingAnswer {
  /** the local calendar date the answer was given (YYYY-MM-DD) */
  date: string;
  score: RatingScore;
  /** which day of use that was — first seen = day 1 */
  dayN: number;
}

export interface RatingState {
  firstSeen: string | null;
  lastAsked: string | null;
  answers: RatingAnswer[];
}

/** Read the three values. A storage failure reads as "nothing known", which
 *  `shouldAsk` turns into "do not ask" — the cheaper error: a missed question
 *  beats a question fired on a blank slate every single session. */
export async function loadRatingState(): Promise<RatingState> {
  try {
    const s = getPlatform().storage;
    const [firstSeen, lastAsked, raw] = await Promise.all([
      s.getItem(FIRST_SEEN_KEY),
      s.getItem(LAST_ASKED_KEY),
      s.getItem(ANSWERS_KEY),
    ]);
    return { firstSeen, lastAsked, answers: parseAnswers(raw) };
  } catch {
    return { firstSeen: null, lastAsked: null, answers: [] };
  }
}

function parseAnswers(raw: string | null): RatingAnswer[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RatingAnswer[]) : [];
  } catch {
    return []; // a corrupt blob is not worth a crash on a completion screen
  }
}

/** Stamp the first day this device saw the app, ONCE — the FALLBACK day 1.
 *  Called on app open, so a genuinely new user counts from the day they
 *  actually started rather than from their third session. For a user who was
 *  already on the programme this date is the day they took the build, which is
 *  a lie the server can correct: `seedFirstSeen` moves day 1 back to the first
 *  recorded session (review finding B4). Returns the stamped date (the
 *  existing one if there already is one). */
export async function noteAppOpen(todayISO: string): Promise<string | null> {
  try {
    const s = getPlatform().storage;
    const existing = await s.getItem(FIRST_SEEN_KEY);
    if (existing) return existing;
    await s.setItem(FIRST_SEEN_KEY, todayISO);
    return todayISO;
  } catch {
    return null;
  }
}

/**
 * Adopt the SERVER's first recorded day as day 1 when it is earlier than what
 * this device stamped (review finding B4, 2026-09-27).
 *
 * Called wherever a progress payload lands — the Today read and every record —
 * so a user who was on the programme long before this build stops being told he
 * started the day he updated. Only ever moves day 1 EARLIER: `firstSeenDay`
 * picks the earlier of the two, which is why running this on every read is
 * idempotent and why a server that returns null changes nothing.
 * Returns the day now stored.
 */
export async function seedFirstSeen(
  serverFirstISO: string | null | undefined,
): Promise<string | null> {
  try {
    const s = getPlatform().storage;
    const stored = await s.getItem(FIRST_SEEN_KEY);
    const next = firstSeenDay(stored, serverFirstISO);
    if (!next || next === stored) return stored;
    await s.setItem(FIRST_SEEN_KEY, next);
    return next;
  } catch {
    return null;   // a missed seed re-runs on the next progress read
  }
}

/** Remember that we asked today — stamped for BOTH an answer and a "Not now",
 *  which is what makes a decline defer to the next window (rating-view). */
export async function markAsked(todayISO: string): Promise<void> {
  try {
    await getPlatform().storage.setItem(LAST_ASKED_KEY, todayISO);
  } catch {
    // an unwritten stamp means we may ask again tomorrow — annoying, not broken
  }
}

/**
 * The ask, as ONE operation: is the question due today, and if it is, it has
 * now been RECORDED as asked.
 *
 * Review finding B3 (2026-09-27): the stamp lived in the screen's two answer
 * handlers, so a user who read the question and tapped Done stamped nothing and
 * was asked again by the next recorded session — possibly an hour later.
 * `shouldAsk`'s "never twice a day" was true of the function and false of the
 * feature. There is now no way for a caller to get the "yes" WITHOUT the stamp,
 * which is the only shape of this that a screen cannot get wrong.
 *
 * `firstSeen` rides back because the answer's `day_n` needs it and the caller
 * would otherwise read storage twice.
 */
export async function askIfDue(
  todayISO: string,
): Promise<{ ask: boolean; firstSeen: string | null }> {
  const st = await loadRatingState();
  if (!shouldAsk(st.lastAsked, st.firstSeen, todayISO)) {
    return { ask: false, firstSeen: st.firstSeen };
  }
  await markAsked(todayISO);
  return { ask: true, firstSeen: st.firstSeen };
}

/** Persist an answer and send it to telemetry. The stamp is written FIRST so a
 *  storage hiccup on the answer list can never leave the question re-asking. */
export async function recordRating(score: RatingScore,
                                   todayISO: string,
                                   firstSeenISO: string | null): Promise<void> {
  const dayN = firstSeenISO ? dayNumber(firstSeenISO, todayISO) : 1;
  await markAsked(todayISO);
  track('improvement_rating', { score, day_n: dayN });
  try {
    const s = getPlatform().storage;
    const answers = parseAnswers(await s.getItem(ANSWERS_KEY));
    answers.push({ date: todayISO, score, dayN });
    await s.setItem(ANSWERS_KEY,
      JSON.stringify(answers.slice(-MAX_ANSWERS)));
  } catch {
    // the answer already reached telemetry; the local copy is the convenience
  }
}
