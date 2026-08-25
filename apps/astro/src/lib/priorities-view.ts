// The Preferences section's view model (docs/49 S20: ASTRAL-152/154/159/162).
//
// PURE: no React, no react-native, no expo — so the root jest project runs it,
// which is where every rule below is actually enforced rather than looked at
// in a screenshot.
//
// ── the three rules this file exists to hold ──────────────────────────────
//
// 1. DERIVED AND DECLARED NEVER LOOK ALIKE (ASTRAL-160). "Your chart
//    suggested this" and "you chose this" are different statements, and a
//    screen that renders them with the same pixels has quietly told the user
//    they said something they did not. Provenance drives a caption, always.
//
// 2. A PROPOSAL IS NOT A PREFERENCE (AMB-29). What the chart derived is
//    shown with its basis and is INACTIVE until the user accepts it. This
//    module keeps the two lists apart and never merges them.
//
// 3. THE FREE-TEXT NOTE IS THE USER'S OWN WORDS AND NOTHING ELSE
//    (AMB-32(c)). It is stored, shown back, visually distinct, and labelled
//    as unscored. It is never turned into a sentence — this file quotes it
//    and no function here composes with it.
//
// Nothing here computes an order, a score or a rule: the ordering ran on the
// server and its rule arrived as a sentence (ASTRAL-157). A client that
// re-derived either would be a second source of truth for the one thing the
// user is being asked to trust.

import { splitIsoInstant } from '@wealthai/astral';

import type {
  PrioritiesResponse,
  PriorityEntry,
  PriorityProposal,
  StatedInterest,
} from './people-shapes';

/**
 * ASTRAL-160's vocabulary, said in a caption.
 *
 * An unknown provenance falls to the neutral sentence rather than to "you
 * chose this": "I do not know where this came from" and "the user said it"
 * are different statements, and only one of them is safe to show.
 */
const PROVENANCE_PHRASE: Record<string, string> = {
  user_set: 'set by you',
  accepted_proposal: 'from your chart — you accepted it',
  chart_derived: 'from your chart',
};

export function provenanceCaption(entry: PriorityEntry): string {
  const phrase = PROVENANCE_PHRASE[String(entry.provenance)] ?? 'recorded earlier';
  const basis = (entry.basis ?? '').trim();
  if (!basis) return phrase;
  // docs/49 F55: a basis computed under an older mapping is SAID to be one.
  // The alternative is the field carrying two generations of "your chart
  // says" that look identical, which is the half of ASTRAL-158 that was
  // stamped and not built.
  const stale = entry.basis_stale ? ' · suggested under an earlier mapping' : '';
  return `${phrase} · ${basis}${stale}`;
}

/**
 * The migration, named — ASTRAL-158 / F55.
 *
 * Returns the server's own sentence, or null when the stored set is current.
 * Not composed here: the note is generated beside the comparison that
 * produced it, so a screen cannot describe a migration that did not happen.
 */
export function migrationNotice(data: PrioritiesResponse | null): string | null {
  const note = (data?.mapping?.migration?.note ?? '').trim();
  return note || null;
}

export interface RankedRow {
  key: string;
  /** 1-based, and it is the ONLY number on this screen */
  rank: number;
  label: string;
  caption: string;
  /** true when the chart is behind this entry — drawn differently, never the same */
  fromChart: boolean;
}

export function rankedRows(data: PrioritiesResponse | null): RankedRow[] {
  return (data?.set.ranked ?? []).map((entry, i) => ({
    key: entry.key,
    rank: i + 1,
    label: entry.label || entry.key,
    caption: provenanceCaption(entry),
    fromChart: entry.provenance !== 'user_set',
  }));
}

export interface InterestRow {
  id: string;
  text: string;
  /** the free-text tier, drawn distinctly and never rendered into prose */
  freeText: boolean;
  /** ASTRAL-148's stated absence, on the row that needs it */
  note: string;
}

const NOT_SCORED = 'Not scored by gun milan.';

