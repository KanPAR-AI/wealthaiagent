// The five-tab bar, DERIVED — the astro mechanism (its tabs.ts states the
// full rationale): pure data + one pure function, no React, so the root jest
// project can hold the property that matters — flipping one capability
// changes the SET. The layout renders whatever this returns and decides
// nothing.
//
// The design draws five tabs (Today · Library · Coach · Progress · Profile).
// All five are DECLARED; what this build can serve is what renders. Today and
// Progress are absent until the user_progress store exists — see the reasons
// in `capabilities.ts`, which is the only thing this file consults.

import { CAPABILITIES, type Capabilities } from './capabilities';

export type TabId = 'today' | 'library' | 'coach' | 'progress' | 'profile';

export interface TabDef {
  id: TabId;
  label: string;
  /** expo-router route name inside the (tabs) group — also the file name. */
  route: string;
  needs: keyof Capabilities;
}

const DECLARED: TabDef[] = [
  { id: 'today', label: 'Today', route: 'today', needs: 'today' },
  { id: 'library', label: 'Library', route: 'library', needs: 'library' },
  { id: 'coach', label: 'Coach', route: 'chat', needs: 'coach' },
  { id: 'progress', label: 'Progress', route: 'progress', needs: 'progress' },
  { id: 'profile', label: 'Profile', route: 'settings', needs: 'accountSettings' },
];

export const DECLARED_TABS: readonly TabDef[] = DECLARED;

export function visibleTabs(capabilities: Capabilities = CAPABILITIES): TabDef[] {
  return DECLARED.filter((tab) => capabilities[tab.needs]);
}

export function tabIsLive(id: TabId, capabilities: Capabilities = CAPABILITIES): boolean {
  return visibleTabs(capabilities).some((t) => t.id === id);
}
