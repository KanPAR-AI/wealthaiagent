/**
 * The capability rule as a property of the tab SET (the astro obligation):
 * flipping one capability changes what exists, and the current build's map
 * matches the honest state the design canvas recorded — Library and Coach
 * live, Today/Progress absent until the user_progress store ships.
 */
import { CAPABILITIES, type Capabilities } from '../capabilities';
import { DECLARED_TABS, tabIsLive, visibleTabs } from '../tabs';

describe('the tab bar is derived from the capability map', () => {
  it('this build serves exactly Library, Coach and Profile', () => {
    expect(visibleTabs().map((t) => t.id)).toEqual(['library', 'coach', 'profile']);
  });

  it('all five design tabs stay DECLARED even while absent', () => {
    expect(DECLARED_TABS.map((t) => t.id)).toEqual(
      ['today', 'library', 'coach', 'progress', 'profile'],
    );
  });

  it('flipping a capability changes the SET — today appears when its store ships', () => {
    const withStore: Capabilities = { ...CAPABILITIES, today: true, progress: true };
    expect(visibleTabs(withStore).map((t) => t.id)).toEqual(
      ['today', 'library', 'coach', 'progress', 'profile'],
    );
    expect(tabIsLive('today', withStore)).toBe(true);
    expect(tabIsLive('today')).toBe(false);
  });

  it('an absent capability removes, it never reorders', () => {
    const noChat: Capabilities = { ...CAPABILITIES, coach: false };
    expect(visibleTabs(noChat).map((t) => t.id)).toEqual(['library', 'profile']);
  });
});
