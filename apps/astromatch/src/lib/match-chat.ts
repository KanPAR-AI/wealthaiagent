/**
 * One chat per saved match (docs/73 ASTRAL-341, from ASTRAL-59/146).
 *
 * PURE — no React, no `chrome.*` (the store is injected). Two things live
 * here: what the handoff may carry, and which chat a match's conversation
 * belongs to.
 *
 * ── what the handoff carries ──────────────────────────────────────────────
 *
 * IDS AND THE OPENER, NEVER A RESTATED BIRTH VALUE. The date, the time and
 * the place are on the People store already, stamped with their provenance
 * and their inputs hash; a handoff that repeated them would be a second,
 * unversioned copy travelling through a prompt, and ASTRAL-146's rule is that
 * the restated copy is the one that goes stale. So the payload is a person
 * id, a pair key and the sentence from `@wealthai/astral` — and
 * `match-chat.test.ts` asserts, against a fixture captured from the running
 * engine, that no birth value of any shape appears in it.
 *
 * ── the engine gap this design had to live with (F381) ────────────────────
 *
 * The row asks for the handoff to carry "person ids and the match artifact
 * id". It does — to THIS client, which uses them for the stored read. What
 * reaches the ENGINE is the opener sentence, because there is no id-keyed
 * door into a match conversation: `graph.INPUT_FIELDS` declares no
 * `person2_id` and no `pair_key` a client may send, no HTTP route accepts a
 * birth fact or an artifact id (INV-1, `tests/test_people_api.py`), and the
 * ONE shipped way a chat is scoped to a stored match is the deterministic
 * NAME cue — `_MATCH_NAME_CUE` → `_rehydrate_stored_match`, which finds the
 * person by display name and copies the STORED scorecard into the envelope.
 * That carrier is reused rather than a new one invented; the gap is reported
 * rather than routed around.
 *
 * ── one chat id per match ─────────────────────────────────────────────────
 *
 * The row's own words. Re-entering a match's conversation lands in the SAME
 * chat, so the engine's slot store and event log work unchanged and the
 * second question does not arrive in a chat that knows nothing. The link is
 * `{pairKey, chatId}` — two opaque identifiers, neither of them a birth
 * value, a name or a place — and it is the only thing this extension keeps
 * about a match. It is not a second store of matches (ASTRAL-37): it holds
 * no score, no verdict, no person and nothing that could be rendered.
 */

import { askAboutMatchTurn } from '@wealthai/astral';

import type { KeyValueStore } from './pending-deletes';

export interface MatchChatHandoff {
  /** the other person's id, for the stored read this panel already does */
  personId: string | null;
  /** the match artifact's own key */
  pairKey: string;
  /** the sentence the engine's deterministic switch reads */
  opener: string;
  /** what the chat is CALLED, for the user's own history. A label. */
  title: string;
}

/**
 * The handoff, built from a row the engine sent.
 *
 * `name` is the display name joined at read (ASTRAL-141) — a label, not a
 * fact. Nothing else about the person travels.
 */
export function matchChatHandoff(row: {
  pairKey: string;
  personId: string | null;
  name: string;
}): MatchChatHandoff {
  return {
    personId: row.personId,
    pairKey: row.pairKey,
    opener: askAboutMatchTurn(row.name),
    title: `Match — ${row.name}`,
  };
}

// ── which chat this match's conversation is in ─────────────────────────────

export const MATCH_CHATS_KEY = 'astromatch.match_chats';

/** Two opaque ids and nothing else. The shape is asserted on read. */
export interface MatchChatLink {
  pairKey: string;
  chatId: string;
}

/**
 * How many links are kept.
 *
 * A bound rather than a growing list: the links cost nothing to lose (the
 * next question simply opens a new chat for that match) and a store that only
 * ever grows is a store nobody prunes.
 */
export const MATCH_CHAT_LIMIT = 50;

/**
 * PARSE, DON'T TRUST — the same rule the wire gets.
 *
 * Storage is shared with whatever earlier version of this extension wrote it,
 * so a record of a shape we do not recognise is DROPPED. A record carrying
 * anything beyond the two declared keys is also dropped: it means something
 * wrote more than an id, which is the one thing this store exists to prevent.
 */
export function readLinks(raw: unknown): MatchChatLink[] {
  if (!Array.isArray(raw)) return [];
  const out: MatchChatLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length !== 2 || keys[0] !== 'chatId' || keys[1] !== 'pairKey') continue;
    if (typeof record.chatId !== 'string' || typeof record.pairKey !== 'string') continue;
    if (!record.chatId.trim() || !record.pairKey.trim()) continue;
    out.push({ chatId: record.chatId, pairKey: record.pairKey });
  }
  return out;
}

