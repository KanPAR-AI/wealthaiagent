/**
 * docs/49 ASTRAL-119 (superseding ASTRAL-102) — the tab set is DERIVED, and
 * an absent capability REMOVES a tab rather than disabling it.
 *
 * Imported by relative path on purpose: the root jest project maps `@/*` to
 * the WEB app's `src`, so `@/lib/...` inside an apps/astro test would
 * silently resolve to a different file.
 */

import fs from 'fs';
import path from 'path';

import { CAPABILITIES } from '../capabilities';
import { DECLARED_TABS, DECLARED_TILES, visibleTabs, visibleTiles, tabIsLive } from '../tabs';

describe('the five-tab bar', () => {
  it('ships the board’s five, in the board’s order', () => {
    expect(visibleTabs().map((t) => t.label)).toEqual([
      'Home',
      'Insights',
      'AI Chat',
      'Timeline',
      'Profile',
    ]);
  });

  it('ASTRAL-119 — every tab is live at this gate, none is a placeholder', () => {
    // AMB-19 was ruled (a): N1 and N2 land BEFORE the shell, so the bar
    // ships whole rather than derived down to two. This asserts the map
    // actually says so — a shell that shipped with three of five would be a
    // sequencing violation, not a smaller shell.
    expect(visibleTabs()).toHaveLength(DECLARED_TABS.length);
  });

  it('a capability marked absent REMOVES its tab', () => {
    // The mechanism, one flip at a time. Not greyed, not "coming soon": the
    // SET changes, which is ASTRAL-102's unit obligation carried forward.
    expect(visibleTabs({ ...CAPABILITIES, timeline: false }).map((t) => t.id)).toEqual([
      'home',
      'insights',
      'chat',
      'profile',
    ]);
    expect(visibleTabs({ ...CAPABILITIES, home: false }).map((t) => t.id)).toEqual([
      'insights',
      'chat',
      'timeline',
      'profile',
    ]);
    expect(visibleTabs({ ...CAPABILITIES, dailyGuidance: false }).map((t) => t.id)).toEqual([
      'home',
      'chat',
      'timeline',
      'profile',
    ]);
  });

  it('the chat tab is derived like every other one', () => {
    // A hard-coded chat tab beside four derived ones would be the one entry
    // nobody could turn off, and the mechanism the row asks for is that the
    // SET is derived — not that four fifths of it is.
    expect(visibleTabs({ ...CAPABILITIES, aiChat: false }).map((t) => t.id)).not.toContain('chat');
    expect(tabIsLive('chat', { ...CAPABILITIES, aiChat: false })).toBe(false);
    expect(tabIsLive('chat')).toBe(true);
  });

  it('F36 / AMB-26 — there is no palm or muhurta tab', () => {
    // Both are live intents and both are reachable through chat; neither is
    // a tab until AMB-26 is answered. A sixth entry here is an answer to
    // that question, not a layout tweak.
    const ids = DECLARED_TABS.map((t) => t.id);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain('palm');
    expect(ids).not.toContain('muhurta');
  });

  it('every tab route is a file this app has', () => {
    // A tab pointing at a route that does not exist is the dead affordance
    // in its most embarrassing form: a bar item that opens nothing.
    const dir = path.resolve(__dirname, '../../app/(tabs)');
    for (const tab of DECLARED_TABS) {
      expect(fs.existsSync(path.join(dir, `${tab.route}.tsx`))).toBe(true);
    }
  });
});

describe('ASTRAL-119’s gate-order check — the shell may not ship ahead of its engine', () => {
  /**
   * The row asks for "a gate-order test: the shell's map asserts `daily` and
   * `timeline` present in the registry at build time, so shipping the shell
   * against an engine without them fails structurally".
   *
   * This is a monorepo, so the registry is readable from here. It is a grep
   * rather than an import because the engine is Python: what it proves is
   * that the two node names are REGISTERED, which is the condition AMB-19(a)
   * makes the shell wait for.
   */
  const registry = path.resolve(
    process.cwd(),
    '../chatservice/services/agents/astrology/graph.py',
  );

  it('the engine registry is where this test thinks it is', () => {
    // Without this the grep below could pass vacuously the day someone moves
    // the file — a gate test that cannot fail is worse than no gate test.
    expect(fs.existsSync(registry)).toBe(true);
  });

  it('the `daily` and `timeline` nodes are in the node registry', () => {
    const src = fs.readFileSync(registry, 'utf8');
    expect(src).toContain('"daily": NodeSpec(');
    expect(src).toContain('"timeline": NodeSpec(');
  });

  it('the user-scoped reads the tabs open with exist', () => {
    const api = path.resolve(process.cwd(), '../chatservice/api/v1/endpoints/people.py');
    const src = fs.readFileSync(api, 'utf8');
    expect(src).toContain('"/self/daily"');
    expect(src).toContain('"/self/timeline"');
  });
});

describe('Home’s tile row', () => {
  /**
   * Five tiles today, and the fifth is AMB-26's option (a).
   *
   * The board draws four. F36 records that neither palm nor muhurta appears
   * on ANY of the twelve frames, though both are shipped engine intents and
   * the brief calls palm "the strongest part of the engine". AMB-26 asks
   * where they live and recommends the tile row; that recommendation is
   * taken as a default under the standing rule, and it is additive — the TAB
   * set below is unchanged and a sixth tab remains an AMB-26 answer nobody
   * has given.
   *
   * Palm is DECLARED and ABSENT, which is the map working rather than the
   * feature missing: its capability is false because the engine's capture ask
   * is unreachable (the measurement is on `capabilities.palm`). The row below
   * is what "a false REMOVES the tile" means when it is not hypothetical.
   */
  it('ASTRAL-125 / AMB-26(a) — the tiles link only to live screens', () => {
    expect(visibleTiles().map((t) => t.title)).toEqual([
      'Birth Chart',
      'Compatibility',
      'AI Reading',
      'This Month',
      'Muhurta',
    ]);
  });

  it('the palm tile is DECLARED, and absent only because its capability is', () => {
    // Both halves matter. If the tile were simply deleted, restoring the
    // surface would be a code change rather than a flag; if the capability
    // were true, the tile would promise a flow the engine cannot complete.
    expect(DECLARED_TILES.map((t) => t.id)).toContain('palm');
    expect(visibleTiles().map((t) => t.id)).not.toContain('palm');
    expect(visibleTiles({ ...CAPABILITIES, palm: true }).map((t) => t.id)).toContain('palm');
  });

  it('a tile whose capability is absent is not rendered dimmed — it is gone', () => {
    expect(visibleTiles({ ...CAPABILITIES, matches: false }).map((t) => t.id)).toEqual([
      'chart',
      'reading',
      'month',
      'muhurta',
    ]);
    expect(visibleTiles({ ...CAPABILITIES, timeline: false }).map((t) => t.id)).toEqual([
      'chart',
      'compatibility',
      'reading',
      'muhurta',
    ]);
    expect(visibleTiles({ ...CAPABILITIES, muhurta: false }).map((t) => t.id))
      .not.toContain('muhurta');
  });

  it('no tile points at a screen this build does not have', () => {
    // This is the test that caught `/muhurta` before it existed: the tile
    // was declared one commit ahead of its screen and the suite said so.
    const appDir = path.resolve(__dirname, '../../app');
    for (const tile of DECLARED_TILES) {
      const name = tile.route.replace(/^\//, '');
      const flat = path.join(appDir, `${name}.tsx`);
      const tabbed = path.join(appDir, '(tabs)', `${name}.tsx`);
      expect(fs.existsSync(flat) || fs.existsSync(tabbed)).toBe(true);
    }
  });
});
