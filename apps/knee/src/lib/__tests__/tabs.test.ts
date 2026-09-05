/**
 * The capability rule as a property of the tab SET (the astro obligation):
 * flipping one capability changes what exists, and the current build's map
 * matches the honest state the design canvas recorded — Library and Coach
 * live, Today/Progress absent until the user_progress store ships.
 */
import { CAPABILITIES, type Capabilities } from '../capabilities';
import { DECLARED_TABS, tabIsLive, visibleTabs } from '../tabs';

describe('the tab bar is derived from the capability map', () => {
  it('this build serves all five tabs — the user_progress store shipped', () => {
    // Updated 2026-09-05 with the capability flip (chatservice ed762fd):
    // today + progress turned true the moment their store existed. The pin
    // moves WITH the map, deliberately.
    expect(visibleTabs().map((t) => t.id)).toEqual(
      ['today', 'library', 'coach', 'progress', 'profile'],
    );
  });

  it('all five design tabs stay DECLARED', () => {
    expect(DECLARED_TABS.map((t) => t.id)).toEqual(
      ['today', 'library', 'coach', 'progress', 'profile'],
    );
  });

  it('flipping a capability still changes the SET — removal, not greying', () => {
    const without: Capabilities = { ...CAPABILITIES, today: false, progress: false };
    expect(visibleTabs(without).map((t) => t.id)).toEqual(
      ['library', 'coach', 'profile'],
    );
    expect(tabIsLive('today', without)).toBe(false);
    expect(tabIsLive('today')).toBe(true);
  });

  it('an absent capability removes, it never reorders', () => {
    const noChat: Capabilities = { ...CAPABILITIES, coach: false };
    expect(visibleTabs(noChat).map((t) => t.id)).toEqual(
      ['today', 'library', 'progress', 'profile'],
    );
  });
});
