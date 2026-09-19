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

// ── adding a member (ASTRAL-286, rewritten docs/71 §10) ───────────────────
//
// THE OWNER'S SENTENCE, 2026-09-19: "while adding a member to family it's
// not necessary to go to chat — users might get confused."
//
// What this replaced: the details screen handed the typed carrier to the
// CHAT screen, the engine ran a full natal interpretation nobody asked for
// (thirty to sixty seconds on the Pro reading model), the user then had to
// type a name and tap Keep INSIDE the chat, and only then did THIS module
// guess — from "the one new kinship-less person" — who had just been added,
// so it could PATCH the kinship on. Role-3 caught that guess labelling a
// stranger (docs/71 §8).
//
// What it is now: the user picks the relation, types the name, fills the
// birth-details card, taps once, and lands back here. Three deterministic
// turns go out on the shared chat lifecycle from the details screen, none of
// them costs a model call, and the ENGINE stamps the kinship when reconcile
// mints the person — so there is nothing left for a client heuristic to get
// wrong, and `pendingAddOutcome` / `newlyAddedPerson` are gone with it.
//
// There is STILL no route that accepts a birth fact and there is not going
// to be one. The details travel `input_request` → `input_response` →
// `reconcile`, exactly as before. What travels on the route is two LABELS —
// a kinship and a display name — which is what a route param may carry.

/** The word each kinship is spoken with in the opening sentence.
 *
 *  Pinned against `services/agents/astrology/family_add.KINSHIP_WORD`: a
 *  sentence composed at runtime can drift out of the engine's cue with
 *  NOTHING going red — the user taps Add, the engine answers with a
 *  paragraph, and this screen waits for a form that never comes. Two files
 *  asserting the same literals cannot fail that quietly (the
 *  `lib/edit-fact.ts::CORRECTION_TURNS` discipline). */
export const KINSHIP_WORD: Record<string, string> = {
  partner: 'partner',
  mother: 'mother',
  father: 'father',
  son: 'son',
  daughter: 'daughter',
  brother: 'brother',
  sister: 'sister',
  grandmother: 'grandmother',
  grandfather: 'grandfather',
  // "Add my other, Priya." is not a sentence.
  other: 'relative',
};

/** The engine's own limits on a display name, restated so the screen can say
 *  what is wrong BEFORE the tap rather than after a refusal
 *  (`family_add.NAME_MAX`, `NAME_MAX_WORDS`, and the cue's punctuation
 *  class). The engine is still the authority; this is the courtesy. */
export const NAME_MAX = 60;
export const NAME_MAX_WORDS = 4;

/** What is wrong with this name, in a sentence, or null when nothing is. */
export function memberNameProblem(name: string | null | undefined): string | null {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'What should I call them?';
  if (clean.length > NAME_MAX) return `That is longer than ${NAME_MAX} characters.`;
  if (clean.split(' ').length > NAME_MAX_WORDS) {
    return `A name here is up to ${NAME_MAX_WORDS} words.`;
  }
  if (/[,.!?;:]/.test(clean)) return 'A name here carries no punctuation.';
  return null;
}

/**
 * The opening sentence. ONE DECLARED SHAPE, matching
 * `family_add.turn_for(kinship, name)` byte for byte.
 *
 * Null when this build cannot build a sentence the engine parses back —
 * never a composed fallback, because a sentence no engine test has ever
 * fired is the silent prose degradation described above.
 */
export function addMemberTurn(
  kinship: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const k = String(kinship ?? '');
  if (!(KINSHIPS as readonly string[]).includes(k)) return null;
  if (memberNameProblem(name)) return null;
  const clean = String(name).trim().replace(/\s+/g, ' ');
  return `Add my ${KINSHIP_WORD[k]}, ${clean}.`;
}

