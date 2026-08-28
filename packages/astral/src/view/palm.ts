/**
 * palm_analysis -> display sections (docs/49 ASTRAL-48/49, ASTRAL-19).
 *
 * The palm is the one artifact in this product whose features come from a
 * MODEL rather than from an ephemeris, and this module's whole job is to make
 * sure a reader can never forget that. Three rules it exists to hold:
 *
 * 1. **The subject and the hand are drawn, not implied** (ASTRAL-49). A
 *    screenshot of an unlabelled palm reading is how the wrong person's
 *    reading gets forwarded, so the heading is on the layer and it is the
 *    engine's `hand_label` — never `hand`, which names a side the engine may
 *    never have established. That confusion is a shipped, reported bug.
 *
 * 2. **Provenance travels with the claim.** `hand_source` decides one
 *    sentence: a `model_guess` hand is discounted ×0.65 by
 *    `adjudication.py:57`, so every verdict the palm touches is weaker, and a
 *    reader who cannot see that is reading a stronger claim than exists.
 *
 * 3. **No lifespan** (docs/49 ASTRAL-40 / ASTRAL-41, D5). The engine still
 *    emits `predictions.lifespan_years` — `palm.py:508` is unchanged, and
 *    ASTRAL-40's ten producing sites are an ENGINE phase this module cannot
 *    reach. What this module can do is what ASTRAL-40's own client obligation
 *    asks for, verbatim: *"Client snapshot: no lifespan chip."* So the
 *    predictions block is not read here AT ALL. It is not filtered field by
 *    field — a filter is one edit away from letting the number back in — the
 *    section simply does not exist, and `predictions` is absent from the
 *    parsed payload's read path below.
 *
 * Nothing here scores, ranks, averages or re-weights. The classical rules are
 * shown in the order `palm_rules.evaluate` fired them, grouped by the domain
 * key the engine assigned, and a rule that arrived without its citation was
 * already dropped by the parser.
 */

import { keyAsWords, titleCase } from '../format';
import type {
  PalmAnalysisPayload,
  PalmClassicalRule,
  PalmHand,
  PalmLine,
  PalmMount,
} from '../payloads';

export interface PalmHeader {
  /** the engine's own heading for this reading */
  label: string;
  /**
   * ONE subtitle, not two fields for a caller to join.
   *
   * Measured on the simulator 2026-08-28: `hand_shape` is `"earth"` and
   * `dominant_element` is `"Earth — a square palm with short, sturdy
   * fingers"`, and a screen that printed `shape · element` read
   * **"Earth · Earth — a square palm…"**. The element sentence usually
   * OPENS with the shape word, so the two are the same fact at two lengths.
   * Deciding which to show is a decision, so it is made here and tested,
   * rather than left to each surface to get right.
   */
  subtitle: string | null;
  /**
   * How the hand was established, in a sentence a reader can act on — or
   * null when the engine stamped a source that needs no caveat.
   */
  provenance: string | null;
  /** true when the source was a model guess: the caveat is not decoration */
  discounted: boolean;
  /** "Both hands read as a pair" when two hands were filed as two */
  pairing: string | null;
}

export interface PalmLineRow {
  name: string;
  description: string | null;
  interpretation: string | null;
}

export interface PalmMountRow {
  name: string;
  /** "Prominent" — the engine's own word, re-cased */
  prominence: string | null;
  interpretation: string | null;
}

export interface PalmRuleRow {
  ruleId: string;
  claim: string;
  citation: string;
  /** "Favorable" / "Unfavorable" — verbatim, re-cased */
  polarity: string | null;
  /** the features that matched, printed as the engine keyed them */
  matched: string[];
}

export interface PalmRuleGroup {
  /** "Marriage Family" — the engine's domain key, punctuated */
  domain: string;
  rules: PalmRuleRow[];
}

export interface PalmHandTab {
  /** the role as a heading, or the side when no role was stated */
  label: string;
  role: string | null;
  side: string | null;
  reading: string | null;
  lines: PalmLineRow[];
  mounts: PalmMountRow[];
  markings: string[];
}

/**
 * What the classical layer ABSTAINED on, said out loud.
 *
 * `abstained_count` is the number of Dale's rules that had no opinion about
 * this hand. It is printed because a reading that shows seven fired rules and
 * hides thirty-one silent ones reads as a complete examination, and it is
 * not one.
 */
export interface PalmMargin {
  source: string | null;
  firedCount: number;
  abstained: number | null;
  suppressed: number | null;
}

