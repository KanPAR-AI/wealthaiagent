/**
 * The palm block — parser and view model (docs/49 ASTRAL-48/49, ASTRAL-40).
 *
 * Read against `fixtures/payloads.ts`'s `palmTwoHandPayload`, whose exact
 * provenance is stated in that file's header: the vision pass could not be
 * driven live for want of a photograph, everything downstream of it was.
 *
 * Every assertion below is about a property the row states, not about the
 * fixture's prose. The two that would be easiest to lose in a refactor and
 * are therefore asserted hardest: no lifespan reaches the view, and the
 * heading is never the raw `hand`.
 */

import { parsePalmAnalysis } from '../payloads';
import {
  handSubtitle,
  palmHandTabs,
  palmHeader,
  palmLines,
  palmMargin,
  palmMarkings,
  palmMounts,
  palmProse,
  palmRuleGroups,
} from '../view/palm';
import { palmTwoHandPayload } from '../fixtures/payloads';

const parsed = parsePalmAnalysis(palmTwoHandPayload)!;

describe('parsePalmAnalysis — the captured two-hand reading', () => {
  it('parses', () => {
    expect(parsed).not.toBeNull();
  });

  it('carries the engine-computed heading, not a client-built one', () => {
    expect(parsed.hand_label).toBe('Dominant Hand (Right)');
  });

  it('carries the exit contract GR-12a stamps: hand and hand_source', () => {
    expect(parsed.hand).toBe('right');
    expect(parsed.hand_source).toBe('declared');
  });

  it('files two hands as a PAIR, each under its own role', () => {
    expect(parsed.both_hands).toBe(true);
    expect(parsed.hands).toHaveLength(2);
    expect(parsed.hands.map((h) => h.hand_role)).toEqual(['dominant', 'non_dominant']);
  });

  it('carries the classical layer with citations and its abstention count', () => {
    const cr = parsed.classical_rules!;
    expect(cr.fired.length).toBeGreaterThan(0);
    expect(cr.abstained_count).toBeGreaterThan(0);
    expect(cr.source).toContain('Dale');
    for (const rule of cr.fired) expect(rule.citation).toBeTruthy();
  });

  // PARSE, DON'T TRUST — the four negative cases the row's negative space
  // names, each returning null rather than a partial object.
  it('refuses a block of the wrong type', () => {
    expect(parsePalmAnalysis({ ...palmTwoHandPayload, type: 'natal_chart' })).toBeNull();
  });

  it('refuses a reading with no hand_label rather than falling back to `hand`', () => {
    // The fallback IS the reported bug: a heading naming a side the engine
    // never established. A reading that cannot say whose hand it is, is not
    // rendered as a reading.
    const { hand_label, ...rest } = palmTwoHandPayload as Record<string, unknown>;
    expect(hand_label).toBeTruthy();
    expect(parsePalmAnalysis({ ...rest, hand: 'left' })).toBeNull();
  });

  it('refuses a reading with nothing to read', () => {
    expect(
      parsePalmAnalysis({
        type: 'palm_analysis',
        hand_label: 'Dominant Hand',
        lines: [],
        mounts: [],
        special_markings: [],
        overall_reading: null,
      }),
    ).toBeNull();
  });

  it('drops a classical rule that arrived without its citation', () => {
    const cr = palmTwoHandPayload.classical_rules;
    const maimed = {
      ...palmTwoHandPayload,
      classical_rules: {
        ...cr,
        fired: [...cr.fired.map((r, i) => (i === 0 ? { ...r, citation: '' } : r))],
      },
    };
    const out = parsePalmAnalysis(maimed)!;
    expect(out.classical_rules!.fired).toHaveLength(cr.fired.length - 1);
  });

  it('drops a line with no name rather than rendering an unnamed one', () => {
    const out = parsePalmAnalysis({
      ...palmTwoHandPayload,
      lines: [...palmTwoHandPayload.lines, { description: 'a crease', interpretation: 'x' }],
    })!;
    expect(out.lines).toHaveLength(palmTwoHandPayload.lines.length);
  });
});

