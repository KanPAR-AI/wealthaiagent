/**
 * The register, as a screen shows it (docs/74 ASTRAL-357, PH-45).
 *
 * The engine's `undetermined` register carries two KINDS of entry and they
 * are not the same statement:
 *
 *   undetermined — the chart CANNOT say this (no birth time, so no Lagna).
 *   sensitive    — the chart DOES say this, and a near alternative exists
 *                  (the Navamsa lagna turns on a four-minute window; the
 *                  birth time was read from one of two clocks).
 *
 * Filing a sensitive entry under "What this chart cannot say" put a note
 * reading "it is Scorpio" under a diamond that reads Sagittarius: one
 * screen, two answers. So the two kinds get their own heading and their own
 * caption, and BOTH come from the engine's `kind` — this module parses no
 * field key. The title is the engine's too; the local table is only the
 * fallback for an engine that predates `title`, and an unknown key is still
 * shown rather than dropped, because dropping it would hide the disclosure.
 *
 * Pure: no React, no react-native, no expo. The chart screen and the profile
 * screen both render what this returns and decide nothing.
 */
import type { Undetermined } from './people-shapes';

export type RegisterKind = 'undetermined' | 'sensitive';

export interface RegisterNoteView {
  field: string;
  kind: RegisterKind;
  title: string;
  /** VERBATIM. The engine wrote the reason and it is the one that is true. */
  reason: string;
  alternatives: string[];
  /** One line, when the alternatives are short enough to read as one. */
  alternativesLine: string | null;
  /** One per line, when each alternative is a sentence of its own. */
  alternativesList: string[];
}

export interface RegisterGroup {
  kind: RegisterKind;
  heading: string;
  notes: RegisterNoteView[];
}

export const REGISTER_HEADINGS: Record<RegisterKind, string> = {
  undetermined: 'What this chart cannot say',
  sensitive: 'What turns on your birth details',
};

/** An alternative longer than this is a sentence, and sentences joined with
 *  "or" stop being readable. A rashi or a graha name is far shorter. */
const SENTENCE_LENGTH = 32;

function kindOf(entry: Undetermined): RegisterKind {
  // An engine that predates `kind` sent only absences.
  return entry.kind === 'sensitive' ? 'sensitive' : 'undetermined';
}

function captionFor(kind: RegisterKind, alternatives: string[]): string | null {
  if (!alternatives.length) return null;
  const joined = alternatives.join(' or ');
  if (kind === 'sensitive') {
    return alternatives.length === 1
      ? `The other reading: ${joined}.`
      : `The other readings: ${joined}.`;
  }
  return `It is one of: ${joined}.`;
}

export function registerNote(
  entry: Undetermined,
  fallbackTitle: (field: string) => string,
): RegisterNoteView {
  const field = String(entry.field);
  const kind = kindOf(entry);
  const alternatives = Array.isArray(entry.alternatives) ? entry.alternatives.map(String) : [];
  const sentences = alternatives.some((a) => a.length > SENTENCE_LENGTH);
  const engineTitle = typeof entry.title === 'string' ? entry.title.trim() : '';
  return {
    field,
    kind,
    title: engineTitle || fallbackTitle(field),
    reason: String(entry.reason ?? ''),
    alternatives,
    alternativesLine: sentences ? null : captionFor(kind, alternatives),
    alternativesList: sentences ? alternatives : [],
  };
}

/** The register in the order the engine sent it, split by kind. A kind with
 *  no entries has no group, so no empty heading is ever drawn. */
export function registerGroups(
  register: Undetermined[] | undefined,
  fallbackTitle: (field: string) => string,
): RegisterGroup[] {
  const notes = (register ?? []).map((e) => registerNote(e, fallbackTitle));
  const order: RegisterKind[] = ['undetermined', 'sensitive'];
  return order
    .map((kind) => ({
      kind,
      heading: REGISTER_HEADINGS[kind],
      notes: notes.filter((n) => n.kind === kind),
    }))
    .filter((g) => g.notes.length > 0);
}
