/**
 * The two structural rows: ASTRAL-18 (one implementation) and ASTRAL-19
 * (renderers derive nothing).
 *
 * Both are grep-shaped on purpose. Role-3's gate criteria are literally
 * "greps the workspace for a second scorecard renderer" and "reads the diff
 * and flags any client-side derivation" — running that grep in CI turns a
 * review habit into a build failure.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const SEARCH_ROOTS = ['src', 'packages', 'apps/mobile/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'ios', 'android', '.expo']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const ALL_FILES = SEARCH_ROOTS.flatMap((root) => walk(join(WORKSPACE, root)));
const rel = (f: string) => relative(WORKSPACE, f).split(sep).join('/');
const isTest = (f: string) => /__tests__|\.test\.tsx?$/.test(f);
const isFixture = (f: string) => rel(f).includes('/fixtures/');

/**
 * Source with comments removed.
 *
 * Every one of these greps is about what the CODE does. Comments in this
 * package legitimately name the banned things — "never a percentage", "no
 * koota vocabulary on the N5 path" — and matching them would make the tests
 * fire on their own documentation.
 */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function filesContaining(pattern: RegExp, predicate: (f: string) => boolean = () => true) {
  return ALL_FILES.filter(predicate)
    .filter((f) => pattern.test(codeOf(f)))
    .map(rel)
    .sort();
}

describe('the workspace was actually searched', () => {
  it('found a realistic number of source files', () => {
    // A broken walk that finds nothing would make every assertion below pass
    // vacuously — the exact shape of green-proving-nothing this suite is for.
    expect(ALL_FILES.length).toBeGreaterThan(200);
    expect(ALL_FILES.map(rel)).toContain(
      'packages/astral/src/components/match-scorecard.tsx',
    );
  });
});

describe('ASTRAL-18 — exactly one match scorecard in the workspace', () => {
  const KOOTA_VOCABULARY = /Ashtakoota|Bhakoot|Graha Maitri|Vashya|Ashtakuta/;

  it('keeps every module that speaks koota vocabulary inside the shared package', () => {
    // The scorecard is a view model plus a component, both in
    // `packages/astral`. A file OUTSIDE that package naming Bhakoot or Graha
    // Maitri is a second implementation, which is the SPEC-DEVIATION the row
    // names. Fixtures and tests are excluded: they carry engine output, not a
    // renderer.
    const owners = filesContaining(KOOTA_VOCABULARY, (f) => !isTest(f) && !isFixture(f));
    expect(owners.length).toBeGreaterThan(0);
    const outsiders = owners.filter((o) => !o.startsWith('packages/astral/src/'));
    expect(outsiders).toEqual([]);
    expect(owners).toEqual([
      'packages/astral/src/components/match-scorecard.tsx',
      'packages/astral/src/view/match.ts',
    ]);
  });

  it('has one North-Indian diamond geometry, not one per platform', () => {
    // 0.9125 is an anchor fraction unique to the diamond table.
    const owners = filesContaining(/0\.9125/, (f) => !isTest(f) && !isFixture(f));
    expect(owners).toEqual(['packages/astral/src/geometry.ts']);
  });

  it('has one ring-fill computation', () => {
    const owners = filesContaining(/function ringDash/, (f) => !isTest(f) && !isFixture(f));
    expect(owners).toEqual(['packages/astral/src/geometry.ts']);
  });

  it('keeps the per-platform adapters free of domain rendering', () => {
    for (const adapter of [
      'src/components/astral/dom-primitives.tsx',
      'apps/mobile/src/components/astral/rn-primitives.tsx',
    ]) {
      expect(codeOf(join(WORKSPACE, adapter))).not.toMatch(
        /koota|guna|nakshatra|muhurta|lagna|dosha|graha/i,
      );
    }
  });
});

describe('ASTRAL-19 — renderers derive nothing', () => {
  const RENDERER_FILES = ALL_FILES.filter((f) => {
    const r = rel(f);
    return (
      (r.startsWith('packages/astral/src/view/') ||
        r.startsWith('packages/astral/src/components/')) &&
      !isTest(f)
    );
  });

  it('found the renderer modules', () => {
    expect(RENDERER_FILES.length).toBe(6);
  });

  it.each(RENDERER_FILES.map(rel))('%s does no rounding or rescaling', (r) => {
    const code = codeOf(join(WORKSPACE, r));
    expect(code).not.toContain('toFixed');
    expect(code).not.toContain('Math.round');
    expect(code).not.toContain('parseFloat');
    expect(code).not.toContain('Number(');
    expect(code).not.toMatch(/[*/]\s*100\b/);
  });

  it.each(RENDERER_FILES.map(rel))('%s does no arithmetic on a payload field', (r) => {
    const code = codeOf(join(WORKSPACE, r));
    const PAYLOAD_FIELDS =
      '(points|degree|ascendant_degree|score|total|max_total|firm_total|firm_max|pending_max|max)';
    // `field <op> …` and `… <op> field`
    expect(code).not.toMatch(new RegExp(`\\.${PAYLOAD_FIELDS}\\s*[+\\-*/]`));
    expect(code).not.toMatch(new RegExp(`[+\\-*/]\\s*\\w*\\.${PAYLOAD_FIELDS}\\b`));
  });

  it('keeps every arithmetic helper in the two DECLARED modules', () => {
    // `ringDash` is the one function allowed to divide payload numbers, and it
    // returns an SVG stroke length rather than anything a user reads.
    const declared = ['packages/astral/src/format.ts', 'packages/astral/src/geometry.ts'];
    for (const r of RENDERER_FILES.map(rel)) {
      expect(declared).not.toContain(r);
    }
    const geometry = readFileSync(join(WORKSPACE, 'packages/astral/src/geometry.ts'), 'utf8');
    expect(geometry).toContain('ringDash');
  });
});
