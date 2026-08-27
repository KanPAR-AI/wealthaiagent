/**
 * docs/49 PH-27 — the scorecard, native (ASTRAL-232 / ASTRAL-241).
 *
 * The fixture is a REAL capture of `GET /people/matches/{pair_key}` over a
 * `compute_gun_milan` scorecard the engine actually produced — so the test
 * that matters most, "the payload parses with the EXISTING parser and no
 * changes to it", is asserted against what the wire really carries.
 */

import fs from 'fs';
import path from 'path';

import { parseMatchReport } from '@wealthai/astral';

import {
  ASK_AI_LABEL,
  askTurn,
  detailState,
  freshnessSentence,
  header,
  refusal,
  report,
} from '../match-detail-view';
import type { MatchDetail } from '../people-shapes';

const codeOf = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, '..', '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DETAIL = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'match.json'), 'utf8'),
) as MatchDetail & { _capture: unknown };

describe('ASTRAL-232 — the read is the payload the renderer already parses', () => {
  it('parses with the EXISTING parser, unchanged', () => {
    // The compatibility IS the test: a second payload shape would be a
    // second scorecard contract with the renderer between them.
    const parsed = parseMatchReport(DETAIL.report);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('match_report');
    expect(parsed!.kootas.length).toBeGreaterThan(0);
  });

  it('every koota keeps the engine’s own points', () => {
    const parsed = parseMatchReport(DETAIL.report)!;
    parsed.kootas.forEach((koota, i) => {
      const raw = DETAIL.report!.kootas[i];
      expect(koota.name).toBe(raw.name);
      expect(koota.points).toBe(raw.points);
      expect(koota.max).toBe(raw.max);
    });
  });

  it('the verdict is the engine’s word, verbatim', () => {
    expect(parseMatchReport(DETAIL.report)!.verdict).toBe(DETAIL.report!.verdict);
  });

  it('carries the name, joined at read', () => {
    expect(header(DETAIL).name).toBe(DETAIL.display_name);
    expect(DETAIL.display_name).toBeTruthy();
  });

  it('names the scale this match is on', () => {
    expect(header(DETAIL).scale).toBeTruthy();
  });

  it('says when it was computed', () => {
    expect(header(DETAIL).computed).toMatch(/\d{4}/);
  });
});

describe('ASTRAL-241 — what the surface may not do', () => {
  const parsed = parseMatchReport(DETAIL.report)!;

  it('no percentage anywhere in what it renders', () => {
    const text = JSON.stringify(parsed);
    expect(text).not.toContain('%');
  });

  it('a pending koota renders its reason and NO number', () => {
    const firmOnly: MatchDetail = {
      ...DETAIL,
      group: 'firm_only',
      report: {
        ...DETAIL.report!,
        total: null,
        max_total: null,
        kootas: DETAIL.report!.kootas.map((k, i) => (i === 0
          ? { ...k, pending: true, points: null,
              note: 'not scored without a birth time' }
          : k)),
      },
    };
    const card = parseMatchReport(report(firmOnly))!;
    expect(card.kootas[0].pending).toBe(true);
    expect(card.kootas[0].points).toBeNull();
    expect(card.kootas[0].note).toBeTruthy();
    // …and no /36 is synthesised for it.
    expect(card.total).toBeNull();
    expect(header(firmOnly).scale).toContain('21 of the 36');
  });

  it('a refusal is the whole answer — no card, no zero', () => {
    const refused: MatchDetail = {
      ...DETAIL,
      group: 'refused',
      report: undefined,
      refusal: { reason: 'her Moon could be in either of two rashis',
                 ask: 'Do you know her birth time?' },
    };
    expect(detailState(refused)).toBe('refused');
    expect(report(refused)).toBeNull();
    expect(refusal(refused)!.reason).toContain('two rashis');
    expect(refusal(refused)!.ask).toBeTruthy();
  });

  it('a stale match keeps its numbers and says so', () => {
    const stale: MatchDetail = { ...DETAIL, freshness: 'stale' };
    expect(freshnessSentence(stale)).toContain('scored with');
    expect(parseMatchReport(report(stale))!.total).toBe(DETAIL.report!.total);
  });

  it('a fresh match has nothing to say about freshness', () => {
    expect(freshnessSentence({ ...DETAIL, freshness: 'fresh' })).toBeNull();
  });

  it('the ONE chat affordance carries a name and no birth fact', () => {
    const turn = askTurn(DETAIL);
    expect(turn).toContain(DETAIL.display_name);
    // Nothing that could be a birth fact rides the handoff.
    expect(turn).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(turn).not.toMatch(/\d{1,2}:\d{2}/);
    expect(ASK_AI_LABEL).toBe('Ask AI about this match');
  });

  it('the scorecard screen has exactly ONE chat entry point', () => {
    // Structural, because "for convenience" is how a native surface becomes
    // a chat launcher again one commit at a time.
    const code = codeOf('app/match.tsx');
    const pushes = code.match(/pathname:\s*'\/chat'/g) ?? [];
    expect(pushes).toHaveLength(1);
    // …and exactly one control that reaches it: `askAi` is defined once and
    // called once, and its label is the DECLARED export rather than a
    // sentence typed into the screen (a second literal is a second
    // affordance waiting to be wired).
    expect(code.match(/const askAi =/g) ?? []).toHaveLength(1);
    expect(code.match(/askAi\(\)/g) ?? []).toHaveLength(1);
    expect(code).not.toContain("'Ask AI about this match'");
  });

  it('the screen renders the SHARED scorecard, and declares none', () => {
    const code = codeOf('app/match.tsx');
    expect(code).toContain('MatchScorecard');
    expect(code).not.toMatch(/(function|const)\s+MatchScorecard\b/);
    // no koota vocabulary of its own — the shared component owns all of it
    expect(code).not.toMatch(/\bkoota/i);
    expect(code).not.toContain('/36');
  });

  it('the view module decides nothing about a number', () => {
    const code = codeOf('lib/match-detail-view.ts');
    expect(code).not.toMatch(/[+\-*/]\s*\w*\.(points|total|max)/);
    expect(code).not.toMatch(/\.(points|total|max)\s*[+\-*/]/);
    expect(code).not.toContain('%');
    expect(code).not.toMatch(/from\s+'react/);
  });
});