describe('the view model derives nothing and invents nothing', () => {
  it('draws the ENGINE heading', () => {
    expect(palmHeader(parsed).label).toBe(parsed.hand_label);
  });

  /**
   * Found on the simulator, 2026-08-28: the header printed
   * **"Earth · Earth — a square palm with short, sturdy fingers"**, because
   * `hand_shape` is `"earth"` and `dominant_element` OPENS with the same
   * word. Two payload fields, one fact, said twice.
   */
  it('says the hand shape ONCE', () => {
    const subtitle = palmHeader(parsed).subtitle!;
    expect(subtitle).toBe(parsed.dominant_element);
    expect(subtitle.match(/earth/gi)).toHaveLength(1);
  });

  it('…and keeps both when the element genuinely says something else', () => {
    expect(handSubtitle('Earth', 'Grounded and deliberate')).toBe(
      'Earth · Grounded and deliberate',
    );
  });

  it('a shape with no element becomes a noun, not a bare category', () => {
    expect(handSubtitle('Earth', null)).toBe('Earth hand');
  });

  it('neither field means no subtitle at all — never an empty line', () => {
    expect(handSubtitle(null, null)).toBeNull();
    expect(palmHeader(parsePalmAnalysis({
      ...palmTwoHandPayload, hand_shape: null, dominant_element: null,
    })!).subtitle).toBeNull();
  });

  it('names how the hand was established', () => {
    expect(palmHeader(parsed).provenance).toContain('You told us');
    expect(palmHeader(parsed).discounted).toBe(false);
  });

  it('a model-guessed hand is flagged as discounted, with a sentence', () => {
    const guessed = parsePalmAnalysis({
      ...palmTwoHandPayload,
      hand_source: 'model_guess',
    })!;
    const header = palmHeader(guessed);
    expect(header.discounted).toBe(true);
    expect(header.provenance).toMatch(/guess/i);
    // …and it says the consequence, because the 0.65 discount is invisible
    // otherwise (`adjudication.py:57`).
    expect(header.provenance).toMatch(/weighted down/i);
  });

  it('an unverified thumb-geometry hand says it could not be confirmed', () => {
    const header = palmHeader(
      parsePalmAnalysis({
        ...palmTwoHandPayload,
        hand_source: 'thumb_geometry_unverified',
      })!,
    );
    expect(header.provenance).toMatch(/could not be confirmed/i);
    expect(header.discounted).toBe(false);
  });

  it('says out loud that two hands were read as a pair', () => {
    expect(palmHeader(parsed).pairing).toMatch(/inherited/i);
  });

  it('a single-hand reading claims no pairing and offers no hand tabs', () => {
    const one = parsePalmAnalysis({
      ...palmTwoHandPayload,
      both_hands: false,
      hands: [],
    })!;
    expect(palmHeader(one).pairing).toBeNull();
    expect(palmHandTabs(one)).toEqual([]);
  });

  it('passes lines, mounts and markings through verbatim', () => {
    expect(palmLines(parsed).map((l) => l.name)).toEqual(parsed.lines.map((l) => l.name));
    expect(palmLines(parsed)[0].interpretation).toBe(parsed.lines[0].interpretation);
    expect(palmMounts(parsed).map((m) => m.name)).toEqual(parsed.mounts.map((m) => m.name));
    expect(palmMarkings(parsed)).toEqual(parsed.special_markings);
  });

  it('groups classical rules by the ENGINE domain, in fired order', () => {
    const groups = palmRuleGroups(parsed);
    const fired = parsed.classical_rules!.fired;
    // every fired rule survives grouping, exactly once
    expect(groups.flatMap((g) => g.rules.map((r) => r.ruleId)).sort()).toEqual(
      fired.map((r) => r.rule_id).sort(),
    );
    // and the group order follows first appearance, never polarity
    expect(groups[0].rules[0].ruleId).toBe(fired[0].rule_id);
  });

  /**
   * A weaker version of this test survived a mutation that sorted the rules
   * by polarity, because every rule the engine fired on this hand is
   * `favorable` and the sort was a no-op. So the case is built to be
   * DISCRIMINATING: one engine rule is relabelled to the other polarity the
   * engine emits, and the assertion is over the WHOLE flattened order rather
   * than over the first element.
   */
  it('never re-orders rules by polarity or strength — the reading is not edited', () => {
    const fired = palmTwoHandPayload.classical_rules.fired;
    const mixed = parsePalmAnalysis({
      ...palmTwoHandPayload,
      classical_rules: {
        ...palmTwoHandPayload.classical_rules,
        // the FIRST rule becomes unfavorable: any polarity sort moves it
        fired: fired.map((r, i) => (i === 0 ? { ...r, polarity: 'unfavorable' } : r)),
      },
    })!;
    const drawnOrder = palmRuleGroups(mixed).flatMap((g) => g.rules.map((r) => r.ruleId));
    // grouping re-orders by DOMAIN and nothing else, so the within-domain
    // sequence must still be the engine's
    expect(drawnOrder[0]).toBe(fired[0].rule_id);
    expect(drawnOrder).toEqual(
      palmRuleGroups(mixed).map((g) => g.domain).flatMap((domain) =>
        mixed.classical_rules!.fired
          .filter((r) => palmRuleGroups(mixed).find((g) => g.rules.some((x) => x.ruleId === r.rule_id))?.domain === domain)
          .map((r) => r.rule_id)),
    );
  });

  it('a polarity sort would be VISIBLE — the discriminating case is real', () => {
    const fired = palmTwoHandPayload.classical_rules.fired;
    const polarities = fired.map((r, i) => (i === 0 ? 'unfavorable' : r.polarity));
    // anti-vacuity: sorting these DOES move element 0, so the test above can fail
    const sorted = [...polarities].sort();
    expect(sorted[0]).not.toBe(polarities[0]);
  });

  it('carries every citation onto its own row', () => {
    for (const group of palmRuleGroups(parsed)) {
      for (const rule of group.rules) expect(rule.citation).toBeTruthy();
    }
  });

  it('reports the honesty margin — what abstained, not only what fired', () => {
    const margin = palmMargin(parsed)!;
    expect(margin.firedCount).toBe(parsed.classical_rules!.fired.length);
    expect(margin.abstained).toBe(parsed.classical_rules!.abstained_count);
    expect(margin.suppressed).toBe(parsed.classical_rules!.suppressed_matches);
  });

  it('titles a hand tab by its ROLE, with the side in brackets (bug 8dc95a6a)', () => {
    const tabs = palmHandTabs(parsed);
    expect(tabs).toHaveLength(2);
    expect(tabs[0].label).toBe('Dominant (Right)');
    expect(tabs[1].label).toBe('Non Dominant (Left)');
  });

  it('a hand with no stated role falls back to its side, never to nothing', () => {
    const noRole = parsePalmAnalysis({
      ...palmTwoHandPayload,
      hands: palmTwoHandPayload.hands.map((h) => ({ ...h, hand_role: null })),
    })!;
    expect(palmHandTabs(noRole).map((t) => t.label)).toEqual(['Right', 'Left']);
  });

  it('shows the direct answer only when the user actually asked something', () => {
    expect(palmProse(parsed).directAnswer).toBeNull();
    const asked = parsePalmAnalysis({
      ...palmTwoHandPayload,
      direct_answer: 'Your Fate Line deepens after mid-palm, so the career turn reads as later.',
    })!;
    expect(palmProse(asked).directAnswer).toMatch(/Fate Line/);
  });
});