export function interestRows(data: PrioritiesResponse | null): InterestRow[] {
  return (data?.set.interests ?? []).map((interest: StatedInterest, i) => ({
    id: interest.key ?? `note-${i}`,
    // A declared interest shows its label; a note shows the user's OWN WORDS,
    // quoted, because that is what it is.
    text: interest.free_text ? `“${interest.text}”` : interest.text,
    freeText: !!interest.free_text,
    note: interest.free_text
      ? 'Your own note. Kept and shown to you, never used to write a reading.'
      : NOT_SCORED,
  }));
}

export interface ProposalRow {
  key: string;
  label: string;
  basis: string;
}

/**
 * What the chart suggests, INACTIVE (AMB-29).
 *
 * Every row carries its basis, because "your chart emphasises X" with nothing
 * behind it is the claim check (r) strips out of composed prose — and a
 * screen does not get an exemption from a rule the engine enforces on itself.
 */
export function proposalRows(data: PrioritiesResponse | null): ProposalRow[] {
  const labels = new Map(
    (data?.vocabulary.priorities ?? []).map((row) => [row.key, row.label]),
  );
  return (data?.proposed.entries ?? []).map((entry: PriorityProposal) => ({
    key: entry.key,
    label: labels.get(entry.key) ?? entry.key,
    basis: entry.basis,
  }));
}

/**
 * Why there is nothing to suggest, when there is nothing — ASTRAL-161.
 *
 * Returned only when the derivation produced NO entries. A generic starter
 * set with a chart's name on it is this product's failure mode in miniature,
 * so the honest sentence is the whole of what this screen shows instead.
 */
export function proposalAbsence(data: PrioritiesResponse | null): string | null {
  if (!data) return null;
  if ((data.proposed.entries ?? []).length > 0) return null;
  const reason = (data.proposed.reason ?? '').trim();
  return reason || null;
}

export const EMPTY_TITLE = 'Nothing set yet';
export const EMPTY_BODY =
  'Tell me what matters most to you in a partner and your match reports will ' +
  'lead with it, and your matches list will be ordered by it. Your scores ' +
  'stay exactly as they are.';

/** ASTRAL-154's disclosure, from the server, with the invariant in its
 *  second half. Never rewritten here — the sentence that teaches the rule is
 *  generated from the same mapping that drove the sort. */
export function disclosure(data: PrioritiesResponse | null): string {
  return (data?.disclosure ?? '').trim();
}

export function isEmpty(data: PrioritiesResponse | null): boolean {
  return (
    !data ||
    ((data.set.ranked ?? []).length === 0 && (data.set.interests ?? []).length === 0)
  );
}

/** The one-line summary the Profile row shows before you open the screen. */
export function summary(data: PrioritiesResponse | null): string {
  const ranked = rankedRows(data);
  if (ranked.length === 0) {
    const proposals = proposalRows(data).length;
    return proposals > 0
      ? `Not set — ${proposals} suggested from your chart`
      : 'Not set';
  }
  return ranked.map((r) => r.label.toLowerCase()).join(', then ');
}

/**
 * The engine's prose, as PLAIN TEXT.
 *
 * Seen on the simulator (2026-08-25): the ask's deterministic lines carry
 * markdown emphasis — "- **Prosperity and family welfare** — 7th lord
 * Mercury sits in house 3" — and this screen renders `Text`, not markdown,
 * so the asterisks arrived on screen. The chat surface renders the same
 * prose correctly; this is the ONE place that does not.
 *
 * Emphasis markers and list bullets only. It does not rewrite a word, drop a
 * sentence or reorder anything: the engine's text is the authority and this
 * is a formatting adapter, not an editor.
 */
export function plainText(prose: string): string {
  return (prose ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2')
    .replace(/^[ \t]*[-•]\s+/gm, '')
    .trim();
}

/** When the set was last changed, said plainly or not at all. */
export function updatedLine(data: PrioritiesResponse | null): string | null {
  const when = splitIsoInstant(data?.set.updated_at ?? null);
  return when ? `Last changed ${when.date}` : null;
}
