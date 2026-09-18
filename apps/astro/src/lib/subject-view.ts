// docs/60 SL-1 / SL-4 — the reading subject, on the client.
//
// WHO the chat is reading for is ENGINE state (`reading_subject` on the
// chat envelope). This app never guesses it: the engine ends every turn
// with a `reading_subject` block, and the chip renders exactly that. What
// this module owns is the three sentences the chip may SEND — the same
// strings `chatservice/services/agents/astrology/subject.py` parses (one
// ask, one wording, one destination) — and a tiny store the chat screen
// reads the current subject from.
//
// Pure — no React, no react-native, no expo — so the ROOT jest project
// runs it.

export type SubjectMode = 'self' | 'person' | 'adhoc';

export interface ReadingSubject {
  mode: SubjectMode;
  person_id: string | null;
  name: string | null;
  label: string;
}

export const SELF_SUBJECT: ReadingSubject = {
  mode: 'self', person_id: null, name: null, label: 'You',
};

/** The sentences. Pinned verbatim against the engine's cues in tests. */
export const TURN_SELF = 'Read for me.';
export const TURN_ADHOC = 'Just this reading.';
export function turnForPerson(name: string): string {
  return `Let's talk about ${name}.`;
}

/** The engine's block → a subject, or null when the payload is not one. */
export function parseSubjectBlock(value: unknown): ReadingSubject | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.type !== 'reading_subject') return null;
  const mode = v.mode === 'person' || v.mode === 'adhoc' ? v.mode : 'self';
  const name = typeof v.name === 'string' && v.name ? v.name : null;
  const person_id = typeof v.person_id === 'string' && v.person_id ? v.person_id : null;
  const label = typeof v.label === 'string' && v.label
    ? v.label
    : mode === 'person' ? (name ?? 'Someone') : mode === 'adhoc' ? 'Just this reading' : 'You';
  return { mode, person_id, name, label };
}

/** What the chip says, and what the sheet's title says. */
export function chipLabel(s: ReadingSubject | null): string {
  return `Reading for ${(s ?? SELF_SUBJECT).label}`;
}

/** The sheet's rows, in order: You · each person · someone new / just this
 *  reading. Returns the option labels and the sentence each one sends. */
export function subjectSheet(
  people: ReadonlyArray<{ id: string; display_name: string }>,
): Array<{ label: string; turn: string; fresh: boolean }> {
  return [
    { label: 'You', turn: TURN_SELF, fresh: false },
    ...people
      .filter((p) => p.id !== 'self' && (p.display_name || '').trim())
      .map((p) => ({ label: p.display_name.trim(), turn: turnForPerson(p.display_name.trim()), fresh: false })),
    // Owner 2026-09-17: "Someone new should start a new chat, not continue
    // in the old chat." A just-this-reading conversation must inherit no
    // history — the row carries `fresh` and the screen starts a new chat
    // with the cue as its first turn (the Matches handoff's own mechanism).
    { label: 'Someone new / just this reading', turn: TURN_ADHOC, fresh: true },
  ];
}

// ── the store: one current subject for the mounted chat surface ────────────
//
// A module-level subscription rather than React context because the block
// handler that receives the engine's payload lives in the widget registry,
// outside any screen's tree. `reset()` runs when the chat surface changes
// chats; a history reload re-emits the last block through the same handler.

type Listener = (s: ReadingSubject) => void;
let current: ReadingSubject = SELF_SUBJECT;
let engineSaid = false;
const listeners = new Set<Listener>();

export const subjectStore = {
  get(): ReadingSubject { return current; },
  /** True once the ENGINE's `reading_subject` block has spoken for the chat
   *  on screen — a reset's "You" is a default, not a statement. */
  engineSaid(): boolean { return engineSaid; },
  set(s: ReadingSubject | null, fromEngine = false): void {
    current = s ?? SELF_SUBJECT;
    engineSaid = fromEngine && s !== null;
    listeners.forEach((l) => l(current));
  },
  reset(): void { subjectStore.set(SELF_SUBJECT); },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
