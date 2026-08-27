/**
 * docs/49 PH-27 — the discipline every new surface obeys
 * (ASTRAL-233 · 242 · 243 · 246 · 247).
 *
 * These are properties of the SET of affordances and of the source itself,
 * not of any one screen: which tiles exist, which routes this build may open,
 * how many chat turns a native surface costs (zero), and whether a decision
 * leaked into a `.tsx`.
 */

import fs from 'fs';
import path from 'path';

import { CAPABILITIES, type Capabilities } from '../capabilities';
import { CORRECTION_TURNS, editRoute } from '../edit-fact';
import {
  DECLARED_PUSHED_ROUTES,
  DECLARED_TILES,
  routeIsLive,
  visiblePushedRoutes,
  visibleTiles,
} from '../tabs';
import { WITHDRAWAL_NOTE, withdrawalNote } from '../profile-view';

const APP = path.join(__dirname, '..', '..');

const codeOf = (rel: string) =>
  fs
    .readFileSync(path.join(APP, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const off = (key: keyof Capabilities): Capabilities =>
  ({ ...CAPABILITIES, [key]: false });

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-233 — the tile stops pretending, and a false capability REMOVES
// ══════════════════════════════════════════════════════════════════════════

describe('the chart surface is reachable, and gated', () => {
  it('the Birth Chart tile points at the chart, not at Profile', () => {
    // F93: it pointed at `/profile` — a summary of the thing it named —
    // because screen 5 was not built. The read exists now (ASTRAL-229).
    const tile = DECLARED_TILES.find((t) => t.id === 'chart')!;
    expect(tile.route).toBe('/chart');
    expect(tile.needs).toBe('chart');
  });

  it('flipping `chart` to false removes the tile AND the route', () => {
    const caps = off('chart');
    expect(visibleTiles(caps).map((t) => t.id)).not.toContain('chart');
    expect(visiblePushedRoutes(caps).map((r) => r.path)).not.toContain('/chart');
    expect(routeIsLive('/chart', caps)).toBe(false);
    // …and it is REMOVED, not disabled: nothing else moved.
    expect(visibleTiles(caps)).toHaveLength(visibleTiles(CAPABILITIES).length - 1);
  });

  it('no tile points at a route whose capability is false', () => {
    // Asserted over the WHOLE table, so the next tile cannot reintroduce
    // F93's redirect by pointing somewhere its capability does not cover.
    for (const tile of DECLARED_TILES) {
      const declared = DECLARED_PUSHED_ROUTES.find((r) => r.path === tile.route);
      if (!declared) continue;      // a tab route, gated by the tab map
      expect(declared.needs).toBe(tile.needs);
    }
  });

  it('every visible tile points at a live route', () => {
    for (const tile of visibleTiles()) {
      expect(routeIsLive(tile.route)).toBe(true);
    }
  });

  it('the chart screen leaves when its capability is off', () => {
    // expo-router builds its table from the file system, so a deep link
    // would otherwise reach a screen this build cannot serve.
    const code = codeOf('app/chart.tsx');
    expect(code).toContain("routeIsLive('/chart')");
    expect(code).toMatch(/router\.replace\('\/home'\)/);
  });

  it('the bar is still five — no sixth tab was added (AMB-50 open)', () => {
    const tabs = codeOf('lib/tabs.ts');
    const ids = tabs.match(/id: '(home|insights|chat|timeline|profile)'/g) ?? [];
    expect(new Set(ids).size).toBe(5);
    expect(tabs).not.toMatch(/id: 'chart',\s*\n\s*label:/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-242 — every native surface costs ZERO chat turns
// ══════════════════════════════════════════════════════════════════════════

describe('the native surfaces make no turn', () => {
  /** Every surface PH-27 made native, plus the four PH-16 shipped. */
  const SURFACES = [
    'app/chart.tsx',
    'app/match.tsx',
    'app/matches.tsx',
    'app/profile.tsx',
    'app/(tabs)/home.tsx',
    'app/(tabs)/insights.tsx',
    'app/(tabs)/timeline.tsx',
  ];

  it.each(SURFACES)('%s sends no message on open', (file) => {
    const code = codeOf(file);
    // The chat send path, in every shape it takes in this app.
    expect(code).not.toMatch(/CHAT_SEND_EVENT/);
    expect(code).not.toMatch(/sendMessage\s*\(/);
    expect(code).not.toMatch(/POST[^\n]*chats/);
    expect(code).not.toMatch(/createChat\s*\(/);
  });

  it.each(SURFACES)('%s reads only through the People client', (file) => {
    const code = codeOf(file);
    // No fetch of its own: one module owns the URL, the token and the error
    // shape, and a screen that fetched would own all three again.
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });

  it('the only navigations into chat are USER actions, never mount effects', () => {
    // A surface that "warms up" by opening a conversation is the thing the
    // directive is about. So for every `/chat` navigation in these files,
    // the nearest hook ABOVE it must not be `useEffect` — a push that runs
    // on mount is a turn nobody asked for.
    for (const file of SURFACES) {
      const code = codeOf(file);
      let from = 0;
      for (;;) {
        const at = code.indexOf("pathname: '/chat'", from);
        if (at === -1) break;
        const before = code.slice(0, at);
        const lastEffect = before.lastIndexOf('useEffect(');
        const lastHandler = Math.max(before.lastIndexOf('useCallback('),
                                     before.lastIndexOf('onPress'));
        expect(lastHandler).toBeGreaterThan(lastEffect);
        from = at + 1;
      }
    }
  });

  it('the chart surface makes exactly two reads and no more', () => {
    const code = codeOf('app/chart.tsx');
    expect(code.match(/fetchSelf\(\)/g) ?? []).toHaveLength(1);
    expect(code.match(/fetchChart\(/g) ?? []).toHaveLength(1);
    // …and nothing that could recompute one.
    expect(code).not.toMatch(/recompute/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-243 — Profile can withdraw a birth time
// ══════════════════════════════════════════════════════════════════════════

describe('withdrawing a birth time from Profile', () => {
  it('the birth-time sheet says the time can be withdrawn', () => {
    expect(withdrawalNote('time_of_birth')).toBe(WITHDRAWAL_NOTE);
    expect(WITHDRAWAL_NOTE).toContain('I don’t know');
  });

  it('…and only the birth time, because only it can be', () => {
    // A date or a place cannot be withdrawn: nothing is computable without
    // them, so "I don't know" there is a different request entirely.
    expect(withdrawalNote('date_of_birth')).toBeNull();
    expect(withdrawalNote('place_of_birth')).toBeNull();
  });

  it('the correction opens through the one carrier, with no value on it', () => {
    const route = editRoute('time_of_birth')!;
    expect(route.pathname).toBe('/birth-details');
    expect(route.params.opening).toBe(CORRECTION_TURNS.time_of_birth);
    // No value travels: a route param holding a birth time would be a fact
    // reaching state without passing `reconcile` (F24, INV-1).
    expect(JSON.stringify(route.params)).not.toMatch(/\d{1,2}:\d{2}/);
    expect(JSON.stringify(route.params)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('the app still contains no POST or PATCH carrying a birth fact', () => {
    // ASTRAL-104's grep, re-run with three new reads present.
    const files = fs.readdirSync(path.join(APP, 'lib'))
      .filter((f) => f.endsWith('.ts') && !f.startsWith('.'));
    const FACTS = /(date_of_birth|time_of_birth|place_of_birth|latitude|longitude)/;
    for (const file of files) {
      const code = codeOf(path.join('lib', file));
      const writes = code.match(/method:\s*'(POST|PATCH|PUT)'[\s\S]{0,300}/g) ?? [];
      for (const write of writes) expect(write).not.toMatch(FACTS);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-247 — the three rules bind every surface this phase adds
// ══════════════════════════════════════════════════════════════════════════

describe('the three enforced rules', () => {
  const NEW_VIEWS = ['lib/chart-view.ts', 'lib/staleness.ts', 'lib/spans.ts',
                     'lib/match-detail-view.ts'];

  it.each(NEW_VIEWS)('%s is React-free', (file) => {
    const code = codeOf(file);
    expect(code).not.toMatch(/from\s+'react'/);
    expect(code).not.toMatch(/from\s+'react-native'/);
    expect(code).not.toMatch(/from\s+'expo/);
    expect(code).not.toContain('.tsx');
  });

  it.each(['app/chart.tsx', 'app/match.tsx'])('%s decides nothing', (file) => {
    const code = codeOf(file);
    // No derivation, and no rule the view module should own.
    expect(code).not.toMatch(/sign_index/);
    expect(code).not.toMatch(/rashi_number\s*[+\-*/]/);
    expect(code).not.toMatch(/%\s*12\s*\)?\s*\+\s*1/);
    expect(code).not.toContain('365.25');
    expect(code).not.toContain('new Date(');
  });

  it('every new surface has a capability with a REASON beside it', () => {
    const caps = fs.readFileSync(path.join(APP, 'lib', 'capabilities.ts'), 'utf8');
    const declaration = caps.indexOf('chart: boolean;');
    expect(declaration).toBeGreaterThan(0);
    // The doc comment above it names the read the capability IS.
    const preamble = caps.slice(Math.max(0, declaration - 1400), declaration);
    expect(preamble).toContain('ASTRAL-229');
    expect(preamble).toContain('GET /people/{id}/chart');
  });
});
