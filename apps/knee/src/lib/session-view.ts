// The follow-along session's decisions, pure (house rule 2). The screen
// renders and schedules what this module returns and decides nothing.
//
// The client derives no DATA — doses, order, clips all arrive on the wire —
// but the session's CHOREOGRAPHY (what the voice says and when) is
// presentation, and it lives here where the root jest project can hold it.

import type { Lang } from './i18n';
import type { WireExercise, WirePhaseDetail } from './library-view';

export type RecipeId = 'full' | 'short' | 'gentle';

export interface SessionExercise {
  name: string;
  clipUrl: string | null;
  videoUrl: string | null;
  hasHindi: boolean;
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
    clipUrl: e.clip_url ?? null,
    videoUrl: e.url,
    hasHindi: e.dub_langs.includes('hi'),
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

function estimateSeconds(x: SessionExercise): number {
  if (!x.dose) return 60; // watch-and-do allowance
  const sets = x.dose.sets;
  const work = x.dose.holdSeconds
    ? x.dose.holdSeconds
    : (x.dose.reps ?? 0) * (x.dose.paceSecondsPerRep ?? 3);
  const rest = 15; // between sets / to get in position
  return sets * (work + rest);
}

/**
 * Recipe membership, in SERVER ORDER always:
 *   full   — every playable exercise
 *   short  — the dosed ones only, capped at 4 (a countable quick session)
 *   gentle — hold-based doses only (low load), else the first 3 dosed
 */
export function buildPlan(detail: WirePhaseDetail, recipe: RecipeId): SessionPlan {
  const playable = detail.exercises
    .filter((e) => e.url || e.clip_url)
    .map(toSessionExercise);
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
  text: string;
}

/** Rep counting: one spoken number per rep at the stored pace, after the
 *  design's beat of silence. */
export function repCues(reps: number, paceS: number, lang: Lang,
                        leadInS = 3): Cue[] {
  const out: Cue[] = [];
  for (let r = 1; r <= reps; r++) {
    out.push({ at: leadInS + (r - 1) * paceS, text: spokenNumber(r, lang) });
  }
  return out;
}

/** Hold countdown: start word, then a check-in every 5 s, then the release.
 *  The design's rule verbatim: "after a pause starts counting". */
export function holdCues(holdS: number, lang: Lang, leadInS = 3): Cue[] {
  const out: Cue[] = [
    { at: leadInS, text: lang === 'hi' ? 'शुरू' : 'go' },
  ];
  for (let remaining = holdS - 5; remaining >= 5; remaining -= 5) {
    out.push({ at: leadInS + (holdS - remaining),
               text: spokenNumber(remaining, lang) });
  }
  out.push({ at: leadInS + holdS, text: lang === 'hi' ? 'छोड़िए' : 'and release' });
  return out;
}

/** The whole set's cues + how long the set runs. */
export function setCues(x: SessionExercise, lang: Lang): { cues: Cue[]; durationS: number } {
  if (!x.dose) return { cues: [], durationS: 0 };
  if (x.dose.holdSeconds) {
    const cues = holdCues(x.dose.holdSeconds, lang);
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
