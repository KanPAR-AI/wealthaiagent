// The follow-along session's decisions, pure (house rule 2). The screen
// renders and schedules what this module returns and decides nothing.
//
// The client derives no DATA — doses, order, clips all arrive on the wire —
// but the session's CHOREOGRAPHY (what the voice says and when) is
// presentation, and it lives here where the root jest project can hold it.

import type { Lang } from './i18n';
import { dubUrl, isExercisePlayable } from './library-view';
import type { WireExercise, WirePhaseDetail } from './library-view';

export type RecipeId = 'full' | 'short' | 'gentle' | 'custom';

export interface SessionExercise {
  name: string;
  clipUrl: string | null;
  videoUrl: string | null;
  /** ready Hindi FULL track (a signed URL can't take the &kind= transform) */
  hindiUrl: string | null;
  hasHindi: boolean;
  /** the segment window inside the full video, for looping WITH audio */
  startSeconds: number;
  endSeconds: number | null;
  /** null = follow-the-video mode: announce, show the loop, no counting. */
  dose: {
    reps?: number;
    sets: number;
    holdSeconds?: number;
    paceSecondsPerRep?: number;
  } | null;
}

export interface SessionPlan {
  recipe: RecipeId;
  phase: string;
  exercises: SessionExercise[];
  estimatedMinutes: number;
}

function toSessionExercise(e: WireExercise): SessionExercise {
  const d = e.dose;
  return {
    name: e.name,
    // Direct signed URLs preferred (2026-09-19): no per-Range redirect tax,
    // and the iOS media cache can hold them. Ticketed fields remain the
    // fallback for an old wire or a signing outage.
    clipUrl: e.clip_src ?? e.clip_url ?? null,
    videoUrl: e.src ?? e.url,
    hindiUrl: e.src_hi
      ?? (e.dub_langs.includes('hi') && e.url ? dubUrl(e.url, 'hi') : null),
    hasHindi: e.dub_langs.includes('hi'),
    startSeconds: typeof e.start_seconds === 'number' ? e.start_seconds : 0,
    endSeconds: typeof e.end_seconds === 'number' ? e.end_seconds : null,
    dose: d
      ? {
          reps: typeof d.reps === 'number' ? d.reps : undefined,
          sets: typeof d.sets === 'number' ? d.sets : 1,
          holdSeconds: typeof d.hold_seconds === 'number' ? d.hold_seconds : undefined,
          paceSecondsPerRep:
            typeof d.pace_seconds_per_rep === 'number' ? d.pace_seconds_per_rep : 3,
        }
      : null,
  };
}

/** A dose-less exercise (follow-the-video mode) has no computable length, so
 *  it is allowed this FLAT per-exercise default — stated here, never guessed
 *  per call site. `buildPlan`'s own estimate and `remainingMinutes` share it,
 *  so "~12 min" on Today and "about 7 minutes left" mid-session can never
 *  disagree about the same exercise. */
export const NO_DOSE_SECONDS = 60; // watch-and-do allowance

function estimateSeconds(x: SessionExercise): number {
  if (!x.dose) return NO_DOSE_SECONDS;
  const sets = x.dose.sets;
  const work = x.dose.holdSeconds
    ? x.dose.holdSeconds
    : (x.dose.reps ?? 0) * (x.dose.paceSecondsPerRep ?? 3);
  const rest = 15; // between sets / to get in position
  return sets * (work + rest);
}

/**
 * How much of THIS plan is still ahead, in minutes — the number the early-exit
 * card puts in front of someone about to leave ("about 7 minutes left").
 *
 * Why it is computed and not invented (owner ask 2026-09-27, from the same
 * telemetry as `useKeepAwake`): the only returning user quit at exercise 5 of
 * 15 twice. A card that says "finish it" has to say what finishing costs, and
 * a made-up number in a medical app is a lie the user can time with a clock.
 * The doses are the server's (house rule 3); the arithmetic over them is the
 * same `estimateSeconds` the recipe cards already show.
 *
 * Returns 0 when nothing is left — the screen then drops the time clause
 * rather than printing "about 0 minutes left".
 */
