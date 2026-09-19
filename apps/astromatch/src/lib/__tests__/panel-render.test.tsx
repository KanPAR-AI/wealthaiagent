/**
 * docs/73 ASTRAL-329 — the panel renders the engine's scorecard and derives
 * nothing (INV-9, INV-5).
 *
 * Three cases, and the third one is named honestly rather than faked:
 *
 *   COMPLETE   the `match_report` out of the SSE captured from the running
 *              engine on 2026-09-19 (26 / 36).
 *   FIRM-ONLY  `matchTimelessPayload` from `@wealthai/astral/fixtures` — the
 *              same engine-captured payload the web app's scorecard tests
 *              use. Deliberately NOT a second copy: one fixture corpus for
 *              one renderer.
 *   REFUSED    ASTRAL-314's ambiguous-rashi refusal, captured from the
 *              running engine on 2026-09-19 once PH-38 landed:
 *              `stream-refused-ambiguous-rashi.sse`. The engine sends NO
 *              `match_report` at all — not even a firm-only one — so the
 *              panel renders the sentence and draws no ring. (This comment
 *              used to say the refusal did not exist yet; it does, and the
 *              stream is asserted in `transport.test.ts`.)
 *
 * Rendered through `domPrimitives` — the real adapter, at 380 px — because
 * half the risk in the ASTRAL-18 arrangement lives in the adapter and a
 * stubbed one would launder it.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { render } from '@testing-library/react';
import { LIGHT_THEME, MatchScorecard, parseMatchReport } from '@wealthai/astral';
import { matchTimelessPayload } from '@wealthai/astral/fixtures';
import { domPrimitives } from '@wealthai/astral-dom';

import { PANEL_WIDTH } from '../config';
import { readTurn } from '../transport';

const APP = join(__dirname, '..', '..', '..');
const FIXTURES = join(__dirname, 'fixtures');

function textOf(file: string): string {
  return readFileSync(join(FIXTURES, file), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta as string)
    .join('');
}

function draw(payload: unknown) {
  const report = parseMatchReport(payload);
  if (!report) throw new Error('fixture did not parse');
  return render(
    <MatchScorecard ui={domPrimitives} theme={LIGHT_THEME} width={PANEL_WIDTH} report={report} />,
  );
}

const complete = (() => {
  const outcome = readTurn(textOf('stream-match-complete.sse'));
  if (outcome.kind !== 'scorecard') throw new Error('the captured stream carried no scorecard');
  return outcome.report;
})();

describe('the panel is 380 px, which is the width ASTRAL-18 names', () => {
  it('declares it once', () => {
    expect(PANEL_WIDTH).toBe(380);
  });
});

describe('a complete match, from the captured stream', () => {
  it('shows the engine\'s own numbers', () => {
    const { container } = draw(complete);
    const text = container.textContent ?? '';
    expect(text).toContain('26');
    expect(text).toContain('36');
    expect(text.toLowerCase()).toContain('very good');
  });

  it('draws all EIGHT koota rows, by name and by score', () => {
    // The scorecard is the artifact; a renderer that quietly dropped a row
    // would still look like a scorecard. Eight is the number of kootas, and
    // the captured payload has eight.
    const { container } = draw(complete);
    const text = container.textContent ?? '';
    const KOOTAS = [
      ['Varna', '1'],
      ['Vashya', '1'],
      ['Tara', '1.5'],
      ['Yoni', '2'],
      ['Graha Maitri', '0.5'],
      ['Gana', '5'],
      ['Bhakoot', '7'],
      ['Nadi', '8'],
    ] as const;
    expect(complete.kootas).toHaveLength(8);
    for (const [name, points] of KOOTAS) {
      expect(text).toContain(name);
      expect(text).toContain(points);
    }
    // …and each one's maximum, so a row cannot be half-drawn
    for (const koota of complete.kootas) {
      expect(text).toContain(String(koota.max));
    }
  });

  it('shows no percentage anywhere, in text or in an attribute', () => {
    const { container } = draw(complete);
    expect(container.textContent ?? '').not.toContain('%');
    expect(container.innerHTML).not.toContain('%');
  });
});

describe('a firm-only match — no total, no rescale, no invented ring', () => {
  it('prints the firm points over the firm maximum and the pending count', () => {
    const { container } = draw(matchTimelessPayload);
    const text = container.textContent ?? '';
    expect(text).toContain('15');
    expect(text).toContain('21');
    expect(text.toLowerCase()).toContain('pending');
  });

  it('never prints a /36 for it', () => {
    const { container } = draw(matchTimelessPayload);
    expect(container.textContent ?? '').not.toContain('of 36');
    expect(container.textContent ?? '').not.toContain('/36');
  });

  it('says WHY the rest is pending', () => {
    const { container } = draw(matchTimelessPayload);
    // the reason travels on the payload; the panel adds none of its own
    expect((container.textContent ?? '').length).toBeGreaterThan(40);
    expect(container.textContent ?? '').not.toContain('%');
  });
});

describe('the REFUSAL draws no scorecard at all', () => {
  it('is a stated text outcome from the captured refusal, not an empty ring', () => {
    const outcome = readTurn(textOf('stream-refused-ambiguous-rashi.sse'));
    expect(outcome.kind).toBe('text');
    if (outcome.kind !== 'text') throw new Error('unreachable');
    expect(outcome.text).toContain("I can't score this match");
    expect(outcome.text).toContain('Scorpio');
    expect(outcome.text).toContain('Sagittarius');
  });

  it('carries no ring to draw, because the engine sent no report', () => {
    const raw = readFileSync(join(FIXTURES, 'stream-refused-ambiguous-rashi.sse'), 'utf8');
    expect(raw).not.toContain('match_report');
  });
});

// ── the greps ASTRAL-329 names, run in CI rather than by hand ──────────────

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** comments stripped: this app's own comments discuss percentages and /36 by
 *  name while forbidding them, and a grep that tripped on its documentation
 *  would teach people to delete the documentation. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const SOURCES = sources(join(APP, 'src'));

describe('the client derives nothing (INV-9)', () => {
  it('found the app\'s source files', () => {
    // anti-vacuity: a walk that found nothing would make every grep below
    // pass while meaning nothing
    expect(SOURCES.length).toBeGreaterThan(8);
    expect(SOURCES.map((f) => f.replace(`${APP}/`, ''))).toContain('src/panel/app.tsx');
  });

  /**
   * The ONE exemption, named with its reason rather than a blanket skip.
   *
   * `parse-profile.ts` has a single `%` and it is the leap-year rule —
   * `(y % 4 === 0 && y % 100 !== 0) || y % 400 === 0` — which is calendar
   * arithmetic on a YEAR, not a quantity the engine computed. It is written
   * out rather than delegated to `Date`, which rolls the 31st of February
   * into March and would turn a typo into a different, plausible birthday.
   * The exemption is a COUNT and the line is checked below, so a percentage
   * smuggled into this file is still a red diff.
   */
  const PERCENT_EXEMPT: Record<string, number> = { 'src/lib/parse-profile.ts': 3 };

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s writes no percentage', (rel) => {
    const code = codeOf(join(APP, rel));
    expect((code.match(/%/g) ?? []).length).toBe(PERCENT_EXEMPT[rel] ?? 0);
  });

  it('the exempted occurrences are the leap-year rule and nothing else', () => {
    const code = codeOf(join(APP, 'src/lib/parse-profile.ts'));
    const lines = code.split('\n').filter((l) => l.includes('%'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('y % 4 === 0');
    expect(lines[0]).toContain('y % 400 === 0');
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s computes no score', (rel) => {
    const code = codeOf(join(APP, rel));
    expect(code).not.toContain('Math.round(');
    expect(code).not.toContain('toFixed');
    expect(code).not.toMatch(/\/\s*36\b/);
    expect(code).not.toMatch(/[*/]\s*100\b/);
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s carries no band threshold', (rel) => {
    const code = codeOf(join(APP, rel));
    // A verdict is the engine's word. A client threshold — ">= 18 is good" —
    // is a second opinion that agrees until the engine's table moves.
    expect(code).not.toMatch(/(points|score|total)\s*[><]=?\s*\d/);
    expect(code).not.toMatch(/'(excellent|very good|average|poor)'/);
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s derives no sign, house or rashi', (rel) => {
    const code = codeOf(join(APP, rel));
    expect(code).not.toMatch(/%\s*12\s*\)?\s*\+\s*1/);
    expect(code).not.toMatch(/\/\s*30\b/);
    expect(code).not.toMatch(/sign_index\s*[+-]/);
    expect(code).not.toMatch(/'Aries'\s*,\s*'Taurus'/);
  });

  it('the greps would actually catch one', () => {
    // the row's own anti-vacuity sample
    const sample = 'const pct = Math.round((report.total / 36) * 100);';
    expect(sample).toContain('Math.round(');
    expect(sample).toMatch(/\/\s*36\b/);
    expect(sample).toMatch(/[*/]\s*100\b/);
  });
});

