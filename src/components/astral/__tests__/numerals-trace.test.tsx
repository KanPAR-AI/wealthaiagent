/**
 * ASTRAL-19 — "a test asserts every rendered numeral traces to a payload key".
 *
 * The rule the row states: no client computes, averages, rounds into a new
 * unit, or infers a score, band, orb or sign; formatting is permitted,
 * arithmetic that creates a new claim is not.
 *
 * The check, mechanically: collect every integer that appears in what the user
 * can read, and require each one to be present in the ALLOWED set. The allowed
 * set is built from three sources and nothing else —
 *
 *   (1) the numerals in the payload itself,
 *   (2) the numerals the DECLARED formatters (`format.ts`) produce from the
 *       payload's own numbers — an arcminute half is a re-notation of a
 *       payload degree, not a new number,
 *   (3) the numerals inside DECLARED static copy ("21 of the 36 gunas").
 *
 * A sum, an average, a percentage or a sign-relative degree lands outside all
 * three and fails. This is the test that would have caught "87%".
 */

import {
  formatDegrees,
  formatIsoDate,
  formatPoints,
  formatScore,
  splitIsoInstant,
  NO_BIRTH_TIME_REASON,
} from '@wealthai/astral';
import {
  matchTimedPayload,
  matchTimelessPayload,
  muhurtaPayload,
  natalTimedPayload,
  natalTimelessPayload,
} from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderMatch, renderMuhurta, renderNatal } from './render-shared';

/**
 * Numeric tokens, decimals kept whole.
 *
 * Whole decimals matter: splitting "0.88" into 0 and 88 would let a muhurta
 * score rendered as "88" (i.e. rescaled into percent) pass by borrowing the
 * digits of its own un-rescaled value. Normalised through `Number` so "05"
 * and "5" are the same token and "2.0" and "2" are the same token.
 */
function numerals(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

/**
 * Text as a user reads it, one node at a time.
 *
 * NOT `container.textContent`: that concatenates adjacent elements with no
 * separator, so the twelve house numerals in the diamond come back as the
 * single token "1234...". Joining per text node keeps each rendered numeral
 * its own token — this cost a debugging round and is worth the comment.
 */
function visibleText(container: HTMLElement): string {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let node = walker.nextNode();
  while (node) {
    parts.push(node.textContent ?? '');
    node = walker.nextNode();
  }
  return parts.join(' \u0000 ');
}

/** Every scalar leaf of a payload, in order. */
function leaves(value: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const v of value) leaves(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) leaves(v, out);
  } else {
    out.push(value);
  }
  return out;
}

/**
 * Static copy that legitimately contains a numeral. Each entry is a sentence
 * a human wrote, not a value computed from the payload — and each is listed
 * here explicitly so adding one is a deliberate act.
 */
const DECLARED_COPY = [
  NO_BIRTH_TIME_REASON,
  'A birth time is missing, so the four nakshatra kootas were not scored.',
];

function allowedNumerals(payload: unknown): Set<string> {
  const allowed = new Set<string>();
  const add = (text: string | null | undefined) => {
    if (text) for (const n of numerals(text)) allowed.add(n);
  };

  add(JSON.stringify(payload));
  for (const copy of DECLARED_COPY) add(copy);

  for (const leaf of leaves(payload)) {
    add(formatDegrees(leaf));
    add(formatPoints(leaf));
    add(formatScore(leaf));
    if (typeof leaf === 'string') {
      add(formatIsoDate(leaf));
      const instant = splitIsoInstant(leaf);
      if (instant) {
        add(instant.date);
        add(instant.time);
      }
    }
  }
  return allowed;
}

function assertEveryNumeralTraces(rendered: string, payload: unknown) {
  const allowed = allowedNumerals(payload);
  const untraceable = numerals(rendered).filter((n) => !allowed.has(n));
  expect(untraceable).toEqual([]);
}

const CASES: Array<[string, unknown, (p: unknown, w: number) => { container: HTMLElement }]> = [
  ['natal_chart (timed)', natalTimedPayload, renderNatal],
  ['natal_chart (time-less)', natalTimelessPayload, renderNatal],
  ['match_report (complete)', matchTimedPayload, renderMatch],
  ['match_report (time-less)', matchTimelessPayload, renderMatch],
  ['muhurta_results', muhurtaPayload, renderMuhurta],
];

describe('ASTRAL-19 — every rendered numeral traces to a payload key', () => {
  for (const [label, payload, renderer] of CASES) {
    for (const width of [PANEL_WIDTH, APP_WIDTH]) {
      it(`${label} at ${width}px invents no number`, () => {
        const { container } = renderer(payload, width);
        assertEveryNumeralTraces(visibleText(container), payload);
      });
    }
  }
});

describe('the check itself has teeth', () => {
  // Scope, stated honestly: this test catches a numeral that is ABSENT from
  // the payload's digit vocabulary — which is what a percentage, an average or
  // an invented scale looks like. A small integer that happens to coincide
  // with a payload value (a koota `max`, say) can slip through it, which is
  // why the targeted assertions in `match-scorecard.test.tsx` — "never SUMS a
  // two-koota dimension", "prints NO /36 total" — sit alongside it rather than
  // being folded into it.
  it('rejects a percentage', () => {
    expect(() => assertEveryNumeralTraces('Strong Match 87%', matchTimedPayload)).toThrow();
  });

  it('rejects an averaged score on an invented scale', () => {
    expect(() =>
      assertEveryNumeralTraces('Compatibility 62 out of 100', matchTimedPayload),
    ).toThrow();
  });

  it('rejects a rounded-to-a-new-unit muhurta score', () => {
    // 0.88 -> "88%" is the tempting one. 88 is not a number this payload has.
    expect(() => assertEveryNumeralTraces('Score 88', muhurtaPayload)).toThrow();
  });

  it('accepts the arcminute re-notation of a payload degree', () => {
    expect(() =>
      assertEveryNumeralTraces(formatDegrees(85.25)!, natalTimedPayload),
    ).not.toThrow();
  });
});
