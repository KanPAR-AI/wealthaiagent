// The library screen's decisions, as a pure module (house rule 2: every
// screen rule lives in a `*-view.ts` with no React/react-native/expo, tested
// from the workspace root against fixtures captured from the running engine).
//
// The client derives nothing (rule 3): membership, order, counts,
// completeness and dub languages all arrive on the wire from
// `GET /api/v1/knee/program*`. What lives here is PRESENTATION — clock
// formatting, the honest subtitle, and turning a wire row into a render row —
// never a recount and never a recomputation.

export interface WirePhase {
  phase: string;
  name: string;
  count: number;
  catalog_count: number | null;
  complete: boolean;
}

export interface WireProgram {
  corpus_id: string;
  phases: WirePhase[];
}

export interface WireDose {
  reps?: number;
  sets?: number;
  hold_seconds?: number;
  pace_seconds_per_rep?: number;
  source?: string;
}

export interface WireExercise {
  name: string;
  title: string;
  phase: string;
  start_seconds: number | null;
  end_seconds: number | null;
  video_file: string | null;
  url: string | null;
  /** the muted ~15s demo loop, present only when its artifact exists */
  clip_url?: string | null;
  /** the transcript's own dose, or absent — never defaulted client-side */
  dose?: WireDose | null;
  dub_langs: string[];
}

export interface WireAbout {
  name: string;
  start_seconds: number | null;
  end_seconds: number | null;
  url: string | null;
  clip_url?: string | null;
  dub_langs: string[];
}

export interface WirePhaseDetail extends WirePhase {
  exercises: WireExercise[];
  /** strategy / plan videos — ON TOP, never counted (owner ruling) */
  about?: WireAbout[];
}

/** 71 → "1:11"; 554.97 → "9:14". Presentation only. */
export function formatClock(seconds: number | null): string | null {
  if (seconds === null || !isFinite(seconds) || seconds < 0) return null;
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The line under a phase header — and it never overclaims.
 *
 * The server's `complete` flag is the enumeration doctrine's cross-check
 * (member count vs the phase catalog). Only when the server says complete
 * does the screen say "the complete set"; on a mismatch it states both
 * numbers, which is the honest form of a corpus mid-repair.
 */
export function phaseSubtitle(p: WirePhase): string {
  const n = p.count === 1 ? '1 exercise' : `${p.count} exercises`;
  if (p.complete) return `${n} — the complete set`;
  return `${n} indexed of ${p.catalog_count} in the catalog`;
}

export interface ExerciseRow {
  key: string;
  name: string;
  /** "at 1:11" when the segment carries a start; absent otherwise. */
  clock: string | null;
  hasHindi: boolean;
  /** Playable now? False = footage not stored server-side; the row renders
   *  without a play affordance rather than with a dead one. */
  playable: boolean;
  url: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
}

/** Wire rows → render rows, in SERVER ORDER — reordering here would be the
 *  client deciding what the program teaches first. */
export function exerciseRows(detail: WirePhaseDetail): ExerciseRow[] {
  return detail.exercises.map((e, i) => ({
    key: `${detail.phase}:${i}:${e.name}`,
    name: e.name,
    clock: formatClock(e.start_seconds),
    hasHindi: e.dub_langs.includes('hi'),
    playable: Boolean(e.url),
    url: e.url,
    startSeconds: e.start_seconds,
    endSeconds: e.end_seconds,
  }));
}

/** The count the screen states is the server's, verbatim. */
export function statedCount(detail: WirePhaseDetail): number {
  return detail.count;
}

/**
 * `&kind=source_hi` inserted before the `#t=` fragment — the same transform
 * apps/mobile's `dubUrl` applies to chat citations, restated here because a
 * pure module may not import across apps. `lang` must be a server-declared
 * dub language; callers gate on `dub_langs`.
 */
export function dubUrl(url: string, lang: string): string {
  const hash = url.indexOf('#');
  const base = hash === -1 ? url : url.slice(0, hash);
  const frag = hash === -1 ? '' : url.slice(hash);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}kind=source_${lang}${frag}`;
}
