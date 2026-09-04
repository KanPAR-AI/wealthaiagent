/**
 * The library view model, against fixtures CAPTURED from the running engine
 * (`GET /api/v1/knee/program*`, chatservice 86dee84) — never hand-written.
 * Relative imports on purpose: `@/*` maps to the web app's src in the root
 * jest project.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  dubUrl,
  exerciseRows,
  formatClock,
  phaseSubtitle,
  statedCount,
  type WirePhaseDetail,
  type WireProgram,
} from '../library-view';

function fixture<T>(name: string): T {
  const p = path.join(__dirname, 'fixtures', name);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const program = fixture<WireProgram>('program.json');
const phase2 = fixture<WirePhaseDetail>('program-phase2.json');

describe('formatClock', () => {
  it('renders the design timestamps', () => {
    expect(formatClock(71)).toBe('1:11');
    expect(formatClock(554.97)).toBe('9:14');
    expect(formatClock(0)).toBe('0:00');
  });
  it('absence stays absent — no invented zero', () => {
    expect(formatClock(null)).toBeNull();
    expect(formatClock(-1)).toBeNull();
  });
});

describe('phaseSubtitle — the honesty line', () => {
  it('says "complete set" ONLY when the server cross-check says so', () => {
    const p2 = program.phases.find((p) => p.phase === '2')!;
    expect(p2.complete).toBe(true); // captured state; re-capture if it moves
    expect(phaseSubtitle(p2)).toBe('20 exercises — the complete set');
  });
  it('a mismatch states both numbers instead of overclaiming', () => {
    expect(
      phaseSubtitle({ phase: '3', name: 'x', count: 6, catalog_count: 20, complete: false }),
    ).toBe('6 exercises indexed of 20 in the catalog');
  });
});

describe('exerciseRows', () => {
  const rows = exerciseRows(phase2);

  it('renders every server row, in server order, without recounting', () => {
    expect(rows).toHaveLength(phase2.exercises.length);
    expect(statedCount(phase2)).toBe(phase2.count);
    expect(rows.map((r) => r.name)).toEqual(phase2.exercises.map((e) => e.name));
  });

  it('the toe curls row carries the design timestamp and the Hindi track', () => {
    const toe = rows.find((r) => r.name === 'toe curls')!;
    expect(toe.clock).toBe('1:11');
    expect(toe.hasHindi).toBe(true);
    expect(toe.playable).toBe(true);
  });

  it('a row without a URL is not playable — no dead affordance', () => {
    const detail: WirePhaseDetail = {
      ...phase2,
      exercises: [{ ...phase2.exercises[0], url: null, dub_langs: [] }],
    };
    const [row] = exerciseRows(detail);
    expect(row.playable).toBe(false);
    expect(row.hasHindi).toBe(false);
  });
});

describe('dubUrl', () => {
  it('inserts the per-language kind before the time fragment', () => {
    expect(dubUrl('https://x/m/abc?t=tok&dub=hi#t=71', 'hi'))
      .toBe('https://x/m/abc?t=tok&dub=hi&kind=source_hi#t=71');
  });
  it('appends when there is no fragment, with the right separator', () => {
    expect(dubUrl('https://x/m/abc', 'hi')).toBe('https://x/m/abc?kind=source_hi');
    expect(dubUrl('https://x/m/abc?t=tok', 'hi')).toBe('https://x/m/abc?t=tok&kind=source_hi');
  });
  it('works on a real captured URL', () => {
    const withDub = phase2.exercises.find((e) => e.url && e.dub_langs.includes('hi'))!;
    const swapped = dubUrl(withDub.url!, 'hi');
    expect(swapped).toContain('kind=source_hi');
    // the start fragment survives the swap
    if (withDub.url!.includes('#t=')) {
      expect(swapped.slice(swapped.indexOf('#'))).toBe(
        withDub.url!.slice(withDub.url!.indexOf('#')),
      );
    }
  });
});
