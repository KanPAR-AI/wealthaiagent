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
   *
   * NOT the same thing as `profile` below, and the difference is the whole
   * of ASTRAL-138: Profile shows the details and hands a CORRECTION to the
   * chat carrier; it never writes one. A row that edited them here would be
   * the second fact-writer INV-1 forbids.
   */
  birthDetails: boolean;

  /**
   * Your own profile: birth details with their provenance, and the stamped
   * chart summary (docs/49 ASTRAL-135/136/137).
   *
   * TRUE since PH-6 shipped `GET /people/self` — the first user-scoped read
   * in this product (F23). Before it existed this row could not have been
   * turned on honestly: nothing could show a user their own chart outside
   * the turn that computed it, so the screen would have had to recompute
   * one, which is what ASTRAL-135 forbids. The capability IS the read.
   */
  profile: boolean;

  /**
   * Screen 5 — the chart itself: Chart · Grahas · Dasha (docs/49 ASTRAL-120,
   * ASTRAL-233).
   *
   * TRUE since `GET /people/{id}/chart` (ASTRAL-229). Before that read
   * existed this could not have been turned on honestly, and the map said so
   * by NOT declaring it: `person_view` attaches a chart SUMMARY, and no
   * `GET` anywhere returned a chart's contents (F82), so a chart screen would
   * have had to ask a model for the artifact the engine had already computed.
   * The capability IS the read.
   *
   * It is also what redeems the Home tile. "Birth Chart" pointed at
   * `/profile` — a summary of the thing it named — because pointing at an
   * unbuilt screen is the dead affordance ASTRAL-119 forbids (F93). Flipping
   * this to false puts the tile back in that position by REMOVING it, not by
   * greying it.
   */
  chart: boolean;

  /**
   * The palm reading — capture, analysis and the result, natively
   * (docs/49 ASTRAL-44..49; F36; AMB-26 recommended (a)).
   *
   * FALSE, and the reason is a LIVE ENGINE DEFECT rather than unbuilt client
   * work. The screen exists at `app/palm.tsx`, the renderer ships, the
   * upload path ships. What does not work is the engine's own capture ask,
   * and without it this surface cannot do what its tile would promise.
   *
   * ── the catch-22, measured 2026-08-28, both arms, 2/2 each ──────────────
   *
   * `merge_belief` gates an intent switch on `_new_intent_has_required_slot_
   * in_delta` (belief.py:429). `PalmSlots.required_for_compute()` is
   * `{has_image}`, which is non-empty, so the "no required slots" arm does
   * not apply; the personal-facts arm covers dob/tob/pob only. So:
   *
   *   WORDS ALONE — "I'd like a palm reading." / "Please read my palm."
   *     extractor: action=SWITCH switch_conf=1.00 new_intent=palm slot_ops=0
   *     belief:    intent SWITCH refused (conf=1.00 need 0.80,
   *                slot_evidence=False); treating as KEEP
   *     route:     reason=general_conversation
   *     -> the belief never becomes `palm`, so `graph.py:3655`'s
   *        `palm_intent_needs_upload` branch is never reached and the
   *        role-labelled two-hand widget is never emitted.
   *
   *   WITH AN IMAGE — the same words plus an attachment
   *     belief:    intent SWITCH general -> palm (slot_evidence=True)
   *     route:     reason=multi_intent_palm_then_kundli -> node=palm
   *     -> the ask is SKIPPED, because there is already a photo to analyse.
   *
   * So `palm_intent_needs_upload` is unreachable by ANY route. It is bug
   * 8dc95a6a's fix and ASTRAL-46's whole subject — the role label is the one
   * thing vision cannot supply, and a hand established by model guess costs
   * the 0.65 reliability discount (`adjudication.py:57`) on every verdict the
   * palm touches. Shipping the surface anyway would mean either a dead end
   * (the screen reaches the engine's prose and hands off to a composer with
   * no attach button) or a client-declared photo form that loses the role
   * labelling — the discounted reading ASTRAL-46 exists to prevent.
   *
   * This map's own rule decides it: a capability map that lies is worse than
   * a missing screen. The tile and the pushed route are REMOVED. Flipping
   * this one entry restores both, and that is the intended repair — the
   * client half is done and unit-tested.
   *
   * The palm RENDERER is unaffected and does ship: `palm_analysis` is
   * registered in the shared block registry, so a reading produced by any
   * route is drawn rather than silently dropped.
   */
  palm: boolean;

  /**
   * The muhurta surface — an auspicious window, computed and drawn natively
   * (docs/49 ASTRAL-17; F36; AMB-26 recommended (a)).
   *
   * TRUE for the RESULT and the conversation that produces it; the row's own
   * comment in `muhurta-view.ts` records what is still prose. The renderer
   * has existed since PH-3 and is registered; `compute_muhurta_windows` is a
   * shipped node; what does not exist is a structured ask for the three
   * slots `MuhurtaSlots.required_for_compute` names — see `muhurta-view.ts`
   * for the exact blocker and why the screen does not fake one.
   */
  muhurta: boolean;

  /**
   * Screen 3, Home — the day's card (docs/49 ASTRAL-125).
   *
   * TRUE since `GET /people/self/daily`. Before that read existed a Home
   * screen could only have composed "today" out of raw positions on the
   * client, which is exactly what ASTRAL-112/125 forbid: the screen renders
   * ONE dated artifact the engine assembled and stamped, or it renders a
   * stated absence. The capability IS the read.
   */
  home: boolean;

  /**
   * Screen 8, Daily Guidance — the same artifact, faceted (ASTRAL-126).
   *
   * Deliberately a SEPARATE capability from `home` even though one endpoint
   * serves both: the two screens can be withdrawn independently, and a
   * single flag would make "we removed Insights" impossible to say without
   * removing Home too. Both are false together only if the read goes away.
   */
  dailyGuidance: boolean;

  /**
   * Screen 9, Timeline — the dasha periods with transit windows folded in
   * (ASTRAL-127).
   *
   * TRUE since `GET /people/self/timeline`. The year pills filter ONE
   * computed set that arrives whole, so this capability is also the reason
   * the screen can promise an instant year change.
   */
  timeline: boolean;

  /**
   * The conversation itself (docs/49 ASTRAL-105/106).
   *
   * TRUE, and it is a capability rather than a constant because the tab bar
   * derives from this map with no exceptions. A hard-coded chat tab beside
   * four derived ones would be the one entry nobody could turn off, and the
   * mechanism ASTRAL-119 asks for is that the SET is derived — not that
   * four fifths of it is.
   */
  aiChat: boolean;

  /**
   * The saved matches list (docs/49 ASTRAL-140..146).
   *
   * TRUE since `GET /people/matches` — matches are keyed to a PAIR of person
   * ids and outlive the chat that computed them. Under the old shape (one
   * `gun_milan_data` key, 24-hour TTL, overwritten by the next partner —
   * F37) a "My Matches" row would have pointed at a list that could hold one
   * entry until tomorrow.
   */
  matches: boolean;
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
  chart: true,
  palm: false,
  muhurta: true,
  credits: true,
  privacyAndData: true,
  birthDetails: false,
  home: true,
  dailyGuidance: true,
  timeline: true,
  aiChat: true,
  profile: true,
  matches: true,
  helpAndSupport: true,
  about: true,
  reportProblem: true,
  savedReadings: false,
  subscriptionBilling: false,
  notifications: false,
};
