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
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'ios', 'android', '.expo']);

/**
 * The search roots are DERIVED from the workspace globs, not listed
 * (docs/49 ASTRAL-100, from F20).
 *
 * The listed version named three roots and `apps/astro/src` was not one of
 * them, so every guarantee below — one scorecard, one diamond geometry, one
 * `ringDash`, one input widget, one `input_response` carrier, renderers
 * derive nothing — was unenforced inside the app the S13 rows are about. A
 * second scorecard copied there was green.
 *
 * Adding one string to the array would have reproduced the defect for the
 * next workspace member, and D10 has already decided there will be one
 * (Jyotish AI, ASTRAL-110). So the globs in `package.json` are expanded
 * here instead: a package or app created tomorrow is covered the day it
 * exists rather than the day somebody remembers.
 *
 * `src` is the web app, which sits at the repo root and is not a workspace
 * member — it is the one root that has to be named.
 */
function workspaceMembers(): string[] {
  const globs: string[] = JSON.parse(
    readFileSync(join(WORKSPACE, 'package.json'), 'utf8'),
  ).workspaces ?? [];
  const members: string[] = [];
  for (const glob of globs) {
    const [parent, star] = glob.split('/');
    if (star !== '*') throw new Error(`unhandled workspace glob ${glob}`);
    for (const entry of readdirSync(join(WORKSPACE, parent)).sort()) {
      if (entry.startsWith('.')) continue;
      if (!statSync(join(WORKSPACE, parent, entry)).isDirectory()) continue;
      members.push(`${parent}/${entry}`);
    }
  }
  return members;
}

const WORKSPACE_MEMBERS = workspaceMembers();
const SEARCH_ROOTS = ['src', ...WORKSPACE_MEMBERS];

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

/**
 * The two per-platform primitive adapters and the two block hosts.
 *
 * These are `readFileSync` targets, so a move that does not update them
 * THROWS rather than passing quietly — which is the desired loudness, and is
 * how ASTRAL-99's move announced itself. The React Native pair now sits in
 * `packages/astral-native` rather than inside `apps/mobile`: the assertions
 * about them moved WITH the files instead of being dropped in the move.
 */
const ADAPTERS = [
  'src/components/astral/dom-primitives.tsx',
  'packages/astral-native/src/rn-primitives.tsx',
];
const HOSTS = [
  'src/components/astral/astral-block.tsx',
  'packages/astral-native/src/astral-block.tsx',
];
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

  it('represents EVERY workspace member in the scanned set', () => {
    // ASTRAL-100's real assertion. The file-count guard above cannot catch a
    // missing app: 200+ files and one known path both hold with a whole
    // workspace member absent, which is precisely how `apps/astro/src` went
    // unsearched. This one fails when a member contributes nothing.
    expect(WORKSPACE_MEMBERS.length).toBeGreaterThan(3);
    const scanned = ALL_FILES.map(rel);
    for (const member of WORKSPACE_MEMBERS) {
      expect(
        scanned.some((f) => f.startsWith(`${member}/`)),
      ).toBe(true);
    }
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
    for (const adapter of ADAPTERS) {
      expect(codeOf(join(WORKSPACE, adapter))).not.toMatch(
        /koota|guna|nakshatra|muhurta|lagna|dosha|graha/i,
      );
    }
  });
});

