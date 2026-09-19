// docs/71 PH-33 — the Circle, on the client (ASTRAL-288).
//
// THIS MODULE RENDERS WHAT THE ENGINE SENT AND DECIDES NOTHING.
//
// Home's slot has three states and the ENGINE picks which one by picking
// which block it sends (F114): no `family` block and a partner door on the
// couple lens → the invite; no `family` block with a partner on file → the
// shipped couple card, unchanged; a `family` block → the family rows. This
// module reads that choice off the response. It does not count the circle,
// it does not ask "do they have a partner", and it never falls back.
//
// WHAT IT MAY NOT CONTAIN, and the tests grep for each:
//   · no band computed from a score — `band` and `score` both arrive, and
//     the boundary already proved `band_of(score) === band` server-side;
//   · no threshold, no colour constant standing in for a word;
//   · no clock — "today" is the block's own `as_of`;
//   · no kinship inferred from anything.
//
// Pure — no React, no react-native, no expo — so the ROOT jest project can
// load it (`lib/subject-view.ts`'s rule; `lib/tiers.ts` broke jest by
// pulling native auth in through one import).

import { coupleCard, type CoupleCard } from './daily-view';
import type { DailyReady, PersonView } from './people-shapes';

// ── the block, as the engine sends it ─────────────────────────────────────

export interface FamilyRowView {
  person_id: string;
  name: string;
  kinship: string | null;
  chart_status: string;
  /** present when the member's day was scored */
  band?: 'green' | 'amber' | 'red';
  score?: number;
  line?: string;
  reasons?: string[];
  moon_nakshatra?: string;
  moon_rashi?: string | null;
  /** present INSTEAD of a band — the sentence, never a blank */
  absent?: string;
  unlocked_by?: string;
}

export interface FamilyBlock {
  kind: string;
  as_of: string;
  place: { name?: string | null; basis?: string } | null;
  you: { band?: string | null; score?: number | null; line?: string | null };
  rows: FamilyRowView[];
  carries: string | null;
  basis: string;
}

/** What Home's one slot renders. `null` means the slot is empty — not a
 *  placeholder, not a spinner. */
export type FamilySlot =
  | { mode: 'couple'; couple: CoupleCard }
  | { mode: 'family'; block: FamilyBlock }
  | null;

export function familyBlock(res: DailyReady): FamilyBlock | null {
  const block = (res as { family?: unknown }).family;
  if (!block || typeof block !== 'object') return null;
  const b = block as FamilyBlock;
  return Array.isArray(b.rows) ? b : null;
}

/**
 * Home's slot. The engine's choice, read off the response.
 *
 * A `family` block wins because the engine only sends one when the circle
 * holds somebody other than the partner alone; otherwise the shipped
 * couple card (which is itself either the door or the couple's day) takes
 * the slot exactly as it did before this phase existed.
 */
export function familyView(res: DailyReady): FamilySlot {
  const block = familyBlock(res);
  if (block) return { mode: 'family', block };
  const couple = coupleCard(res);
  return couple ? { mode: 'couple', couple } : null;
}

// ── the rows, as the Family screen and Home draw them ─────────────────────

/** The WORD beside the colour, always (ASTRAL-288: no colour without its
 *  word). The engine sent the band; this is its label, nothing more. */
export const BAND_WORD: Record<string, string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
};

export const KINSHIP_LABEL: Record<string, string> = {
  partner: 'Partner',
  mother: 'Mother',
  father: 'Father',
  son: 'Son',
  daughter: 'Daughter',
  brother: 'Brother',
  sister: 'Sister',
  grandmother: 'Grandmother',
  grandfather: 'Grandfather',
  other: 'Family',
};

/** Every kinship the engine accepts, in the order the picker offers them.
 *  Pinned by test against `services/people/model.KINSHIPS`. */
export const KINSHIPS = [
  'partner', 'mother', 'father', 'son', 'daughter', 'brother', 'sister',
  'grandmother', 'grandfather', 'other',
] as const;
export type Kinship = (typeof KINSHIPS)[number];

/** docs/71 ASTRAL-280, AMB-58(a): four people besides you. The client
 *  shows the count; the SERVER refuses the fifth (422) and this number is
 *  only ever used to say so before the tap, never to gate it silently. */
export const CIRCLE_MAX = 4;

export interface FamilyRowDisplay {
  personId: string;
  name: string;
  kinshipLabel: string;
  /** the band's own word, or null when the row is an absence */
  bandWord: string | null;
  band: string | null;
  /** the engine's meaning line, or the engine's absence sentence */
  detail: string;
  /** true when this row states an absence instead of a band */
  isAbsent: boolean;
  unlockedBy: string | null;
}

/** One display row per engine row, in the engine's order. No sorting: the
 *  engine put the partner first and the block's order is the answer. */
