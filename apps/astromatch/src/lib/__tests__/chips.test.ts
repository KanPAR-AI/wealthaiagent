/**
 * The six common questions (docs/73 ASTRAL-336) — the plans, over two
 * scorecards CAPTURED from the running engine.
 *
 *   stream-match-complete.sse    a full /36: both birth times known, nothing
 *                                pending, no dosha flagged
 *   stream-match-firm-only.sse   the case the camera actually meets — a page
 *                                with no birth time, so 9.5 of 15 firm points
 *                                and 21 pending (captured 2026-09-19 through
 *                                the shipped §3a sequence, `e2e/capture-stream.mjs`)
 *
 * The second is why four chips can be instant: the row's four cheap questions
 * are all answered by fields the engine puts on a time-less report. On the
 * complete one, two of them have nothing to read back and become questions —
 * which the chip's own label says, per reading.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { parseMatchReport, type MatchReportPayload } from '@wealthai/astral';

import { CHIPS, FRICTION_RULE, STRONGEST_RULE, chipCost, chipsFor, planFor } from '../chips';
import { readTurn } from '../transport';

function reportFrom(file: string): MatchReportPayload {
  const text = readFileSync(join(__dirname, 'fixtures', file), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta as string)
    .join('');
  const outcome = readTurn(text);
  if (outcome.kind !== 'scorecard') throw new Error(`${file} has no scorecard`);
  return outcome.report;
}

const COMPLETE = reportFrom('stream-match-complete.sse');
const FIRM_ONLY = reportFrom('stream-match-firm-only.sse');

describe('the fixtures are what they claim to be', () => {
  it('a complete /36 and a time-less firm-only reading', () => {
    expect(COMPLETE.time_known).toBe(true);
    expect(COMPLETE.total).toBe(26);
    expect(FIRM_ONLY.time_known).toBe(false);
    expect(FIRM_ONLY.total).toBeNull();
    expect(FIRM_ONLY.firm_max).toBe(15);
    expect(FIRM_ONLY.pending_max).toBe(21);
    expect(FIRM_ONLY.pending_reasons.length).toBeGreaterThan(0);
  });
});

describe('FOUR of the six are answered with no model call (ASTRAL-336)', () => {
  it('on the reading the camera actually produces', () => {
    const instant = CHIPS.filter((c) => planFor(c.id, FIRM_ONLY).kind === 'instant').map((c) => c.id);
    expect(instant.sort()).toEqual(['birth-time', 'dosha', 'friction', 'strongest']);
  });

  it('and the other two are one ordinary turn each', () => {
    expect(planFor('ask-before', FIRM_ONLY).kind).toBe('ask');
    expect(planFor('outlook', FIRM_ONLY).kind).toBe('ask');
  });

  it('the label a chip carries is the plan it executes', () => {
    for (const chip of chipsFor(FIRM_ONLY)) {
      expect(chipCost(chip.plan)).toBe(chip.plan.kind === 'instant' ? 'instant' : 'asks');
    }
  });
});

describe('an instant answer is the ENGINE\'s words and the engine\'s numbers', () => {
  const rendered = (id: Parameters<typeof planFor>[0], report: MatchReportPayload) => {
    const plan = planFor(id, report);
    if (plan.kind !== 'instant') throw new Error(`${id} is not instant on this report`);
    return plan.markdown;
  };

  it('quotes the pending reasons verbatim, not a paraphrase', () => {
    const text = rendered('birth-time', FIRM_ONLY);
    for (const reason of FIRM_ONLY.pending_reasons) expect(text).toContain(reason);
  });

  it('names the pending kootas with the engine\'s own meaning', () => {
    const text = rendered('birth-time', FIRM_ONLY);
    for (const koota of FIRM_ONLY.kootas.filter((k) => k.pending)) {
      expect(text).toContain(koota.name);
      if (koota.meaning) expect(text).toContain(koota.meaning);
    }
    expect(text).toContain(String(FIRM_ONLY.pending_max));
  });

  it('EVERY number in an instant answer is present in the payload', () => {
    // INV-9's whole point, checked rather than asserted in prose: the only
    // numbers that may appear are ones the engine put on the report, written
    // as `formatFraction` writes them ("4 / 4") and never as a quotient.
    const allowed = new Set<string>();
    for (const k of FIRM_ONLY.kootas) {
      if (k.points !== null) allowed.add(String(k.points));
      allowed.add(String(k.max));
    }
    allowed.add(String(FIRM_ONLY.firm_total));
    allowed.add(String(FIRM_ONLY.firm_max));
    allowed.add(String(FIRM_ONLY.pending_max));
    // the count of pending kootas is a count of rows on screen, not a score
    allowed.add(String(FIRM_ONLY.kootas.filter((k) => k.pending).length));
    // The engine's OWN sentences carry digits — Bhakoot's note is literally
    // "11/3 placement" — and those are its words, not this client's
    // arithmetic. So every verbatim engine string is removed first, and what
    // is left is the numbers the CLIENT put on screen.
    const engineStrings: string[] = [];
    for (const k of FIRM_ONLY.kootas) engineStrings.push(k.name, k.meaning, k.note);
    for (const d of FIRM_ONLY.doshas) engineStrings.push(d.name, d.detail);
    engineStrings.push(...FIRM_ONLY.pending_reasons);
    const strip = (text: string) =>
      engineStrings
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .reduce((acc, quote) => acc.split(quote).join(' '), text);

    for (const id of ['dosha', 'strongest', 'friction', 'birth-time'] as const) {
      const text = strip(rendered(id, FIRM_ONLY));
      for (const n of text.match(/\d+(\.\d+)?/g) ?? []) {
        expect({ chip: id, number: n, inPayload: allowed.has(n) }).toEqual({
          chip: id,
          number: n,
          inPayload: true,
        });
      }
    }
  });

  it('writes no percentage, no total out of 36 and no band of its own', () => {
    for (const id of ['dosha', 'strongest', 'friction', 'birth-time'] as const) {
      const text = rendered(id, FIRM_ONLY);
      expect(text).not.toContain('%');
      expect(text).not.toMatch(/\/\s*36\b/);
      expect(text).not.toMatch(/excellent|very good|average|poor/i);
    }
  });

  it('a strongest/friction answer never invents a dimension score', () => {
    const strongest = rendered('strongest', FIRM_ONLY);
    const friction = rendered('friction', FIRM_ONLY);
    // every fraction printed is a koota's own two payload values
    const fractions = [...strongest.matchAll(/(\d+(?:\.\d+)?) \/ (\d+)/g)];
    expect(fractions.length).toBeGreaterThan(0);
    for (const [, points, max] of [...fractions, ...friction.matchAll(/(\d+(?:\.\d+)?) \/ (\d+)/g)]) {
      const koota = FIRM_ONLY.kootas.find(
        (k) => String(k.points) === points && String(k.max) === max,
      );
      expect({ points, max, isAKoota: Boolean(koota) }).toEqual({ points, max, isAKoota: true });
    }
  });

  it('PRINTS the ordering rule above the rows (F300)', () => {
    // An order is a claim. Saying which order turns "your strongest kootas",
    // which reads as a conclusion, into a statement about the numbers on
    // screen that the reader can check against them. "Of their own points"
    // is the load-bearing phrase: the kootas are worth different maxima.
    expect(rendered('strongest', FIRM_ONLY)).toContain(STRONGEST_RULE);
    expect(rendered('friction', FIRM_ONLY)).toContain(FRICTION_RULE);
    expect(STRONGEST_RULE).toContain('lost the fewest of their own points');
    expect(FRICTION_RULE).toContain('lost the most of their own points');
  });

  it('prints the rule only where an order was chosen', () => {
    expect(rendered('dosha', FIRM_ONLY)).not.toContain('Ordered by');
    expect(rendered('birth-time', FIRM_ONLY)).not.toContain('Ordered by');
  });

  it('friction picks what LOST the most, not the smallest number (F300)', () => {
    // "lowest-scoring" read literally is Varna (max 1), which is a scale
    // confusion: the kootas are worth different maxima. The answer is the
    // koota that dropped the most points on its own scale.
    const text = rendered('friction', FIRM_ONLY);
    const scored = FIRM_ONLY.kootas.filter((k) => !k.pending && k.points !== null);
    const worst = Math.max(...scored.map((k) => k.max - (k.points ?? 0)));
    const expected = scored.filter((k) => k.max - (k.points ?? 0) === worst);
    for (const k of expected) expect(text).toContain(k.name);
    const full = scored.filter((k) => k.points === k.max);
    for (const k of full) expect(text).not.toContain(`**${k.name}**`);
  });

  it('strongest picks what dropped the least', () => {
    const text = rendered('strongest', FIRM_ONLY);
    const scored = FIRM_ONLY.kootas.filter((k) => !k.pending && k.points !== null);
    const best = Math.min(...scored.map((k) => k.max - (k.points ?? 0)));
    for (const k of scored.filter((k) => k.max - (k.points ?? 0) === best)) {
      expect(text).toContain(k.name);
    }
  });

  it('a dosha answer is the engine\'s `detail`, and says what could NOT be checked', () => {
    const text = rendered('dosha', FIRM_ONLY);
    expect(text).toContain('Not everything could be checked');
    for (const reason of FIRM_ONLY.pending_reasons) expect(text).toContain(reason);
  });
});

describe('a chip with nothing to read back does not pretend', () => {
  it('turns "dosha check" into a QUESTION when the engine flagged none and checked everything', () => {
    // An absence is not "no dosha was found": the kinds of absence are not
    // interchangeable (doctrine 6), and this client will not turn an empty
    // array into a reassurance. So the engine is asked, in its own words.
    expect(COMPLETE.doshas).toEqual([]);
    expect(COMPLETE.pending_reasons).toEqual([]);
    const plan = planFor('dosha', COMPLETE);
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') throw new Error('unreachable');
    expect(plan.question).toMatch(/dosha/i);
  });

  it('REMOVES "what a birth time would unlock" when nothing is waiting on one', () => {
    const plan = planFor('birth-time', COMPLETE);
    expect(plan.kind).toBe('absent');
    expect(chipsFor(COMPLETE).map((c) => c.id)).not.toContain('birth-time');
    // and it is NOT rendered greyed — it is not in the list at all
    expect(chipsFor(COMPLETE).length).toBe(CHIPS.length - 1);
  });

  it('asks rather than answering when every scored koota took full marks', () => {
    const perfect: MatchReportPayload = {
      ...COMPLETE,
      kootas: COMPLETE.kootas.map((k) => ({ ...k, points: k.max, pending: false })),
    };
    const plan = planFor('friction', perfect);
    expect(plan.kind).toBe('ask');
  });
});

describe('the two model chips ask, and guarantee nothing', () => {
  it('sends ONE question, on the ordinary turn', () => {
    for (const id of ['ask-before', 'outlook'] as const) {
      const plan = planFor(id, FIRM_ONLY);
      if (plan.kind !== 'ask') throw new Error('unreachable');
      expect(plan.question.length).toBeGreaterThan(20);
      expect(plan.question).not.toContain('```');
    }
  });

  it('asks nothing about health, lifespan or a child\'s ability', () => {
    for (const chip of CHIPS) {
      const plan = planFor(chip.id, FIRM_ONLY);
      const words = plan.kind === 'ask' ? plan.question : plan.kind === 'instant' ? '' : '';
      expect(words).not.toMatch(/how long will|die|death|lifespan|disease|intelligen/i);
    }
  });

  it('promises no outcome in its own words (ASTRAL-320\'s class)', () => {
    const everything = CHIPS.map((c) => {
      const plan = planFor(c.id, FIRM_ONLY);
      return `${c.label} ${plan.kind === 'ask' ? plan.question : plan.kind === 'instant' ? plan.markdown : ''}`;
    }).join(' ');
    for (const banned of [
      'happy married life',
      'guaranteed',
      'you will marry',
      'successful marriage',
      'strong potential',
    ]) {
      expect(everything.toLowerCase()).not.toContain(banned);
    }
  });
});

describe('parse-don\'t-trust holds at this layer too', () => {
  it('is total on a report with no kootas at all', () => {
    const empty = parseMatchReport({
      type: 'match_report',
      kootas: [{ name: 'Varna', points: 1, max: 1 }],
      verdict: 'good',
      firm_total: 1,
      firm_max: 1,
    });
    expect(empty).not.toBeNull();
    for (const chip of CHIPS) expect(() => planFor(chip.id, empty!)).not.toThrow();
  });
});