export function remainingMinutes(plan: SessionPlan, doneCount: number): number {
  const from = Math.max(0, Math.min(Math.floor(doneCount), plan.exercises.length));
  const rest = plan.exercises.slice(from);
  if (!rest.length) return 0;
  const seconds = rest.reduce((n, x) => n + estimateSeconds(x), 0);
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * The quiet line under Today's recipe picker when the pick is NOT the full
 * session (owner ask 2026-09-27: "if they are choosing the shorter version
 * remind them they wont be able to take full benefit").
 *
 * It is a NOTE, not a scolding: short and gentle exist for real reasons — a
 * low-time day and a sore day are exactly when a programme is abandoned — so
 * each says what the full session adds without calling the pick a mistake.
 * `null` for 'full': a correct pick gets no commentary.
 */
export function recipeNote(recipe: RecipeId): string | null {
  switch (recipe) {
    case 'full':
      return null;
    case 'short':
      return 'today.noteShort';
    case 'gentle':
      return 'today.noteGentle';
    case 'custom':
      return 'today.noteCustom';
  }
}

/**
 * The exercises a session may contain: footage stored AND a segment or a
 * clip to play. A stored-but-unsegmented row (bug bf83c4d7: the whole source
 * file, the same title card three times) never enters a session and never
 * appears in the "Build my own" picker — the engine omits such rows too;
 * this is the client's belt for the deploy window and older servers.
 */
export function playableExercises(detail: WirePhaseDetail): WireExercise[] {
  return detail.exercises.filter(isExercisePlayable);
}

/**
 * Recipe membership, in SERVER ORDER always:
 *   full   — every playable exercise
 *   short  — the dosed ones only, capped at 4 (a countable quick session)
 *   gentle — hold-based doses only (low load), else the first 3 dosed
 */
export function buildPlan(detail: WirePhaseDetail, recipe: RecipeId): SessionPlan {
  const playable = playableExercises(detail).map(toSessionExercise);
  let chosen = playable;
  if (recipe === 'short') {
    chosen = playable.filter((x) => x.dose).slice(0, 4);
    if (!chosen.length) chosen = playable.slice(0, 4);
  } else if (recipe === 'gentle') {
    chosen = playable.filter((x) => x.dose?.holdSeconds);
    if (!chosen.length) chosen = playable.filter((x) => x.dose).slice(0, 3);
  }
  const seconds = chosen.reduce((n, x) => n + estimateSeconds(x), 0);
  return {
    recipe,
    phase: detail.phase,
    exercises: chosen,
    estimatedMinutes: Math.max(1, Math.round(seconds / 60)),
  };
}

/** A hand-picked session (the design's "Build my own from the library"):
 *  the chosen names, SERVER ORDER preserved — picking never reorders. */
export function buildCustomPlan(detail: WirePhaseDetail,
                                names: string[]): SessionPlan {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const playable = playableExercises(detail)
    .filter((e) => wanted.has(e.name.toLowerCase()))
    .map(toSessionExercise);
  const seconds = playable.reduce((n, x) => n + estimateSeconds(x), 0);
  return {
    recipe: 'custom',
    phase: detail.phase,
    exercises: playable,
    estimatedMinutes: Math.max(1, Math.round(seconds / 60)),
  };
}

/** A near-duplicate collision among the picked exercises: one movement group
 *  with two or more chosen members (e.g. "heel raise" + "standing calf raises").
 *  The engine decides the group (services/knee_movements.py); this only groups
 *  the CURRENT selection so the "Build my own" screen can warn and let the user
 *  keep both or swap one — it never removes anything (owner request 2026-09-06). */
export interface NearDuplicateWarning {
  group: string;
  names: string[];
}

export function nearDuplicateWarnings(detail: WirePhaseDetail,
                                      selectedNames: string[]): NearDuplicateWarning[] {
  const wanted = new Set(selectedNames.map((n) => n.toLowerCase()));
  const byGroup = new Map<string, string[]>();
  for (const e of detail.exercises) {
    const g = e.movement_group;
    if (!g || !wanted.has(e.name.toLowerCase())) continue;
    const list = byGroup.get(g) ?? [];
    if (!list.some((n) => n.toLowerCase() === e.name.toLowerCase())) list.push(e.name);
    byGroup.set(g, list);
  }
  const out: NearDuplicateWarning[] = [];
  for (const [group, names] of byGroup) {
    if (names.length > 1) out.push({ group, names });
  }
  return out;
}

// ── what the voice says ─────────────────────────────────────────────────────

const HI_NUMS = [
  '', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह',
  'उन्नीस', 'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस',
  'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
];

export function spokenNumber(n: number, lang: Lang): string {
  if (lang === 'hi' && n >= 1 && n < HI_NUMS.length) return HI_NUMS[n];
  return String(n);
}

/** "Exercise 1 — knee flexion stretch. 10 reps." / the Hindi twin. */
export function announcement(x: SessionExercise, index: number, total: number,
                             lang: Lang): string {
  const pos = lang === 'hi'
    ? `व्यायाम ${index + 1}`
    : `Exercise ${index + 1} of ${total}`;
  if (!x.dose) {
    return lang === 'hi'
      ? `${pos} — ${x.name}. वीडियो के साथ कीजिए.`
      : `${pos} — ${x.name}. Follow along with the video.`;
  }
  const parts: string[] = [];
  if (x.dose.reps) {
    parts.push(lang === 'hi' ? `${x.dose.reps} बार` : `${x.dose.reps} reps`);
  }
  if (x.dose.holdSeconds) {
    parts.push(lang === 'hi'
      ? `${x.dose.holdSeconds} सेकंड होल्ड`
      : `hold ${x.dose.holdSeconds} seconds`);
  }
  if (x.dose.sets > 1) {
    parts.push(lang === 'hi' ? `${x.dose.sets} सेट` : `${x.dose.sets} sets`);
  }
  return `${pos} — ${x.name}. ${parts.join(', ')}.`;
}

export interface Cue {
  /** seconds after the set starts */
  at: number;
  /** what the SCREEN shows — always Western digits (owner ruling
   *  2026-09-05: "instead of showing ७/10 in hindi, always keep it 7/10");
   *  the VOICE stays localized. */
  show?: string;
  /** what the voice says, in the session language */
  say?: string;
}

/** m:ss for the hold clock. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Rep counting: the screen shows the digit, the voice says the word. */
export function repCues(reps: number, paceS: number, lang: Lang,
                        leadInS = 3): Cue[] {
  const out: Cue[] = [];
  for (let r = 1; r <= reps; r++) {
    out.push({ at: leadInS + (r - 1) * paceS,
               show: String(r), say: spokenNumber(r, lang) });
  }
  return out;
}

/** Hold countdown — a DIGITAL CLOCK ticking every second on screen (owner
 *  ask 2026-09-05), the voice at the milestones: go, a check-in every 5 s,
 *  then the last five seconds called out 5-4-3-2-1, then the release. */
export function holdCues(holdS: number, lang: Lang, leadInS = 3): Cue[] {
  const out: Cue[] = [
    { at: leadInS, show: clockText(holdS), say: lang === 'hi' ? 'शुरू' : 'go' },
  ];
  for (let t = 1; t <= holdS; t++) {
    const remaining = holdS - t;
    let say: string | undefined;
    if (remaining >= 1 && remaining <= 5) {
      say = spokenNumber(remaining, lang);          // the 5-4-3-2-1 finish
    } else if (remaining >= 10 && remaining % 5 === 0) {
      say = spokenNumber(remaining, lang);          // the every-5s check-in
    } else if (remaining === 0) {
      say = lang === 'hi' ? 'छोड़िए' : 'and release';
    }
    out.push({ at: leadInS + t, show: clockText(remaining), say });
  }
  return out;
}

/** The whole set's cues + how long the set runs. */
export function setCues(x: SessionExercise, lang: Lang): { cues: Cue[]; durationS: number } {
  if (!x.dose) return { cues: [], durationS: 0 };
  if (x.dose.holdSeconds) {
    // reps × holds ("30 seconds, 3 reps" — the program's own phrasing):
    // each rep is a full guided hold, its number spoken before it starts.
    const reps = x.dose.reps && x.dose.reps > 1 ? x.dose.reps : 1;
    const cues: Cue[] = [];
    let base = 0;
    for (let r = 1; r <= reps; r++) {
      if (reps > 1) cues.push({ at: base, show: String(r), say: spokenNumber(r, lang) });
      const hold = holdCues(x.dose.holdSeconds, lang).map((c) => ({
        ...c, at: base + c.at,
      }));
      cues.push(...hold);
      base = hold[hold.length - 1].at + 4; // release + a breath before the next
    }
    return { cues, durationS: cues[cues.length - 1].at + 2 };
  }
  const reps = x.dose.reps ?? 0;
  const pace = x.dose.paceSecondsPerRep ?? 3;
  const cues = repCues(reps, pace, lang);
  return { cues, durationS: (cues[cues.length - 1]?.at ?? 0) + pace };
}

/** The dose line under the exercise name — screen copy, not speech. */
export function doseLabel(x: SessionExercise, lang: Lang): string {
  if (!x.dose) return lang === 'hi' ? 'वीडियो के साथ करें' : 'follow the video';
  const bits: string[] = [];
  if (x.dose.reps) bits.push(lang === 'hi' ? `${x.dose.reps} बार` : `${x.dose.reps} reps`);
  if (x.dose.holdSeconds) {
    bits.push(lang === 'hi' ? `${x.dose.holdSeconds} सेक होल्ड`
                            : `${x.dose.holdSeconds}s hold`);
  }
  if (x.dose.sets > 1) bits.push(lang === 'hi' ? `${x.dose.sets} सेट` : `× ${x.dose.sets} sets`);
  return bits.join(' · ');
}

/** Today's calendar day on this device — the ritual's honest day boundary. */
export function localDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
