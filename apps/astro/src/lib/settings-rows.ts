// Screen 12's row set, DERIVED from the capability map (docs/49 ASTRAL-109).
//
// Pure data and one pure function: no React, no react-native, no expo — so it
// can be unit-tested in the root jest project, which has no React Native
// renderer. The screen renders whatever this returns and decides nothing.

// Type-only, so this module still imports nothing at runtime and still runs
// under the root jest project: it buys real checking of the five symbol names
// below, instead of a cast at the call site.
import type { SFSymbol } from 'sf-symbols-typescript';

import { CAPABILITIES, type Capabilities } from './capabilities';

export type SettingsRowId =
  | 'account'
  | 'privacy'
  | 'birthDetails'
  | 'help'
  | 'about';

export interface SettingsRow {
  id: SettingsRowId;
  label: string;
  /** SF Symbol name; every host passes a drawn fallback (see glyphs.tsx). */
  icon: SFSymbol;
  /** where it goes, or `expand` for the rows that open in place */
  action: { kind: 'route'; to: string } | { kind: 'expand' };
  /** the capability that has to be true for this row to exist at all */
  needs: keyof Capabilities;
}

/**
 * The board draws eight rows. Five of them are ASTRAL-109's "ships" list and
 * are declared here; the other three (Subscription & Billing, Notifications,
 * Saved Readings) are not declared AT ALL rather than declared-and-hidden,
 * because there is nothing behind them to switch on.
 */
const DECLARED: SettingsRow[] = [
  {
    id: 'account',
    label: 'Account Settings',
    icon: 'person.crop.circle',
    action: { kind: 'expand' },
    needs: 'accountSettings',
  },
  {
    id: 'privacy',
    label: 'Privacy & Data',
    icon: 'lock.shield',
    action: { kind: 'route', to: '/privacy' },
    needs: 'privacyAndData',
  },
  {
    id: 'birthDetails',
    label: 'Birth Details',
    icon: 'calendar',
    action: { kind: 'route', to: '/birth-details' },
    needs: 'birthDetails',
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: 'questionmark.circle',
    action: { kind: 'route', to: '/help' },
    needs: 'helpAndSupport',
  },
  {
    id: 'about',
    label: 'About',
    icon: 'info.circle',
    action: { kind: 'route', to: '/about' },
    needs: 'about',
  },
];

/** Every row DECLARED, whether or not this build can serve it. */
export const DECLARED_ROWS: readonly SettingsRow[] = DECLARED;

/**
 * The rows this build may render.
 *
 * Absent capability → absent row. Not greyed, not "coming soon": ASTRAL-102's
 * unit obligation is that flipping one capability changes the SET.
 */
export function visibleRows(capabilities: Capabilities = CAPABILITIES): SettingsRow[] {
  return DECLARED.filter((row) => capabilities[row.needs]);
}