export function familyRows(block: FamilyBlock): FamilyRowDisplay[] {
  return block.rows.map((row) => ({
    personId: row.person_id,
    name: row.name,
    kinshipLabel: row.kinship ? (KINSHIP_LABEL[row.kinship] ?? 'Family') : 'Family',
    bandWord: row.band ? (BAND_WORD[row.band] ?? null) : null,
    band: row.band ?? null,
    detail: row.absent ?? row.line ?? '',
    isAbsent: !row.band,
    unlockedBy: row.unlocked_by ?? null,
  }));
}

/** Your own row, from the card's own day — the engine copied it onto the
 *  block so that nothing here reads the card twice or recomputes it. */
export function yourRow(block: FamilyBlock): FamilyRowDisplay {
  return {
    personId: 'self',
    name: 'You',
    kinshipLabel: 'You',
    bandWord: block.you.band ? (BAND_WORD[block.you.band] ?? null) : null,
    band: block.you.band ?? null,
    detail: block.you.line ?? '',
    isAbsent: !block.you.band,
    unlockedBy: null,
  };
}

/** The line under the block naming the sky it was cast at (F113: one
 *  panchang, and it has to say which place). */
export function familyPlaceLine(block: FamilyBlock): string | null {
  const name = (block.place?.name ?? '').trim();
  return name ? `Today at ${name}, from each person's own Moon` : null;
}

// ── the Family screen's rows, from the ONE people read ─────────────────────

export interface CircleMemberView {
  personId: string;
  name: string;
  kinship: string;
  kinshipLabel: string;
  /** "stored" — the owner said so · "link" — derived from the partner link */
  kinshipSource: string | null;
  chartStatus: string;
  /** the honest sentence for this row's chart state; never a blank */
  chartLine: string;
  /** true when the chart has not been cast and one reading would cast it */
  needsChart: boolean;
  timeKnown: boolean;
}

const CHART_LINE: Record<string, string> = {
  fresh: 'Chart on file',
  absent: 'Their chart hasn’t been cast yet',
  stale: 'Their details changed after this chart was cast',
  corrected_stale: 'They corrected their details — the chart needs recasting',
  unstamped: 'This chart doesn’t record the frame it was cast in',
  unprovable: 'This chart can’t prove which details it was cast from',
};

/**
 * The circle, from `GET /people` and nothing else (ASTRAL-282: ONE read).
 *
 * `in_circle` is the engine's answer — including for the partner a link
 * names but no document labels yet (ASTRAL-283, `kinship_source: "link"`).
 * This function filters and formats; it does not decide who is family.
 */
export function circleMembers(people: readonly PersonView[]): CircleMemberView[] {
  return people
    .filter((p) => p.in_circle && p.kinship)
    .map((p) => {
      const status = (p.chart?.status ?? 'absent').toLowerCase();
      return {
        personId: p.id,
        name: (p.display_name ?? '').trim() || 'Unnamed',
        kinship: p.kinship as string,
        kinshipLabel: KINSHIP_LABEL[p.kinship as string] ?? 'Family',
        kinshipSource: p.kinship_source ?? null,
        chartStatus: status,
        chartLine: CHART_LINE[status] ?? 'Their chart state is unknown',
        needsChart: status !== 'fresh',
        timeKnown: !!p.tob_known,
      };
    });
}

/** How many more the circle may hold. The server is the authority; this
 *  is what the screen SAYS before the tap. */
export function circleRoom(members: readonly unknown[]): number {
  return Math.max(0, CIRCLE_MAX - members.length);
}

// ── adding a member (ASTRAL-286) ──────────────────────────────────────────
//
// There is no route that accepts a birth fact and there is not going to be
// one. Adding a member is the SHIPPED details flow: the opening sentence
// binds the chat to a standalone reading, the arc collects the details
// through `input_request` → `input_response` → `reconcile`, the engine
// offers to keep the person, and the person it mints is a `friend` (F115).
// The kinship arrives afterwards, as ONE label PATCH.
//
// The sentence below is `subject.CUE_ADHOC`'s own wording — the engine
// parses it deterministically, whole-message. `test_people_circle.py`
// pins it on the engine's side (`subject_cue(ADD_MEMBER_TURN) == adhoc`),
// which is the side that owns the grammar.

export const ADD_MEMBER_TURN = 'Reading for someone new.';

export interface AddMemberRoute {
  pathname: '/birth-details';
  params: { opening: string; kinship: string; returnTo: 'family' };
}

/** The details screen's title when it was opened to add a member. It said
 *  "Let's Build Your Chart" over somebody else's details (owner, on device
 *  2026-09-19). Null when the route carries no known kinship — the screen
 *  then keeps its own title. */
