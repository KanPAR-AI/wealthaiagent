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
   * vision extractor (PH-40, ASTRAL-330…333).
   *
   * TRUE as of PH-40. `POST /astrology/extract-profile` is live (PH-38), and
   * the F159 gesture question is answered by BUILDING FOR THE PESSIMISTIC
   * BRANCH rather than by an assumption: the camera button asks the worker
   * to capture, and a worker that has no `activeTab` grant answers with the
   * INSTRUCTION naming the two gestures that grant one unambiguously — the
   * Alt+Shift+M command and the "Read this page into AstroMatch" menu item.
   * A button that cannot capture becomes words, never a no-op.
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
   * TRUE as of PH-40 (ASTRAL-334). Saving is the one act that mints a
   * PERSON, and the provenance it must be stamped with — `parsed_from_page`
   * for a fact the user accepted unchanged — travels on `capture_source`
   * and `capture_edited`, which the engine declares as of PH-38
   * (`graph.INPUT_FIELDS`; `config.ENGINE_HAS_CAPTURE_FIELDS`). Saving
   * before those existed would have stamped every fact `stated_by_user`,
   * which is the exact thing the provenance ladder exists to prevent (F143)
   * and is unfixable afterwards, because a machine origin may never
   * overwrite a statement.
   *
   * The other outcome — "Instant reading, don't save" — is the offer left
   * UNANSWERED (F148/F149), and the chat it created is deleted when the
   * user leaves or closes the panel (`retention-view.ts`).
   */
  saveMatch: boolean;
}

export const capabilities: Capabilities = {
  signIn: true,
  manualEntry: true,
  paste: true,
  snapshot: true,
  readSelection: false,
  shortlist: false,
  compare: false,
  saveMatch: true,
};
