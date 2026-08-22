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

describe('ASTRAL-91 — exactly one input widget in the workspace', () => {
  it('has one component', () => {
    expect(filesContaining(/function InputRequestView/, (f) => !isTest(f))).toEqual([
      'packages/astral/src/components/input-request.tsx',
    ]);
  });

  it('has one place a widget answer becomes a message', () => {
    // The carrier. A second builder anywhere is how a client-side format
    // drifts away from the engine's parser without anyone noticing.
    expect(
      filesContaining(/function buildInputResponseMessage/, (f) => !isTest(f)),
    ).toEqual(['packages/astral/src/input-request.ts']);
  });

  it('has one module that knows the `input_response` fence', () => {
    const owners = filesContaining(/input_response/, (f) => !isTest(f) && !isFixture(f));
    expect(owners).toEqual(['packages/astral/src/input-request.ts']);
  });

  it('keeps the per-platform adapters free of widget logic', () => {
    for (const adapter of [
      'src/components/astral/dom-primitives.tsx',
      'apps/mobile/src/components/astral/rn-primitives.tsx',
    ]) {
      const code = codeOf(join(WORKSPACE, adapter));
      expect(code).not.toContain('input_response');
      expect(code).not.toContain('buildInputResponseMessage');
      expect(code).not.toMatch(/allowUnknown|I don't know/);
    }
  });
});

describe('F18 — the answer is never flattened into a sentence to be re-parsed', () => {
  const COMPONENT = 'packages/astral/src/components/input-request.tsx';

  it('every send goes through the typed carrier', () => {
    // `apps/mobile/src/components/chat/onboarding-form.tsx:63-70` builds
    // `Age: ${v}, Sex: ${v}` and posts it "because the backend slot extractor
    // depends on it". That is the shipped convention and the exact defect this
    // widget exists to remove, so: every call to `onSend` in the component
    // hands it `buildInputResponseMessage` and nothing else.
    const code = codeOf(join(WORKSPACE, COMPONENT));
    const calls = code.match(/onSend\(([^;]*)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain('buildInputResponseMessage');
    }
    expect(code).not.toMatch(/onSend\(\s*echoFor/);
  });

  it('the two hosts pass the message through rather than building one', () => {
    for (const host of [
      'src/components/astral/astral-block.tsx',
      'apps/mobile/src/components/astral/astral-block.tsx',
    ]) {
      const code = codeOf(join(WORKSPACE, host));
      // no host-side string assembly of an answer at all
      expect(code).not.toMatch(/: \$\{/);
      expect(code).not.toContain('buildInputResponseMessage');
    }
  });

  it('the flatten-then-send pattern is pinned to the files that already had it', () => {
    // The signature of F18: a file that BOTH assembles `label: ${value}` text
    // AND posts it on the quick-reply channel. Five such files exist today
    // (`onboarding-form.tsx` on each client plus three financial-planner
    // panels) and they are legacy. The assertion is an exact set, so the
    // sixth — in particular one inside the astral path — is a red diff.
    const sends = ALL_FILES.filter((f) => !isTest(f)).filter((f) =>
      /QUICK_REPLY_EVENT|chat-quick-reply/.test(codeOf(f)),
    );
    const flatteners = sends.filter((f) => /: \$\{/.test(codeOf(f))).map(rel).sort();
    expect(flatteners).toEqual([
      'apps/mobile/src/components/chat/onboarding-form.tsx',
      'src/components/widgets/financial-planner/advisor-panel.tsx',
      'src/components/widgets/financial-planner/health-snapshot.tsx',
      'src/components/widgets/financial-planner/profile-review.tsx',
      'src/components/widgets/onboarding-form-widget.tsx',
    ]);
    for (const f of flatteners) {
      expect(f.startsWith('packages/astral/')).toBe(false);
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
    // 6 through PH-3; the 7th is PH-11's input widget (ASTRAL-91).
    expect(RENDERER_FILES.length).toBe(7);
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
