// The five-tab bar, DERIVED (docs/49 ASTRAL-119, superseding ASTRAL-102).
//
// The board draws Home · Insights · AI Chat · Timeline · Profile. AMB-19 was
// ruled (a) — N1 and N2 land BEFORE the shell — so at this gate the map
// declares all five present and every tab renders real data on the first
// day. What did not change is the mechanism, and the mechanism is the row:
// the tab set is derived from `lib/capabilities.ts`, and a capability marked
// absent REMOVES its tab rather than greying it.
//
// ── why this file has no React in it ───────────────────────────────────────
//
// Pure data and one pure function, like `settings-rows.ts` next door: the
// root jest project has no React Native renderer, and the property that
// matters here — flipping one capability changes the SET — is a property of
// a list, not of a layout. The layout renders whatever this returns and
// decides nothing.
//
// ── no sixth slot ──────────────────────────────────────────────────────────
//
// Palm and muhurta are live intents and are NOT tabs (F36, AMB-26 open).
// They are reachable through chat and named on Home's tile row per AMB-26's
// leaning (a). Adding a sixth entry here is an AMB-26 answer, not a layout
// tweak.

// Type-only, so this module still imports nothing at runtime and still runs
// under the root jest project.
import type { SFSymbol } from 'sf-symbols-typescript';

import { CAPABILITIES, type Capabilities } from './capabilities';

export type TabId = 'home' | 'insights' | 'chat' | 'timeline' | 'profile';

export interface TabDef {
  id: TabId;
  /** the label under the icon, as the board writes it */
  label: string;
  /**
   * The expo-router route name INSIDE the tabs group — which is also the
   * file name. Deliberately the same strings the app already navigates to
   * (`/chat`, `/settings`): the group is a layout, not a URL segment, so
   * every existing deep link, every `router.push` and the birth-details
   * handoff keep working unchanged.
   */
  route: string;
  icon: SFSymbol;
  /** the capability that has to be true for this tab to exist at all */
  needs: keyof Capabilities;
}

const DECLARED: TabDef[] = [
  {
    id: 'home',
    label: 'Home',
    route: 'home',
    icon: 'house',
    needs: 'home',
  },
  {
    // The board calls screen 8 "Daily Guidance" and labels its tab
    // "Insights". Both names are kept where the board puts them: the label
    // here, the title on the screen.
    id: 'insights',
    label: 'Insights',
    route: 'insights',
    icon: 'sparkles',
    needs: 'dailyGuidance',
  },
  {
    id: 'chat',
    label: 'AI Chat',
    route: 'chat',
    icon: 'bubble.left.and.bubble.right',
    needs: 'aiChat',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    route: 'timeline',
    icon: 'chart.bar',
    needs: 'timeline',
  },
  {
    // The board's fifth tab is Profile, and frame 12 — the screen it opens —
    // is titled "Profile / Settings". The route stays `settings` because
    // that is where every existing link points, including the server's
    // out-of-credits message ("Settings → Credits"). The tab that hosts it
    // needs the same capability the screen's first row does.
    id: 'profile',
    label: 'Profile',
    route: 'settings',
    icon: 'person',
    needs: 'accountSettings',
  },
];

/** Every tab DECLARED, whether or not this build can serve it. */
export const DECLARED_TABS: readonly TabDef[] = DECLARED;

/**
 * The tabs this build may render.
 *
 * Absent capability → absent tab. Not greyed, not "coming soon": ASTRAL-119
 * keeps ASTRAL-102's unit obligation unchanged, which is that flipping one
 * capability changes the SET.
 */
export function visibleTabs(capabilities: Capabilities = CAPABILITIES): TabDef[] {
  return DECLARED.filter((tab) => capabilities[tab.needs]);
}

/** True when this build may show `id`. The layout asks per route, because
 *  expo-router declares screens by file name whether or not they are on the
 *  bar — a screen this build cannot serve gets no bar entry AND no route. */
export function tabIsLive(id: TabId, capabilities: Capabilities = CAPABILITIES): boolean {
  return visibleTabs(capabilities).some((t) => t.id === id);
}

/**
 * Home's tile row (docs/49 ASTRAL-125): the four tiles the board draws,
 * each pointing at a screen this build actually has.
 *
 * The rule the row states — "the four tiles link only to live screens" — is
 * the same rule as the tab bar's, so it is expressed the same way rather
 * than by a second convention. A tile whose capability is absent does not
 * render dimmed; it is not in the list.
 *
 * Where each one goes, and why it is not where the board's label suggests:
 *   Birth Chart      → `/profile`. Screen 5 (Chart · Grahas · Dasha,
 *                      ASTRAL-120) is not built in this slice, and Profile
 *                      is where the stamped chart summary already renders.
 *                      Pointing at an unbuilt screen is the dead affordance
 *                      ASTRAL-119's negative space forbids.
 *   Compatibility    → `/matches`, the saved-matches list (ASTRAL-140..146).
 *   AI Reading       → `/chat`.
 *   This Month       → `/timeline`.
 */
export interface HomeTile {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: SFSymbol;
  needs: keyof Capabilities;
}

const TILES: HomeTile[] = [
  {
    id: 'chart',
    title: 'Birth Chart',
    subtitle: 'Your grahas, bhavas and dashas',
    route: '/profile',
    icon: 'circle.hexagongrid',
    needs: 'profile',
  },
  {
    id: 'compatibility',
    title: 'Compatibility',
    subtitle: 'Your saved matches',
    route: '/matches',
    icon: 'heart',
    needs: 'matches',
  },
  {
    id: 'reading',
    title: 'AI Reading',
    subtitle: 'Ask anything about your chart',
    route: '/chat',
    icon: 'bubble.left.and.bubble.right',
    needs: 'aiChat',
  },
  {
    id: 'month',
    title: 'This Month',
    subtitle: 'Your periods and transits',
    route: '/timeline',
    icon: 'calendar',
    needs: 'timeline',
  },
];

export const DECLARED_TILES: readonly HomeTile[] = TILES;

export function visibleTiles(capabilities: Capabilities = CAPABILITIES): HomeTile[] {
  return TILES.filter((tile) => capabilities[tile.needs]);
}