export interface AddMemberRoute {
  pathname: '/birth-details';
  params: {
    opening: string;
    kinship: string;
    /** a LABEL — the name the user typed. Never a birth fact. */
    memberName: string;
    returnTo: 'family';
  };
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

export function addMemberRoute(
  kinship: Kinship,
  name: string,
): AddMemberRoute | null {
  const opening = addMemberTurn(kinship, name);
  if (!opening) return null;
  return {
    pathname: '/birth-details',
    params: {
      opening,
      kinship,
      memberName: String(name).trim().replace(/\s+/g, ' '),
      returnTo: 'family',
    },
  };
}

/** Does this details-screen instance belong to the add-a-member flow?
 *  (`isReturningEdit`'s twin — one question, one answer, one place.) */
export function isAddingMember(returnTo: string | undefined | null): boolean {
  return returnTo === 'family';
}

/** The honest progress line while the chart is being cast. It names the
 *  person, because "Casting your chart…" over somebody else's details is
 *  the copy bug the title above was just fixed out of. */
export function castingMemberLine(name: string | null | undefined): string {
  const clean = String(name ?? '').trim();
  return clean ? `Casting ${clean}'s chart…` : 'Casting their chart…';
}

/** What to say when the flow did not complete. Three different facts about
 *  the world, kept apart for `editFailure`'s reason: collapsing them into
 *  "something went wrong" is what makes a user try the same thing four
 *  times. The engine's own refusal (INV-4) is quoted, never rewritten. */
export function addMemberFailure(
  kind: 'transport' | 'no_form',
  detail?: string,
): string {
  const said = String(detail ?? '').trim();
  if (kind === 'transport') {
    return `I couldn't reach the engine to add them${said ? ` (${said})` : ''}. ` +
      'Nothing was saved — try again in a moment.';
  }
  return (
    'The engine answered without the birth-details card this time, so there ' +
    'is nothing to fill in here. Nothing was saved.'
  );
}

// ── the add arc, step by step (Role-3 F-A — SAFETY-BLOCKER, 2026-09-19) ──
//
// The details screen drives three turns. The first version decided what to do
// next from what was MISSING: "no input_request came back, so the chart is
// cast — send the keep". A birthplace the geocoder could not find answers in
// prose only, so the keep went out, a person with no chart was created, and
// Family showed a green tick over the engine's own refusal. The engine was
// honest; the client threw the honesty away — and that whole decision lived in
// the component, untested (F-B).
//
// The engine now SAYS which state each turn ended in (a typed ```member_add```
// block, closed vocabulary). This module reads that and nothing else. An
// ABSENT or UNKNOWN state is a failure, never a success: the keep is sent on
// exactly one state, `chart_cast`.

export const MEMBER_ADD_BLOCK = 'member_add';
export const MEMBER_STATES = [
  'asking', 'chart_cast', 'cast_failed', 'kept', 'circle_full', 'no_chart',
  'keep_failed', 'kept_unlabelled',
] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

/** The engine's state for this reply, or null. Parses the fenced block the
 *  engine wrote; never infers a state from the prose around it. */
export function memberAddState(reply: string | null | undefined): MemberState | null {
  const m = /```member_add\n([\s\S]*?)\n```/.exec(String(reply ?? ''));
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]) as { type?: unknown; state?: unknown };
    if (v?.type !== MEMBER_ADD_BLOCK) return null;
    return (MEMBER_STATES as readonly string[]).includes(String(v.state))
      ? (v.state as MemberState) : null;
  } catch {
    return null;
  }
}

export type MemberStep =
  /** the engine is asking something — render its ask on this screen.
   *  `failed` is true when the ask FOLLOWS a refusal (a birthplace it could
   *  not find): the engine's sentence is shown as an error above the ask. */
  | { action: 'ask'; failed: boolean }
  /** the chart is cast — and ONLY now may the keep be sent */
  | { action: 'keep' }
  /** over. `failed` decides the icon; `stay` keeps the form up so a wrong
   *  birthplace can be corrected instead of being lost with the screen */
  | { action: 'done'; failed: boolean; stay: boolean };

/** After the DETAILS turn. `hasAsk` is whether a parsed input_request came
 *  back (the screen already knows how to render one). */
export function afterCastTurn(state: MemberState | null, hasAsk: boolean): MemberStep {
  if (state === 'chart_cast') return { action: 'keep' };
  if (state === 'asking' && hasAsk) return { action: 'ask', failed: false };
  // The engine refused AND asked again — for the birthplace only, so the date
  // and time the user already gave are not retyped.
  if (state === 'cast_failed' && hasAsk) return { action: 'ask', failed: true };
  // cast_failed, a missing state, an unknown one, an "asking" with nothing to
  // render: nothing is kept, and the engine's own sentence is shown as a
  // FAILURE with the form still up.
  return { action: 'done', failed: true, stay: true };
}

/** The engine's sentence as plain words: its markdown emphasis is for a
 *  transcript, and a notice that prints "*Pune*" with the asterisks reads as
 *  a rendering bug (seen on the simulator walk). Wording untouched. */
export function plainSentence(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/\*\*?([^*\n]+?)\*\*?/g, '$1')
    // …and an UNPAIRED marker: `outcomeLine` trims the closing asterisk, so
    // the banner opened with a stray "*Kabeer is in your family" (walked
    // 2026-09-19).
    .replace(/^\*+\s*|\s*\*+$/g, '')
    .trim();
}

/** After the KEEP turn. Only `kept` is a success. */
export function afterKeepTurn(state: MemberState | null): MemberStep {
  if (state === 'kept') return { action: 'done', failed: false, stay: false };
  // kept_unlabelled: stored but NOT in the circle — the Family screen would
  // not show them, so a green tick would be a lie. circle_full / no_chart /
  // keep_failed / missing: nothing was added.
  return { action: 'done', failed: true, stay: false };
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
  'Palm images they uploaded are not covered — that deletion is not built yet.';

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