describe('no module in this app is dead', () => {
  // A tested decision nothing consults is a decision that quietly stops
  // being true. `badge.ts` lost its callers when B5 removed the tab
  // listeners (F193); the manifest reads its title instead, so it is live.
  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')).filter((r) => r.startsWith('src/lib/')))(
    '%s is imported by something',
    (rel) => {
      const name = rel.split('/').pop()!.replace(/\.tsx?$/, '');
      if (['manifest', 'runtime'].includes(name)) return; // entry-adjacent
      const importers = SOURCES.filter((f) => f.replace(`${APP}/`, '') !== rel).filter((f) =>
        new RegExp(`from '[^']*${name}'`).test(codeOf(f)),
      );
      expect({ module: name, importers: importers.length }).not.toEqual({
        module: name,
        importers: 0,
      });
    },
  );
});

describe('the panel holds no credential and makes no request', () => {
  const panel = SOURCES.filter((f) => f.includes('/panel/'));

  it('found the panel', () => {
    expect(panel.length).toBeGreaterThan(2);
  });

  it.each(panel.map((f) => f.replace(`${APP}/`, '')))('%s makes no fetch of its own', (rel) => {
    const code = codeOf(join(APP, rel));
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/XMLHttpRequest/);
    expect(code).not.toMatch(/Bearer/);
  });

  it('only one panel file speaks to chrome at all', () => {
    const talkers = panel
      .filter((f) => /\bchrome\./.test(codeOf(f)))
      .map((f) => f.replace(`${APP}/`, ''));
    expect(talkers).toEqual(['src/panel/bridge.ts']);
  });
});

describe('the copy is honest about what is absent', () => {
  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s promises nothing', (rel) => {
    const code = codeOf(join(APP, rel));
    expect(code).not.toMatch(/coming soon|next update will|stay tuned|not yet available/i);
  });

  it('names no matrimonial site in the bundle (X-3)', () => {
    for (const file of SOURCES) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const site of ['shaadi', 'jeevansathi', 'bharatmatrimony', 'jodi']) {
        expect(text).not.toContain(site);
      }
    }
  });
});
