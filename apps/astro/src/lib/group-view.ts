// docs/71 PH-34 — reading for a GROUP, on the client (ASTRAL-290).
//
// Owner, 2026-09-19, looking at the shipped one-person sheet: "Modify this
// to have a picker for the group that I want to do reading for."
//
// THIS MODULE OWNS THE SENTENCES AND NOTHING ELSE. Who a chat reads for is
// ENGINE state (`reading_members` on the chat envelope, ids only), and the
// engine parses these sentences with `family_members.group_cue` — one ask,
// one wording, one destination. The strings below are pinned against the
// engine's own cue test (`test_astrology_family_members.py::
// TestTheGroupCues::test_the_client_sentences_are_the_engines_cues`), which
// is the side that owns the grammar: PH-33's F116 records why the pin lives
// there rather than here.
//
// WHAT THIS MODULE MAY NOT DO — the tests grep for each:
//   · no member set held on the client (the engine holds it);
//   · no id in a sentence (the engine resolves NAMES to ids from its own
//     store, so a client that guessed an id could name a stranger);
//   · no count, no allowance, no "you have N left" — the weekly counter is
//     the engine's and the client renders its sentence (ASTRAL-297).
//
// Pure — no React, no react-native, no expo — so the ROOT jest project can
// load it (`lib/subject-view.ts`'s rule).

import { TURN_ADHOC, TURN_SELF, turnForPerson } from './subject-view';

/** The whole-circle sentence. Pinned verbatim against the engine's cue. */
export const TURN_WHOLE_FAMILY = 'Read for the whole family.';

/** "Read for me, Anjali and Rohan." — names, never ids. */
export function turnForGroup(names: readonly string[], withMe = false): string {
  const parts = names.map((n) => (n ?? '').trim()).filter(Boolean);
  const all = withMe ? ['me', ...parts] : [...parts];
  if (all.length === 0) return '';
  const body = all.length === 1
    ? all[0]
    : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
  return `Read for ${body}.`;
}

/** A group sentence needs two people. One person is the SHIPPED subject
 *  switch (`Let's talk about Anjali.`) and must stay one — the engine's cue
 *  sets are disjoint and this is the client half of that. */
export function isGroup(names: readonly string[], withMe = false): boolean {
  const n = names.filter((x) => (x ?? '').trim()).length;
  return withMe ? n >= 1 : n >= 2;
}

export interface SheetPerson {
  id: string;
  display_name: string;
  kinship?: string | null;
  in_circle?: boolean;
}

export interface SheetRow {
  /** 'you' | 'person' | 'partner_pair' | 'whole_family' | 'pick' | 'adhoc' */
  kind: 'you' | 'person' | 'partner_pair' | 'whole_family' | 'pick' | 'adhoc';
  label: string;
  /** the sentence this row sends; '' for `pick`, which opens the picker */
  turn: string;
  /** start a NEW conversation rather than continuing this one */
  fresh: boolean;
}

/** The partner, when the engine says there is one. Read off `kinship` —
 *  which the ENGINE derived (stored label or the declared link) — never
 *  guessed from a relation or a name. */
export function partnerOf(people: readonly SheetPerson[]): SheetPerson | null {
  return people.find((p) => (p.kinship ?? '') === 'partner') ?? null;
}

/** Everyone who may be in a member set: any stored person, not only the
 *  circle (AMB-64(a) — the circle governs the Family screen and the plan,
 *  not what a sentence may ask about). */
export function pickable(people: readonly SheetPerson[]): SheetPerson[] {
  return people.filter((p) => p.id !== 'self' && (p.display_name || '').trim());
}

/**
 * The sheet's rows, in order:
 *   You · each person · [Me and <partner>] · [The whole family] · [Pick
 *   people…] · Someone new / just this reading.
 *
 * The group rows APPEAR ONLY WHEN THEY MEAN SOMETHING: the pair row needs a
 * partner, and "the whole family" / "pick people" need at least two people
 * to choose between — a row that sends a sentence the engine will refuse is
 * worse than no row (doctrine 8's rule, applied to a sheet).
 *
 * Every group row is `fresh`: a SCOPE CHANGE STARTS A NEW READING (docs/70
 * §3a.1 screen 7), so one conversation never mixes two sets of people. The
 * engine enforces the same rule from its side — a subject cue clears
 * `reading_members` — and neither side relies on the other.
 */
export function subjectSheetWithGroups(
  people: readonly SheetPerson[],
): SheetRow[] {
  const others = pickable(people);
  const partner = partnerOf(others);
  const rows: SheetRow[] = [
    { kind: 'you', label: 'You', turn: TURN_SELF, fresh: false },
    ...others.map((p) => ({
      kind: 'person' as const,
      label: p.display_name.trim(),
      turn: turnForPerson(p.display_name.trim()),
      fresh: false,
    })),
  ];
  if (partner) {
    rows.push({
      kind: 'partner_pair',
      label: `Me and ${partner.display_name.trim()}`,
      turn: turnForGroup([partner.display_name.trim()], true),
      fresh: true,
    });
  }
  if (others.length >= 2) {
    rows.push({ kind: 'whole_family', label: 'The whole family',
                turn: TURN_WHOLE_FAMILY, fresh: true });
    rows.push({ kind: 'pick', label: 'Pick people…', turn: '', fresh: true });
  }
  rows.push({
    kind: 'adhoc',
    label: 'Someone new / just this reading',
    turn: TURN_ADHOC,
    fresh: true,
  });
  return rows;
}

/** What the picker sends once the user has ticked their people. `withMe`
 *  is the "…and me" switch. '' when the selection is not a group — the
 *  caller keeps the picker open rather than sending a sentence that would
 *  be read as a one-person subject switch. */
export function turnForSelection(
  people: readonly SheetPerson[],
  selectedIds: readonly string[],
  withMe: boolean,
): string {
  const chosen = pickable(people)
    .filter((p) => selectedIds.includes(p.id))
    .map((p) => p.display_name.trim());
  return isGroup(chosen, withMe) ? turnForGroup(chosen, withMe) : '';
}

/** The picker's cap, so the sheet cannot offer what the engine will drop.
 *  The engine's own cap is `family_members.MEMBER_CAP` and it is the one
 *  that binds; this stops the UI promising a sixth person. */
export const MEMBER_CAP = 5;

export function canSelectMore(selectedIds: readonly string[]): boolean {
  return selectedIds.length < MEMBER_CAP;
}