export function palmHeader(payload: PalmAnalysisPayload): PalmHeader {
  const source = payload.hand_source;
  const guessed = source === 'model_guess';
  const unverified = source === 'thumb_geometry_unverified';
  const shape = titleCase(payload.hand_shape);
  const element = payload.dominant_element;
  return {
    label: payload.hand_label ?? '',
    subtitle: handSubtitle(shape, element),
    provenance: guessed
      ? 'Which hand this is was the model’s best guess, not something you told '
        + 'us — so every reading below is weighted down for it.'
      : unverified
        ? 'Which hand this is was read from the thumb’s position in the photo '
          + 'and could not be confirmed.'
        : source === 'thumb_geometry'
          ? 'Which hand this is was read from the thumb’s position in the photo.'
          : source === 'declared'
            ? 'You told us which hand this is.'
            : null,
    discounted: guessed,
    pairing: payload.both_hands
      ? 'Both hands were read: the non-dominant hand as what was inherited, '
        + 'the dominant hand as what you have made of it.'
      : null,
  };
}

/**
 * The shape and the element, without saying the same word twice.
 *
 * The element sentence wins when it already carries the shape ("Earth — a
 * square palm…"); otherwise the two are genuinely different facts and are
 * shown together. A shape alone becomes "Earth hand", because "Earth" on its
 * own beside a hand label reads as a category with no noun.
 */
export function handSubtitle(shape: string | null, element: string | null): string | null {
  if (!element) return shape ? `${shape} hand` : null;
  if (!shape) return element;
  return element.toLowerCase().startsWith(shape.toLowerCase())
    ? element
    : `${shape} · ${element}`;
}

function lineRow(line: PalmLine): PalmLineRow {
  return {
    name: line.name,
    description: line.description,
    interpretation: line.interpretation,
  };
}

function mountRow(mount: PalmMount): PalmMountRow {
  return {
    name: mount.name,
    prominence: titleCase(mount.prominence),
    interpretation: mount.interpretation,
  };
}

export function palmLines(payload: PalmAnalysisPayload): PalmLineRow[] {
  return payload.lines.map(lineRow);
}

export function palmMounts(payload: PalmAnalysisPayload): PalmMountRow[] {
  return payload.mounts.map(mountRow);
}

export function palmMarkings(payload: PalmAnalysisPayload): string[] {
  return payload.special_markings;
}

/**
 * The classical rules, grouped by the engine's domain key.
 *
 * Order is preserved twice over: groups appear in the order their first rule
 * fired, and rules within a group keep their fired order. Nothing is sorted
 * by polarity or by strength — a client that put the favourable rules first
 * would be editing the reading.
 */
export function palmRuleGroups(payload: PalmAnalysisPayload): PalmRuleGroup[] {
  const rules = payload.classical_rules?.fired ?? [];
  const order: string[] = [];
  const byDomain = new Map<string, PalmRuleRow[]>();
  for (const rule of rules) {
    const domain = keyAsWords(rule.domain) ?? 'Other';
    if (!byDomain.has(domain)) {
      byDomain.set(domain, []);
      order.push(domain);
    }
    byDomain.get(domain)!.push(ruleRow(rule));
  }
  return order.map((domain) => ({ domain, rules: byDomain.get(domain) ?? [] }));
}

function ruleRow(rule: PalmClassicalRule): PalmRuleRow {
  return {
    ruleId: rule.rule_id,
    claim: rule.claim,
    citation: rule.citation,
    polarity: keyAsWords(rule.polarity),
    matched: rule.matched,
  };
}

export function palmMargin(payload: PalmAnalysisPayload): PalmMargin | null {
  const cr = payload.classical_rules;
  if (!cr) return null;
  return {
    source: cr.source,
    firedCount: cr.fired.length,
    abstained: cr.abstained_count,
    suppressed: cr.suppressed_matches,
  };
}

/**
 * The per-hand tabs of a two-hand reading.
 *
 * Returns [] for a single-hand reading rather than one tab: one tab is a
 * control that does nothing, and the combined sections above already are
 * that hand.
 */
export function palmHandTabs(payload: PalmAnalysisPayload): PalmHandTab[] {
  if (!payload.both_hands || payload.hands.length < 2) return [];
  return payload.hands.map(handTab);
}

function handTab(hand: PalmHand): PalmHandTab {
  const role = keyAsWords(hand.hand_role);
  const side = titleCase(hand.hand);
  return {
    // The role is what a palmist means; the side is what a camera saw. When
    // the user labelled the photo by role, the role IS the identity (bug
    // 8dc95a6a) — so it leads, and the side rides along in brackets.
    label: role ? (side ? `${role} (${side})` : role) : (side ?? 'This hand'),
    role,
    side,
    reading: hand.overall_reading,
    lines: hand.lines.map(lineRow),
    mounts: hand.mounts.map(mountRow),
    markings: hand.special_markings,
  };
}

/**
 * The reading's prose, in the order a reader meets it: the answer to what
 * they actually asked, then the summary.
 *
 * `direct_answer` is empty for "just read my palm" (the vision prompt says
 * so), and an empty string is not a paragraph.
 */
export function palmProse(payload: PalmAnalysisPayload): {
  directAnswer: string | null;
  summary: string | null;
} {
  return {
    directAnswer: payload.direct_answer,
    summary: payload.overall_reading,
  };
}
