/**
 * docs/49 ASTRAL-109 / ASTRAL-102 — the row set is DERIVED, and an absent
 * capability removes a row rather than disabling it.
 *
 * Imported by relative path on purpose: the root jest project maps `@/*` to
 * the WEB app's `src`, so `@/lib/...` inside an apps/astro test would silently
 * resolve to a different file.
 */

import { CAPABILITIES, type Capabilities } from '../capabilities';
import { DECLARED_ROWS, visibleRows } from '../settings-rows';

describe('the settings rows this build may render', () => {
  // AMENDED 2026-08-24 by ASTRAL-163 (owner): "Report a problem" joins the
  // set. The exact-set assertions below are pins of the SET, and the set
  // changed — this is the spec moving, not a failing assertion being
  // relaxed. The new row is held to the same rule as the other five: it
  // exists because `reportProblem` is true, and turning that off removes it
  // (the case at the foot of this block).
  it('ships the five rows that have something behind them', () => {
    expect(visibleRows().map((r) => r.label)).toEqual([
      'Account Settings',
      'Privacy & Data',
      'Help & Support',
      'About',
      'Report a problem',
    ]);
  });

  it('omits Birth Details, because the reconcile-routed editor does not exist', () => {
    // ASTRAL-109 lists five "ships" rows, and this is the fifth. It is DECLARED
    // — so the day ASTRAL-67 lands, one boolean turns it on — but it is not
    // rendered, because ASTRAL-102's rule is that an absent capability removes
    // the row. A greyed row or a "coming with the next update" screen is the
    // dead affordance that rule exists to forbid.
    expect(CAPABILITIES.birthDetails).toBe(false);
    expect(DECLARED_ROWS.map((r) => r.id)).toContain('birthDetails');
    expect(visibleRows().map((r) => r.id)).not.toContain('birthDetails');
  });

  it('flipping one capability changes the SET, not a row style', () => {
    const before = visibleRows().map((r) => r.id);
    const after = visibleRows({ ...CAPABILITIES, birthDetails: true }).map((r) => r.id);
    expect(after).not.toEqual(before);
    expect(after).toContain('birthDetails');
    // and it lands in the board's order, between Privacy and Help
    expect(after).toEqual([
      'account', 'privacy', 'birthDetails', 'help', 'about', 'reportProblem',
    ]);
  });

  it('turning a capability off removes exactly that row', () => {
    const off: Capabilities = { ...CAPABILITIES, privacyAndData: false };
    expect(visibleRows(off).map((r) => r.id)).toEqual([
      'account', 'help', 'about', 'reportProblem',
    ]);
  });

  it('ASTRAL-163 — the report row obeys the same rule as every other', () => {
    // It is a capability, not a decoration: the report goes to the same
    // /bug-reports endpoint the rest of the platform uses, and if that path
    // stopped existing the row would go with it rather than becoming a
    // button that reports into nothing.
    expect(visibleRows().map((r) => r.id)).toContain('reportProblem');
    const off: Capabilities = { ...CAPABILITIES, reportProblem: false };
    expect(visibleRows(off).map((r) => r.id)).not.toContain('reportProblem');
  });

  it('ASTRAL-163 — the report row raises the sheet in place, it does not route', () => {
    // The sheet photographs the screen it was raised FROM, before opening.
    // A row that navigated first would attach a picture of the wrong screen.
    const row = DECLARED_ROWS.find((r) => r.id === 'reportProblem')!;
    expect(row.action.kind).toBe('report');
  });

  it('declares no row for the three ASTRAL-109 forbids', () => {
    // Subscription & Billing (AMB-1/AMB-2 open, no entitlement backend),
    // Notifications (FR-019 has no transport), Saved Readings (ASTRAL-66's
    // store does not exist). Not hidden — never declared.
    const labels = DECLARED_ROWS.map((r) => r.label.toLowerCase()).join('|');
    expect(labels).not.toContain('subscription');
    expect(labels).not.toContain('billing');
    expect(labels).not.toContain('notification');
    expect(labels).not.toContain('saved');
    expect(labels).not.toContain('premium');
  });

  it('no row opens a purchase flow', () => {
    for (const row of DECLARED_ROWS) {
      if (row.action.kind !== 'route') continue;
      expect(row.action.to).not.toMatch(/pay|purchase|subscribe|billing|upgrade|premium/i);
    }
  });
});
