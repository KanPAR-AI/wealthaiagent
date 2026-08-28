// The muhurta surface's decisions (docs/49 ASTRAL-17, F36, AMB-26(a)).
//
// Pure — no React, no react-native, no expo — so the ROOT jest project runs
// it and the screen decides nothing.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE HALF THAT IS NOT BUILT, AND WHY IT IS NOT FAKED
// ═══════════════════════════════════════════════════════════════════════════
//
// The obvious muhurta screen is a FORM: event type, a date window, a place.
// It is not built, and the blocker is exact, verified by running it against
// the engine in the container on 2026-08-28:
//
//   INPUT_FIELDS (graph.py:116) declares 18 fields. None of them is
//   `event_type`, `start_date`, `end_date` or an event `location`.
//
//   _MISSING_SLOT_FIELDS (graph.py:6294) bridges six slot names to those
//   fields. None of them is a MuhurtaSlots name.
//
//   So for a muhurta belief:
//       required_missing()                       -> ['event_type',
//                                                    'location', 'start_date']
//       _input_request_keys('required_slots_missing', …) -> ()
//       _input_request_block('required_slots_missing', …) -> ''
//
//   The ask has NO WIDGET. It is prose, which is ASTRAL-90's declared
//   behaviour for an ask the field table does not cover — not a defect.
//
// A native form built anyway would have to collect typed values and flatten
// them into a sentence for the extractor to parse back out. That is F18,
// named as the anti-pattern, with the shipped file that does it quoted
// verbatim: *"A native form collects typed values, flattens them to a
// sentence, and posts it so an LLM can parse them back out — with a comment
// declaring the dependency."* The structural test
// `F18 — the answer is never flattened into a sentence to be re-parsed`
// pins that pattern to the two files that already had it, so a third would
// fail the suite as well as the doctrine.
//
// The fix is four `InputFieldSpec` rows and four bridge entries in
// `graph.py` — small, and an ENGINE change to a file that is frozen this
// round. Written down here rather than done, so the next implementer finds
// the diagnosis instead of repeating it.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS BUILT
// ═══════════════════════════════════════════════════════════════════════════
//
// Everything downstream of the ask, natively:
//
//   - the turn runs from this screen, not from a chat (the headless-turn
//     pattern), so the user never leaves the surface they tapped;
//   - `muhurta_results` is drawn FULL WIDTH by the shared `MuhurtaWindowsView`
//     that has existed since PH-3 — the windows, their panchang, the Rahu
//     Kaal flag, the benefics and malefics, each score verbatim as the 0..1
//     float the engine emitted and never as a percentage (ASTRAL-19);
//   - if the engine ever DOES send an `input_request` for this ask, the same
//     screen renders it with no client change, because it renders whichever
//     block arrives rather than a form it declared itself.
//
// In between there is one plain text box carrying the user's OWN sentence.
// That is not F18: nothing typed is flattened from structured values, and
// nothing the client composed is submitted. It is the same sentence they
// would type in chat, on a surface where the answer is drawn properly.

export type MuhurtaPhase =
  /** the opening turn is out */
  | 'asking'
  /** the engine asked in prose; the user answers in their own words */
  | 'prose_ask'
  /** the engine sent a structured ask — rendered, if it ever does */
  | 'form_ask'
  /** an answer is on its way */
  | 'computing'
  /** windows came back */
  | 'windows'
  /** the engine answered in words and computed nothing */
  | 'said'
  | 'error';

/**
 * The turn that opens the muhurta arc.
 *
 * A sentence naming an INTENT and no value — the same discipline as every
 * other opening turn in this app. The engine decides what it needs.
 */
export const MUHURTA_OPENING_TURN = 'I’d like to find an auspicious time.';

/**
 * The placeholder in the reply box.
 *
 * A HINT, in the same sense `BrandTokens.copy.fieldHints` is a hint: it shows
 * the shape of a complete answer so the user is not made to guess what the
 * engine wants. It is never submitted, never pre-filled and never defaulted —
 * an empty box sends nothing.
 */
export const MUHURTA_REPLY_HINT =
  'e.g. a wedding in Pune, sometime in the first half of September';

/** What the screen says while it is waiting for the engine to ask. */
export const MUHURTA_OPENING_LINE = 'Working out what I need to know…';

/** Nothing came back at all — the state that used to spin forever. */
export const MUHURTA_EMPTY_LINE =
  'That didn’t come back. Try again, or continue in chat.';

/** The user's sentence is worth sending when it is not blank. */
export function replyReady(text: string): boolean {
  return text.trim().length > 0;
}

export type MuhurtaReplyKind = 'windows' | 'form_ask' | 'prose_ask' | 'said' | 'empty';

/**
 * What came back, in the order that decides the screen.
 *
 * Windows first: a reply carrying both a computed result and a follow-up
 * question is a result, and burying it under the question would be the
 * screen editing the engine.
 */
export function muhurtaReplyKind(
  hasWindows: boolean,
  hasForm: boolean,
  prose: string,
  stillAsking: boolean,
): MuhurtaReplyKind {
  if (hasWindows) return 'windows';
  if (hasForm) return 'form_ask';
  if (!prose.trim()) return 'empty';
  return stillAsking ? 'prose_ask' : 'said';
}

/**
 * Does the engine's reply still want something from the user?
 *
 * Deliberately NOT a regex over the sentence: a question mark is not a
 * commitment and "which city?" and "I could not compute that" would both
 * match a naive cue. The screen knows something the prose does not — whether
 * the engine has computed anything yet — and that is what this reads. Before
 * a result exists, a prose reply is the ask; after one exists, it is
 * commentary.
 */
export function stillAsking(hasEverComputed: boolean): boolean {
  return !hasEverComputed;
}
