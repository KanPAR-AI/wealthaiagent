/**
 * INV-5 / ASTRAL-16, negative space: no `%` may be produced from a
 * `match_report` payload.
 *
 * The PH-3 gate says Role-4 "confirms by search that '87%' or any computed
 * percentage appears nowhere in the client bundle for this component". This is
 * that search, run in CI on every commit instead of once by hand.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { matchTimedPayload, matchTimelessPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderMatch } from './render-shared';

const CASES: Array<[string, unknown]> = [
  ['a complete 21.5/36 match', matchTimedPayload],
  ['a time-less match', matchTimelessPayload],
  // A perfect score is the payload most likely to tempt a "100%".
  ['a perfect match', { ...matchTimedPayload, total: 36, verdict: 'excellent' }],
];

describe('no percentage is produced from a match_report payload', () => {
  for (const [label, payload] of CASES) {
    for (const width of [PANEL_WIDTH, APP_WIDTH]) {
      it(`${label} at ${width}px renders no "%" character at all`, () => {
        const { container } = renderMatch(payload, width);
        expect(container.textContent ?? '').not.toContain('%');
        // and no percent sign hiding in an attribute (a CSS width, an ARIA
        // valuetext, a title) either
        expect(container.innerHTML).not.toContain('%');
      });

      it(`${label} at ${width}px renders no board-style number`, () => {
        const { container } = renderMatch(payload, width);
        const text = container.textContent ?? '';
        // The mock's four sub-scores and its headline. None of these is a
        // quantity our engine computes.
        for (const banned of ['87', '90', '82', '88', '85']) {
          expect(text).not.toContain(banned);
        }
      });
    }
  }
});

describe('the scorecard source itself contains no percentage arithmetic', () => {
  const sources = [
    'packages/astral/src/components/match-scorecard.tsx',
    'packages/astral/src/view/match.ts',
  ];

  it.each(sources)('%s has no "* 100", "/ 100" or "%%" literal', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8');
    // Comments legitimately DISCUSS the banned 87%, so strip them first and
    // assert on code only.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/\*\s*100/);
    expect(code).not.toMatch(/\/\s*100/);
    expect(code).not.toContain('%');
    expect(code).not.toContain('toFixed');
    expect(code).not.toContain('Math.round');
  });
});