export function linkFor(links: MatchChatLink[], pairKey: string): string | null {
  return links.find((link) => link.pairKey === pairKey)?.chatId ?? null;
}

/** Replace this match's link, or append it — newest last, bounded. */
export function withLink(links: MatchChatLink[], link: MatchChatLink): MatchChatLink[] {
  const others = links.filter((existing) => existing.pairKey !== link.pairKey);
  const all = [...others, link];
  return all.slice(Math.max(0, all.length - MATCH_CHAT_LIMIT));
}

export function withoutLink(links: MatchChatLink[], pairKey: string): MatchChatLink[] {
  return links.filter((link) => link.pairKey !== pairKey);
}

// ── the store side, injected so it is testable without a browser ───────────

export async function loadLinks(store: KeyValueStore): Promise<MatchChatLink[]> {
  const bag = await store.get(MATCH_CHATS_KEY);
  return readLinks(bag[MATCH_CHATS_KEY]);
}

export async function rememberLink(
  store: KeyValueStore,
  link: MatchChatLink,
): Promise<MatchChatLink[]> {
  const next = withLink(await loadLinks(store), link);
  await store.set({ [MATCH_CHATS_KEY]: next });
  return next;
}

export async function forgetLink(
  store: KeyValueStore,
  pairKey: string,
): Promise<MatchChatLink[]> {
  const next = withoutLink(await loadLinks(store), pairKey);
  await store.set({ [MATCH_CHATS_KEY]: next });
  return next;
}

// ── the door the handoff crosses, and what it refuses ──────────────────────

/**
 * PARSE THE HANDOFF AT THE WORKER'S DOOR (INV-10's shape, at this seam).
 *
 * The panel builds it and the worker receives it through a structured clone,
 * so what arrives is whatever the sender wrote. This is the boundary that
 * makes "never a restated birth value" a property of the code rather than of
 * a test: the object must have EXACTLY the four declared keys, and the opener
 * — the only free text that reaches the engine on this path — must contain no
 * DIGIT at all.
 *
 * A date, a time and a year cannot be written without one. A name normally
 * can: the cost of the rule is a display name with a digit in it, which is
 * REFUSED with a sentence rather than sent, and the honest outcome there is
 * the ordinary reading path. An exit boundary rejects; it does not repair.
 */
export function parseMatchChatHandoff(raw: unknown): MatchChatHandoff | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'opener,pairKey,personId,title') return null;
  const pairKey = typeof record.pairKey === 'string' ? record.pairKey.trim() : '';
  const opener = typeof record.opener === 'string' ? record.opener.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const personId =
    record.personId === null
      ? null
      : typeof record.personId === 'string'
        ? record.personId.trim()
        : '';
  if (!pairKey || !opener || !title || personId === '') return null;
  if (/[0-9]/.test(opener) || /[0-9]/.test(title)) return null;
  return { personId, pairKey, opener, title };
}

/** Why a handoff was refused, in the words the panel shows. */
export const HANDOFF_REFUSED_NOTE =
  'I could not open a conversation about that match. Nothing was sent.';

// ── what the screen may PROMISE before the turn (FLAG-1) ───────────────────

/**
 * THE PROMISE, AND WHEN IT MAY BE MADE.
 *
 * The first cut printed, unconditionally and before any turn came back:
 * "This answers from the scorecard already on your account — nothing is
 * scored again, and your birth details are not asked for or sent again."
 *
 * On the walk's own leg that was FALSE. `_rehydrate_stored_match`
 * (`graph.py:11759`) declines on anything not FRESH, on a refusal, on an
 * undetermined Moon rashi, and whenever `_MATCH_NAME_CUE` fails to find the
 * person by display name — three-word names, all-caps names, initials,
 * hyphens, Devanagari. When it declines, the turn falls through to
 * `node_synastry`, which CASTS BOTH CHARTS and runs gun milan again, and the
 * scorecard it draws is allowed to differ from the one in the list above it.
 * Every match on the account this was walked is stale (gun milan is at v4),
 * so that was the ordinary case, not the edge.
 *
 * So the promise is made only where the engine's own precondition holds —
 * the row is FRESH, it has a score, and it is not a refusal — and it is
 * WITHDRAWN the moment the turn disproves it (`recomputedNow` below). The
 * panel states what it knows.
 */
export interface MatchChatBasis {
  /** true only when the stored-scorecard promise may be made */
  promised: boolean;
  /** the sentence the header shows BEFORE the turn returns */
  sentence: string;
}

