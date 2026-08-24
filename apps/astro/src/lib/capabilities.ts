// What this build can actually DO — declared once, in one place (docs/49
// ASTRAL-102 / ASTRAL-109).
//
// The rule both rows state: a capability marked absent REMOVES its row rather
// than rendering it disabled or "coming soon". A greyed row and a "coming with
// the next update" screen are the same dead affordance wearing different
// clothes, and ASTRAL-102's negative space forbids both. So this map is the
// only thing a surface may consult, and flipping one entry is what makes a row
// appear — nothing here is styled, and nothing here is a screen.
//
// Every `false` below has a reason recorded next to it. A capability map that
// lies is worse than a missing screen.

export interface Capabilities {
  /** sign in / sign out / see which account you are — `lib/auth.ts`, live */
  accountSettings: boolean;
  /** the credits balance and ledger — `lib/credits.ts`, live */
  credits: boolean;
  /**
   * What this app holds about you and what can be removed.
   *
   * TRUE only in the narrow sense ASTRAL-109 amends it to: memories and chat
   * state have live per-user authorised delete paths server-side. It must
   * never offer to delete palm images or uploaded reports — F7: the only
   * `blob.delete()` is commented out and there is no DELETE route, so that
   * affordance would report success and remove nothing.
   */
  privacyAndData: boolean;
  /**
   * Editing birth details, routed through `reconcile`.
   *
   * FALSE: ASTRAL-67's convergence path does not exist in this app, and a
   * settings screen that writes birth details around `reconcile` is the
   * classic place the cascade gets broken (ASTRAL-39). The row is therefore
   * ABSENT rather than disabled — the honest form of "not yet".
   */
  birthDetails: boolean;
  helpAndSupport: boolean;
  about: boolean;
  /**
   * Reporting a problem from inside the app (docs/49 ASTRAL-163).
   *
   * TRUE, and it is a capability rather than a decoration: the report goes
   * to the SAME `/bug-reports` endpoint and the same /admin/bugs queue the
   * rest of the platform uses, through the shared sheet. If that path ever
   * stopped existing, this flips and the row disappears — which is the
   * difference between an affordance and a promise.
   */
  reportProblem: boolean;
  /** FALSE: ASTRAL-66's store does not exist. Nothing to save into. */
  savedReadings: boolean;
  /**
   * FALSE, and not a scheduling question: AMB-1 and AMB-2 are open, and
   * `credits.py` has four routes (balance, ledger, request, requests), none of
   * them an entitlement or a receipt validation. No row may open a purchase
   * flow for a price nobody has decided.
   */
  subscriptionBilling: boolean;
  /**
   * FALSE: FR-019 has no transport to a phone — no push client in either app
   * and no FCM/APNs/Expo-push path server-side — and "notable" is a diff
   * between consecutive N1 artifacts, which is downstream of PH-8.
   */
  notifications: boolean;
}

export const CAPABILITIES: Capabilities = {
  accountSettings: true,
  credits: true,
  privacyAndData: true,
  birthDetails: false,
  helpAndSupport: true,
  about: true,
  reportProblem: true,
  savedReadings: false,
  subscriptionBilling: false,
  notifications: false,
};