/**
 * docs/49 ASTRAL-40 / ASTRAL-41 (D5) — the client obligation, verbatim:
 * "Client snapshot: no lifespan chip."
 *
 * The engine still emits `predictions.lifespan_years` (`palm.py:508`), so
 * this is not a test that the payload lacks it — the fixture PROVES the
 * payload has it. It is a test that nothing the client draws reads it.
 */
describe('ASTRAL-40 — no lifespan reaches the surface', () => {
  it('the captured payload does carry one, so this test is not vacuous', () => {
    expect(palmTwoHandPayload.predictions.lifespan_years.value).toBe(87);
  });

  it('the parser does not carry `predictions` at all', () => {
    expect((parsed as unknown as Record<string, unknown>).predictions).toBeUndefined();
  });

  /**
   * The parser is the defence, so this is the test that has to bite. A
   * mutation that made the view reach for `predictions` through the payload
   * survived the first version of this suite — because the parser had
   * already dropped the field, which is the RIGHT design and the wrong
   * reason for a test to pass. So the case below hands the view a payload
   * that still carries predictions and asserts nothing drawn reads them.
   */
  it('a view handed a payload that STILL carries predictions draws none of it', () => {
    const withPredictions = {
      ...parsed,
      predictions: palmTwoHandPayload.predictions,
    } as unknown as Parameters<typeof palmHeader>[0];
    const drawn = JSON.stringify([
      palmHeader(withPredictions),
      palmLines(withPredictions),
      palmMounts(withPredictions),
      palmMarkings(withPredictions),
      palmRuleGroups(withPredictions),
      palmMargin(withPredictions),
      palmHandTabs(withPredictions),
      palmProse(withPredictions),
    ]);
    expect(drawn).not.toContain('87');
    expect(drawn).not.toMatch(/lifespan/i);
    expect(drawn).not.toMatch(/\b\d{2}\s*years\b/i);
  });

  it('no view-model output mentions a lifespan, an age or a year count', () => {
    const drawn = JSON.stringify([
      palmHeader(parsed),
      palmLines(parsed),
      palmMounts(parsed),
      palmMarkings(parsed),
      palmRuleGroups(parsed),
      palmMargin(parsed),
      palmHandTabs(parsed),
      palmProse(parsed),
    ]);
    expect(drawn).not.toMatch(/lifespan/i);
    expect(drawn).not.toMatch(/life expectancy/i);
    expect(drawn).not.toMatch(/\b\d{2}\s*years\b/i);
    expect(drawn).not.toContain('87');
  });

  it('and the marriage/children/wealth chips do not either — the whole block '
    + 'is unread, not filtered field by field', () => {
    const drawn = JSON.stringify([palmHeader(parsed), palmRuleGroups(parsed)]);
    expect(drawn).not.toMatch(/marriage_age|children_count|career_peak|wealth_peak/);
  });
});
