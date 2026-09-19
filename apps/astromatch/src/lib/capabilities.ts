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
  /** type a person's details into the widget — flow (4), PH-39 ASTRAL-327/328 */
  manualEntry: boolean;
  /** paste biodata text and review what was parsed — flow (2), PH-39 ASTRAL-325/326 */
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
   * TRUE as of PH-41 (ASTRAL-338). It is the only path in this extension
   * that touches a page's DOM at all, and it touches exactly what the user
   * highlighted: `chrome.scripting.executeScript` with a three-line function
   * that returns `window.getSelection().toString()` and keeps nothing. The
   * text is parsed HERE, by the same local parser the paste path uses, so
   * this path sends nothing anywhere, spends no capture allowance and makes
   * no model call. There is no `content_scripts` key and no site adapter:
   * the product works because the user points at the text (X-2, X-3).
   */
  readSelection: boolean;
  /**
   * The shortlist: `GET /people/matches`'s three labelled groups.
   *
   * TRUE as of PH-41 (ASTRAL-339). A VIEW of the People store and never a
   * second store: the groups arrive labelled, each with the sort rule the
   * ENGINE applied, and the panel renders them in the order they were sent
   * without ever ordering across them (F151). Favourite rides the shipped
   * `PATCH /people/{id}`, which takes a label and no birth fact.
   */
  shortlist: boolean;
  /**
   * Compare up to five stored matches side by side.
   *
   * TRUE as of PH-41 (ASTRAL-340), and it still depends on `shortlist`
   * above — the columns are picked there. Every number in a column comes off
   * a stored scorecard through `@wealthai/astral`'s own view models, the
   * columns stay in the order the user picked them, and there is no rank, no
   * winner, no composite and no percentage: a `/36` and a firm-only `/15`
   * are not on one scale and `matching.py:471-473` refuses the rescale.
   */
  compare: boolean;

  /**
   * One chat per saved match (ASTRAL-341).
   *
   * TRUE as of PH-41. The affordance opens a conversation scoped to one
   * stored match — one chat id per match, so the engine's slot store and
   * event log work unchanged — and the handoff carries ids and the opener
   * sentence, never a restated block of birth values. Entering recomputes
   * nothing: the engine rehydrates the STORED scorecard.
   */
  matchChat: boolean;
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
  readSelection: true,
  shortlist: true,
  compare: true,
  saveMatch: true,
  matchChat: true,
};
