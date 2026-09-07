// The phase experience's decisions, as a pure module (house rule 2 — no
// React/react-native/expo, tested from the workspace root).
//
// The client derives NOTHING about the phases (rule 3): every name, goal,
// criterion, exit step, count and the strategy video arrive on the wire from
// `GET /api/v1/knee/program/phases`. The one thing computed here is applying
// the self-assessment the ENGINE defined — `evaluateFinder` mirrors the
// server's `evaluate_finder` exactly (the server is the source of truth; this
// runs the same rules live as the user taps, so the screen never round-trips
// per checkbox). It is a data-driven decision table, not invented knowledge.

export interface WirePhaseVideo {
  title: string;
  start_seconds: number | null;
  url: string | null;
}

export interface WirePhaseContent {
  phase: string;
  name: string;
  goal: string;
  tag: string;
  focus: string[];
  criteria: string[];
  exit: string[];
  count: number;
  catalog_count: number | null;
  complete: boolean;
  strategy_video: WirePhaseVideo | null;
}

export interface WireFinderOption {
  value: string;
  label: string;
  sets: string[];
}

export interface WireFinderQuestion {
  id: string;
  kind: 'scale' | 'choice';
  prompt: string;
  // scale widget (0..max tappable steps):
  max?: number;
  unit?: string;
  sets_flag?: string;
  flag_min?: number;
  // choice widget (pick one):
  options?: WireFinderOption[];
}

export interface WireFinderRung {
  all: string[];
  phase: string;
}

export interface WireFinder {
  questions: WireFinderQuestion[];
  flag_ids: string[];
  ladder: WireFinderRung[];
  default: string;
  flag_phase: string;
}

/** An answer per question: a number for a scale, an option value for a choice. */
export type FinderAnswers = Record<string, number | string | undefined>;

export interface WirePhasesResponse {
  corpus_id: string;
  phases: WirePhaseContent[];
  finder: WireFinder;
}

/** The internal flag/signal booleans a set of card answers turns on, using the
 *  thresholds the finder declares — the client applies the engine's rules, it
 *  does not know the domain. */
function finderFlags(
  finder: WireFinder,
  answers: FinderAnswers,
): Record<string, boolean> {
  const on: Record<string, boolean> = {};
  for (const q of finder.questions) {
    const v = answers[q.id];
    if (q.kind === 'scale') {
      if (typeof v === 'number' && q.flag_min != null && v >= q.flag_min && q.sets_flag) {
        on[q.sets_flag] = true;
      }
    } else {
      const opt = (q.options ?? []).find((o) => o.value === v);
      for (const s of opt?.sets ?? []) on[s] = true;
    }
  }
  return on;
}

/**
 * Which phase the self-assessment answers place someone in. Mirrors the
 * server's `evaluate_finder` exactly: any red flag wins (→ flag_phase), else
 * the first ladder rung whose signals are ALL true, else the default.
 * `answers` is {question_id: value} — a number for a scale, an option value
 * for a choice.
 */
export function evaluateFinder(
  finder: WireFinder,
  answers: FinderAnswers,
): string {
  const on = finderFlags(finder, answers);
  if (finder.flag_ids.some((id) => on[id])) return finder.flag_phase;
  for (const rung of finder.ladder) {
    if (rung.all.every((id) => on[id])) return rung.phase;
  }
  return finder.default;
}

/** The phase with this id, or undefined — a small helper so screens never
 *  index the array by position (phase "2" is not always index 1). */
export function phaseById(
  phases: WirePhaseContent[],
  id: string,
): WirePhaseContent | undefined {
  return phases.find((p) => p.phase === id);
}

/** The phase AFTER this one, or undefined at the top — for "your way into
 *  Phase N" on the detail card. */
export function nextPhase(
  phases: WirePhaseContent[],
  id: string,
): WirePhaseContent | undefined {
  const i = phases.findIndex((p) => p.phase === id);
  return i >= 0 ? phases[i + 1] : undefined;
}