export const BASIS_STORED =
  'This answers from the scorecard already on your account — nothing is ' +
  'scored again, and your birth details are not asked for or sent again.';

export const BASIS_MAY_RESCORE =
  'This opens a conversation about this match. The numbers on file were ' +
  'scored earlier and something they depend on has moved since, so it may be ' +
  'scored again here — and a fresh score can differ from the one in your list.';

export const BASIS_NO_SCORE =
  'This opens a conversation about this match. There is no stored score for ' +
  'it, so it may be scored here.';

export interface MatchChatRow {
  /** the engine's own word: `fresh` | `stale` | `unprovable` */
  freshness: string | null | undefined;
  /** does the stored record carry a scorecard? */
  scored: boolean;
  /** is it a refusal (ASTRAL-144)? */
  refused: boolean;
}

export function chatBasis(row: MatchChatRow): MatchChatBasis {
  const promised = row.freshness === 'fresh' && row.scored && !row.refused;
  if (promised) return { promised, sentence: BASIS_STORED };
  if (!row.scored || row.refused) return { promised, sentence: BASIS_NO_SCORE };
  return { promised, sentence: BASIS_MAY_RESCORE };
}

// ── and what the TURN proved (FLAG-1, second half) ─────────────────────────

/**
 * The engine's own progress line, which has exactly ONE emitter.
 *
 * `graph.py:13251` — the first yield of `node_synastry`, the node that casts
 * both charts and computes gun milan. The narrate path
 * (`RouteDecision("adjudicate", "stored_match_narrate")`) does not emit it.
 * So its presence is a recompute, measured rather than inferred, and the
 * panel NEVER hides it: it is the true sentence about what just happened.
 */
export const RECOMPUTE_CUE = /Casting both Kundlis/i;

export const RESCORED_NOTE =
  'Scored again just now — this can differ from the numbers in your list.';

export const BASIS_RESCORED =
  'The engine scored this match again for this answer, so these numbers can ' +
  'differ from the ones in your list.';

export interface TurnEvidence {
  /** everything the stream has produced so far */
  text: string;
  /** did this turn carry a `match_report` block? */
  drewScorecard: boolean;
  /** was the row the user tapped FRESH? */
  rowWasFresh: boolean;
}

/**
 * Did this turn score the match again?
 *
 * Two signals, and either is enough: the progress line (one emitter, above),
 * or a scorecard arriving on a row that was NOT fresh — which the rehydration
 * would have refused, so the numbers can only have been computed here.
 */
export function recomputedNow(evidence: TurnEvidence): boolean {
  if (RECOMPUTE_CUE.test(evidence.text ?? '')) return true;
  return evidence.drewScorecard && !evidence.rowWasFresh;
}

/**
 * The header, now — after whatever the turn proved.
 *
 * A promise the turn disproved is REPLACED, not left on screen next to its
 * own contradiction.
 */
export function basisNow(basis: MatchChatBasis, recomputed: boolean): string {
  return recomputed ? BASIS_RESCORED : basis.sentence;
}

/**
 * THE WITHDRAWAL IS STICKY (FLAG-1 residual, found by the reviewer's probe).
 *
 * `rescored` was derived from the STREAM, and the Ask button clears the
 * stream — so a second question in the same chat restored "This answers from
 * the scorecard already on your account…" over a conversation whose scorecard
 * had just been computed in that very chat. Once a recompute has been seen
 * here, it is a fact about this chat and not about this turn: the latch keeps
 * it for the life of the mount, and a new mount is a new match.
 */
export function latchRescored(seen: boolean, evidence: TurnEvidence): boolean {
  return seen || recomputedNow(evidence);
}

/**
 * ONE STATEMENT AT THE TOP, never two (the reviewer's second point).
 *
 * The header already carries `BASIS_RESCORED` when a recompute has been seen,
 * and the scorecard sits directly under it — so printing `RESCORED_NOTE`
 * above the scorecard as well said the same thing twice, a line apart. The
 * note is therefore shown ONLY when the header is not the rescored sentence,
 * which under the latch above means it does not appear in this panel at all.
 * It is kept — and kept tested — because the rule is "never both", not "never
 * the note": a surface whose header says something else still needs it.
 */
export function noteAboveScorecard(
  header: string,
  state: { rescored: boolean; drewScorecard: boolean },
): string | null {
  if (!state.rescored || !state.drewScorecard) return null;
  if (header === BASIS_RESCORED) return null;
  return RESCORED_NOTE;
}