describe('ASTRAL-99 — one React Native binding, and it is not inside an app', () => {
  /**
   * Role-3's gate criterion, run as a test: "exactly one `rnPrimitives`, one
   * RN `AstralBlock`, and neither inside an app directory".
   *
   * The copy this forbids is not hypothetical and would not have failed to
   * compile. `@/*` maps to `./src/*` in BOTH apps' tsconfigs, so the old
   * binding's `@/lib/auth` / `@/lib/upload` / `@/lib/events` imports RESOLVE
   * in the second app — to different modules — which is why "just copy it
   * over" was the cheap-looking wrong answer (F22).
   */
  it('has one React Native primitives adapter', () => {
    expect(filesContaining(/export const rnPrimitives/, (f) => !isTest(f))).toEqual([
      'packages/astral-native/src/rn-primitives.tsx',
    ]);
  });

  it('has one React Native block host', () => {
    // The web host is a different file with the same component name, so the
    // grep is anchored on the React Native import that only the native one
    // has.
    const owners = filesContaining(
      /export function AstralBlock/,
      (f) => !isTest(f) && /react-native/.test(codeOf(f)),
    );
    expect(owners).toEqual(['packages/astral-native/src/astral-block.tsx']);
  });

  it('keeps the binding out of every app directory', () => {
    const strays = ALL_FILES.filter((f) => rel(f).startsWith('apps/'))
      .filter((f) => !isTest(f))
      .filter((f) => /rnPrimitives|NatalChartView|MatchScorecard|InputRequestView/.test(codeOf(f)))
      .map(rel)
      .sort();
    // An app may NAME the shared component when it imports it; what it may
    // not do is declare one. `function`/`const` before the name is the
    // difference between using the single implementation and being a second.
    for (const f of strays) {
      const code = codeOf(join(WORKSPACE, f));
      expect(code).not.toMatch(/(function|const)\s+(NatalChartView|MatchScorecard|InputRequestView)\b/);
      expect(code).not.toMatch(/const\s+rnPrimitives\b/);
    }
  });

  it('the binding imports no app-local module', () => {
    // The whole point of the move. `@/...` inside the package would resolve
    // to whichever app compiled it, which is the defect, not the fix.
    for (const f of [...ADAPTERS, ...HOSTS]) {
      if (!f.startsWith('packages/')) continue;
      expect(codeOf(join(WORKSPACE, f))).not.toMatch(/from '@\/[^']*'/);
    }
  });

  it('an unregistered block type is REPORTED, not silently dropped', () => {
    // The claim this pins: an unregistered data block renders nothing visible
    // and says so once, by name. A `return null` with no report is how three
    // computed block types went unrendered for months — dropping a block is
    // indistinguishable from never receiving one, which is the whole reason
    // `reportUnknown` exists (ASTRAL-20).
    //
    // Structural rather than a render test because the root jest project has
    // no React Native preset (F21 #4) — see the note at the foot of
    // `packages/astral-native/src/__tests__/host.test.ts`.
    const host = codeOf(join(WORKSPACE, 'packages/astral-native/src/astral-block.tsx'));
    expect(host).toContain('reportUnknown');
    expect(host).toMatch(/astralBlockRegistry\.get\(/);
    // dispatch is the registry's, not an if-chain that can forget a branch
    expect(host).not.toMatch(/if \(type === /);
  });

  it('the three host capabilities are declared in one place', () => {
    expect(filesContaining(/export interface AstralHost/, (f) => !isTest(f))).toEqual([
      'packages/astral-native/src/host.ts',
    ]);
    const host = codeOf(join(WORKSPACE, 'packages/astral-native/src/host.ts'));
    // F22's type seam, asserted rather than trusted: the CONTRACT is the
    // wider signature, so mobile's null case survives and astro's narrower
    // function is assignable without a cast.
    expect(host).toMatch(/getToken:\s*\(\)\s*=>\s*Promise<string \| null>/);
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
    for (const adapter of ADAPTERS) {
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
    for (const host of HOSTS) {
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

/**
 * ASTRAL-97 / ASTRAL-123 / ASTRAL-124 — the token layer, enforced.
 *
 * These replace `apps/astro/scripts/check-tokens.sh`, which was deleted for
 * being vacuous: it grepped for six-digit hex only, so `rgb(…)`, `'white'`,
 * `fontSize: 17` and `fontFamily: 'Georgia'` all sailed through it, and it was
 * never wired into CI in the first place. Run in the root jest project, the
 * greps are a build failure rather than a habit.
 *
 * The rules bind SCREENS, not the token module: `theme/brands.ts` is where
 * values are supposed to live, so it is the one exempt file.
 */
describe('ASTRAL-97 — one token module, and no screen declares a value', () => {
  const ASTRO_ROOT = 'apps/astro/src/';
  /** The one file allowed to state a VALUE. */
  const VALUE_MODULE = 'apps/astro/src/theme/brands.ts';
  /** contract.ts declares the SHAPE (`fontSize: number`) and index.ts picks the
   *  brand; neither carries a colour, so the colour greps below still bind
   *  them — only the type/size greps step around the declarations. */
  const TOKEN_DIR = 'apps/astro/src/theme/';

  const astroFiles = ALL_FILES.filter((f) => rel(f).startsWith(ASTRO_ROOT));
  /** every astro source file EXCEPT the one allowed to carry values */
  const screens = astroFiles.filter((f) => rel(f) !== VALUE_MODULE && !isTest(f));
  /** every astro source file OUTSIDE the token module altogether */
  const outsideTokens = astroFiles.filter((f) => !rel(f).startsWith(TOKEN_DIR) && !isTest(f));

  it('actually walked the app', () => {
    // Same vacuity guard as the workspace check above: a search root that
    // resolves to nothing would make every assertion below pass green.
    expect(astroFiles.length).toBeGreaterThan(10);
    expect(astroFiles.map(rel)).toContain('apps/astro/src/app/chat.tsx');
    expect(astroFiles.map(rel)).toContain(VALUE_MODULE);
    expect(screens.map(rel)).not.toContain(VALUE_MODULE);
    expect(outsideTokens.map(rel)).not.toContain('apps/astro/src/theme/contract.ts');
    expect(outsideTokens.map(rel)).toContain('apps/astro/src/app/settings.tsx');
  });

  it('the value module carries the colours, so the grep below means something', () => {
    // If the palette ever moved out from under the exemption, the "zero hex
    // outside brands.ts" assertion would still pass while meaning nothing.
    const values = codeOf(join(WORKSPACE, VALUE_MODULE));
    expect((values.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBeGreaterThan(10);
  });

  it('declares zero colour literals outside the token module', () => {
    // Hex in any length, and the two function forms `check-tokens.sh` missed.
    const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;
    expect(filesContaining(COLOUR, (f) => screens.includes(f))).toEqual([]);
  });

  it('declares zero NAMED colour literals outside the token module', () => {
    // `'white'` is a colour the same way `#ffffff` is. `transparent` and the
    // SVG `none` are absences, not palette choices, so they stay legal.
    const NAMED =
      /(?:color|Color|stroke|fill|tintColor|backgroundColor|shadowColor)\s*[:=]\s*['"](?!transparent|none|url\()[a-z]+['"]/;
    expect(filesContaining(NAMED, (f) => screens.includes(f))).toEqual([]);
  });

  it('declares zero numeric fontSize outside the token module', () => {
    // The type scale is named steps WITH line-heights (ASTRAL-97), so a screen
    // spreads a step; it never states a number. `fontSize: t.type...` would
    // still be a call-site size decision, so the grep is on the KEY.
    expect(filesContaining(/fontSize\s*:/, (f) => outsideTokens.includes(f))).toEqual([]);
  });

  it('declares zero lineHeight outside the token module', () => {
    // Leading travels with its size or it drifts from it; three of the four
    // shipped screens had hand-tuned line-heights next to token sizes.
    expect(filesContaining(/lineHeight\s*:/, (f) => outsideTokens.includes(f))).toEqual([]);
  });

  it('declares zero fontFamily outside the token module', () => {
    // F26: the display face is one decision. Two call sites is two faces the
    // day a font file lands.
    expect(filesContaining(/fontFamily/, (f) => outsideTokens.includes(f))).toEqual([]);
  });

  it('declares zero radius literals outside the token module', () => {
    expect(
      filesContaining(/[bB]orderRadius\s*:\s*\d/, (f) => outsideTokens.includes(f)),
    ).toEqual([]);
  });

  it('F35 — the wordmark is a token, not a string in a screen', () => {
    // Six literal sites today per F35; the three that are TypeScript are
    // pinned here. `app.json`'s brand block is the other three and is not a
    // .ts file, so it is out of this grep's reach by construction.
    expect(filesContaining(/['"]Astral AI['"]|['"]Jyotish AI['"]/, (f) => screens.includes(f)))
      .toEqual([]);
  });
});

describe('ASTRAL-124 — nothing follows the OS', () => {
  it('no astro screen and no astral binding consults the colour scheme', () => {
    // AMB-22 ruled (a): the split is by ROLE (working vs ceremonial), chosen
    // in the token layer. A surface that follows the phone is a palette
    // nobody chose — the state this row retires. F34: the component fix and
    // the config fix are both required, hence the app.json assertion below.
    const followers = filesContaining(
      /useColorScheme/,
      (f) =>
        !isTest(f) &&
        (rel(f).startsWith('apps/astro/src/') ||
          rel(f).startsWith('packages/astral-native/src/') ||
          rel(f).includes('/components/astral/')),
    );
    expect(followers).toEqual([]);
  });

  it('the app itself is pinned light', () => {
    const appJson = JSON.parse(
      readFileSync(join(WORKSPACE, 'apps/astro/app.json'), 'utf8'),
    );
    expect(appJson.expo.userInterfaceStyle).toBe('light');
  });
});

describe('F28 — no template brand asset survives', () => {
  const appJson = JSON.parse(
    readFileSync(join(WORKSPACE, 'apps/astro/app.json'), 'utf8'),
  );
  /** Expo's template blues. The first frame of every cold start was #208AEF. */
  const TEMPLATE = ['#208AEF', '#E6F4FE'];

  it('no Expo template colour is left in the app config', () => {
    const config = JSON.stringify(appJson);
    for (const hex of TEMPLATE) {
      expect(config.toLowerCase()).not.toContain(hex.toLowerCase());
    }
  });

  it('the splash and adaptive-icon grounds are the brand cosmic ground', () => {
    const splash = (appJson.expo.plugins as unknown[]).find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, { backgroundColor: string }];
    // Read from the token module rather than restated here, so a re-hue of
    // the palette moves this assertion with it.
    const brands = readFileSync(
      join(WORKSPACE, 'apps/astro/src/theme/brands.ts'),
      'utf8',
    );
    const deep = /deep:\s*'(#[0-9a-fA-F]{6})'/.exec(brands)?.[1];
    expect(deep).toBeTruthy();
    expect(splash[1].backgroundColor.toLowerCase()).toBe(deep!.toLowerCase());
    expect(appJson.expo.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe(
      deep!.toLowerCase(),
    );
  });

  it('ships no Expo template artwork', () => {
    const dir = join(WORKSPACE, 'apps/astro/assets');
    const found: string[] = [];
    const walkAny = (d: string) => {
      for (const e of readdirSync(d)) {
        const full = join(d, e);
        if (statSync(full).isDirectory()) walkAny(full);
        else found.push(relative(dir, full).split(sep).join('/'));
      }
    };
    walkAny(dir);
    expect(found.length).toBeGreaterThan(4);
    for (const f of found) {
      expect(f).not.toMatch(/react-logo|expo-logo|expo-badge|tutorial-web|expo-symbol/i);
    }
    // The iOS Icon Composer bundle was Expo's own (a blue automatic-gradient
    // fill plus `expo-symbol 2.svg`) and it is what TestFlight 1.0(3) shows.
    expect(found.some((f) => f.startsWith('expo.icon/'))).toBe(false);
    expect(appJson.expo.ios.icon).toBeUndefined();
  });
});
