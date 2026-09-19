/**
 * What this build can actually DO — declared once, in one place.
 *
 * `apps/astro`'s law, inherited verbatim (doctrine 8 / docs/49 ASTRAL-102): a
 * capability marked absent REMOVES its control rather than rendering it
 * disabled or "coming soon". A greyed button and a "coming with the next
 * update" panel are the same dead affordance wearing different clothes.
 *
 * Every `false` below carries its reason. A capability map that lies is worse
 * than a missing screen, and `capabilities.test.ts` fails a `false` with no
 * reason recorded next to it.
 */

export interface Capabilities {
  /** OTP → Firebase custom token, in the panel, no popup (ASTRAL-323) */
  signIn: boolean;
  /** type a person's details into the widget — flow (4) */
  manualEntry: boolean;
  /** paste biodata text and review what was parsed — flow (2) */
  paste: boolean;
  /**
   * The camera: `chrome.tabs.captureVisibleTab` → crop → consent → the
   * vision extractor.
   *
   * FALSE: PH-40. It needs `POST /astrology/extract-profile`, which does not
   * exist yet (docs/73 ASTRAL-315/316, F146), and it needs the `activeTab`
   * gesture spike (F159) — whose outcome this spec explicitly refuses to
   * assert from documentation. A camera button that opened a picker and then
   * said "we couldn't reach the extractor" is the dead affordance the rule
   * above forbids.
   */
  snapshot: boolean;
  /**
   * "Read my selection" — one programmatic injection on the user's click.
   *
   * FALSE: PH-41. No DOM read happens on ANY path in PH-39, which is that
   * phase's stated negative space.
   */
  readSelection: boolean;
  /**
   * The shortlist: `GET /people/matches`'s three labelled groups.
   *
   * FALSE: PH-41. The read exists server-side; the panel that renders the
   * groups (without ever ordering across them — F151) does not.
   */
  shortlist: boolean;
  /**
   * Compare up to five stored matches side by side.
   *
   * FALSE: PH-41, and it depends on `shortlist` above.
   */
  compare: boolean;
  /**
   * "Add to my matches" — answering the engine's save offer.
   *
   * FALSE: PH-40 (ASTRAL-334). Saving is the one act that mints a PERSON,
   * and the provenance it must be stamped with — `parsed_from_page` for a
   * fact the user accepted unchanged — travels on `capture_source`, a field
   * the engine does not declare yet (docs/73 ASTRAL-313, and `config.ts`'s
   * ENGINE_HAS_CAPTURE_FIELDS). Saving before it exists would stamp every
   * fact `stated_by_user`, which is the exact thing the provenance ladder
   * exists to prevent (F143) — and it is unfixable afterwards, because a
   * machine origin may never overwrite a statement.
   *
   * So the offer is not rendered, and what DID happen is stated instead:
   * nothing durable was written (F149), and the conversation this reading
   * created is DELETED when the user leaves or closes the panel
   * (`retention-view.ts`).
   */
  saveMatch: boolean;
}

export const capabilities: Capabilities = {
  signIn: true,
  manualEntry: true,
  paste: true,
  snapshot: false,
  readSelection: false,
  shortlist: false,
  compare: false,
  saveMatch: false,
};