export function addMemberTitle(kinship: string | null | undefined): string | null {
  const k = String(kinship ?? '');
  if (!(KINSHIPS as readonly string[]).includes(k)) return null;
  return k === 'other' ? 'Add a Family\nMember' : `Add Your\n${KINSHIP_LABEL[k]}`;
}

export function addMemberRoute(kinship: Kinship): AddMemberRoute {
  return {
    pathname: '/birth-details',
    params: { opening: ADD_MEMBER_TURN, kinship, returnTo: 'family' },
  };
}

/**
 * After the details flow: which person just arrived without a kinship.
 *
 * The engine minted them as `friend` and gave them no kinship, so the
 * newest kinship-less person who is not `self` and not a saved match is
 * the one the user just added. Pure over the list the screen re-read — no
 * second fetch, no id smuggled through a route param, and NOTHING is
 * written until the screen sends the one PATCH.
 *
 * Returns null when there is no candidate, which is the honest answer when
 * the user abandoned the flow: the screen then says nothing rather than
 * labelling somebody at random.
 */
export function newlyAddedPerson(
  people: readonly PersonView[],
  knownIds: readonly string[],
): PersonView | null {
  const known = new Set(knownIds);
  const fresh = people.filter(
    (p) => p.id !== 'self' && !p.in_circle && !known.has(p.id) && p.relation !== 'match',
  );
  if (fresh.length !== 1) return null;
  return fresh[0];
}

/**
 * What to DO with a pending "add a member" intent, given the list the screen
 * just re-read. Pure, so the abandon path is testable — `family.tsx` is a
 * component and nothing tests it.
 *
 * Role-3 found the defect this closes (2026-09-19): the intent was module
 * state that only ever cleared on success, so abandoning the details flow
 * left it armed. An unrelated person saved from a chat later became the sole
 * candidate and was silently labelled with a kinship the user had chosen for
 * somebody else, entering the circle with no confirmation. That is docs/67's
 * bug class — a fact attached to the wrong person — and it must not come back
 * through a client-side door.
 *
 * Three outcomes, and the caller clears the intent on all but `wait`:
 *   `wait`    — the read has not settled yet; decide nothing.
 *   `label`   — exactly one new kinship-less person: the one just minted.
 *   `discard` — no candidate (abandoned), or the intent is older than
 *               PENDING_ADD_TTL_MS. The intent dies rather than waiting for
 *               somebody to mislabel.
 */
export const PENDING_ADD_TTL_MS = 15 * 60 * 1000;

export interface PendingAdd {
  kinship: Kinship;
  known: readonly string[];
  at: number;
}

export type PendingAddOutcome =
  | { action: 'wait' }
  | { action: 'discard'; reason: 'abandoned' | 'expired' }
  | { action: 'label'; personId: string; kinship: Kinship };

export function pendingAddOutcome(
  pending: PendingAdd | null,
  people: readonly PersonView[] | null,
  settled: boolean,
  now: number,
): PendingAddOutcome {
  if (!pending) return { action: 'wait' };
  if (now - pending.at > PENDING_ADD_TTL_MS) {
    return { action: 'discard', reason: 'expired' };
  }
  if (!people || !settled) return { action: 'wait' };
  const minted = newlyAddedPerson(people, pending.known);
  if (!minted) return { action: 'discard', reason: 'abandoned' };
  return { action: 'label', personId: minted.id, kinship: pending.kinship };
}

// ── Forget (ASTRAL-287) ───────────────────────────────────────────────────
//
// The cascade takes the person, their chart, their filed cards and
// timeline, every match naming them, and the partner link if it pointed at
// them. It does NOT delete palm images — F7 / ASTRAL-43: the deletion
// primitive does not exist. The confirmation says so, in the engine's own
// words, pinned verbatim against `services/people/forget_copy.FORGET_GAP`
// and echoed on the DELETE response as `not_covered`.

export const FORGET_GAP =
  'Palm images they uploaded are not covered — that deletion is not built yet (ASTRAL-43).';

export const FORGET_COVERS =
  'their birth details, their chart, their saved cards and timeline, and every match that named them';

export function forgetConfirmation(name: string): string {
  const who = (name ?? '').trim() || 'This person';
  return `Forget ${who}? This removes ${FORGET_COVERS}. ${FORGET_GAP}`;
}

// ── the doors (ASTRAL-288) ────────────────────────────────────────────────
//
// Two, and only one of them exists in PH-33. "Family weather" is PH-35's
// screen; until it ships the door is ABSENT — not greyed, not "coming
// soon", not a tile that spins (capability law, doctrine 8).

/** The chat handoff sentence the "Ask for the family" door sends. */
export const ASK_FOR_THE_FAMILY_TURN = 'How does today look for my family?';
