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
  /** near-duplicate group decided by the engine (services/knee_movements.py);
   *  null = unique. Two exercises are near-duplicates iff same non-null group.
   *  The client compares, never decides. */
  movement_group?: string | null;
}

export interface WireAbout {
  name: string;
  start_seconds: number | null;
  end_seconds: number | null;
  url: string | null;
  clip_url?: string | null;
  dub_langs: string[];
}

/** One stamped non-exercise row (SEG-5, docs/59): the walker/cane/biking
 *  rows that left the exercise set but stay in the Library under their own
 *  category heading. Same playback contract as an exercise row. */
export interface WireSectionItem {
  name: string;
  category: string;
  start_seconds: number | null;
  end_seconds: number | null;
  video_file: string | null;
  url: string | null;
  clip_url?: string | null;
  dub_langs: string[];
}

export interface WireSection {
  category: string;
  items: WireSectionItem[];
}

export interface WirePhaseDetail extends WirePhase {
  exercises: WireExercise[];
  /** strategy / plan videos — ON TOP, never counted (owner ruling) */
  about?: WireAbout[];
  /** stamped non-exercise categories, AFTER the exercise list; absent or
   *  empty on a server that has nothing stamped — the screen renders
   *  sections only when they arrive (capability honesty). */
  sections?: WireSection[];
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

export interface SectionRows {
  category: string;
  rows: ExerciseRow[];
}

/** Section wire rows → render rows, mirroring exerciseRows: SERVER ORDER for
 *  sections and for the items inside them, no recount, no dead affordances.
 *  A section with no items is dropped — an empty heading is a claim the
 *  server never made. */
export function sectionsRows(detail: WirePhaseDetail): SectionRows[] {
  return (detail.sections ?? [])
    .filter((s) => s.items.length > 0)
    .map((s) => ({
      category: s.category,
      rows: s.items.map((it, i) => ({
        key: `${detail.phase}:${s.category}:${i}:${it.name}`,
        name: it.name,
        clock: formatClock(it.start_seconds),
        hasHindi: it.dub_langs.includes('hi'),
        playable: Boolean(it.url),
        url: it.url,
        startSeconds: it.start_seconds,
        endSeconds: it.end_seconds,
      })),
    }));
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
