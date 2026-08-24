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
  | 'profile'
  | 'matches'
  | 'privacy'
  | 'birthDetails'
  | 'help'
  | 'about'
  | 'reportProblem';

export interface SettingsRow {
  id: SettingsRowId;
  label: string;
  /** SF Symbol name; every host passes a drawn fallback (see glyphs.tsx). */
  icon: SFSymbol;
  /** where it goes, `expand` for the rows that open in place, or `report`
   *  for the one that raises the shared bug sheet over this screen
   *  (docs/49 ASTRAL-163) */
  action: { kind: 'route'; to: string } | { kind: 'expand' } | { kind: 'report' };
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
    // docs/49 ASTRAL-135/136. Sits directly under the account block because
    // that is what the board's frame 12 groups it with — who you are, then
    // what we hold about you.
    id: 'profile',
    label: 'Your Profile',
    icon: 'person.text.rectangle',
    action: { kind: 'route', to: '/profile' },
    needs: 'profile',
  },
  {
    // docs/49 ASTRAL-140..146. The board draws this as a shortlist inside
    // the extension (frame 18); in the app it is a screen of its own.
    id: 'matches',
    label: 'My Matches',
    icon: 'heart.text.square',
    action: { kind: 'route', to: '/matches' },
    needs: 'matches',
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
  {
    // ASTRAL-163, owner 2026-08-24. Not one of the board's eight rows: the
    // board was drawn before this was asked for, and a row with a live path
    // behind it is exactly what ASTRAL-102 says may exist.
    id: 'reportProblem',
    label: 'Report a problem',
    icon: 'exclamationmark.bubble',
    action: { kind: 'report' },
    needs: 'reportProblem',
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
