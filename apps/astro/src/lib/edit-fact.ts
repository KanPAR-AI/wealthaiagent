// Editing a birth fact IN PLACE (docs/49 ASTRAL-138, amended 2026-08-26 for
// owner bug 10761055: "why do I need to go to chat to change dob — why can't
// it happen here, it's introducing too much friction").
//
// PURE: no React, no react-native, no expo — so the root jest project can run
// it, which is where every rule below is enforced. The screens render what
// these functions return and decide nothing.
//
// ── what moved, and what did not ───────────────────────────────────────────
//
// The SURFACE moved: a fact on Profile is now tapped and changed there. The
// WRITE PATH did not, and this module is where that distinction is kept
// honest. There is no endpoint that accepts a birth fact and there must not
// be one (F24); `reconcile` is the only fact-writer (INV-1). So an edit is
// still: a SENTENCE of intent → the engine's `input_request` → the typed
// `input_response` carrier → `reconcile`. The chat that carries it is opened
// headless behind the screen and never shown.
//
// Nothing in this file carries a VALUE. A route param holding a birth time
// would be a fact travelling to state without passing `reconcile`, which is
// the one thing the whole feature is arranged to prevent.

import { FACT_ORDER, type FactKey } from './profile-view';

/**
 * The sentence that opens each correction — ONE DECLARED CONSTANT PER FACT,
 * and this is the pin that keeps the client and the engine from drifting.
 *
 * The engine fires a deterministic cue (`graph.py::_CORRECT_FIELD_CUE`) that
 * needs a REQUEST SHAPE — a correction verb governing a possessed fact —
 * because the vocabulary alone is never a request ("is my birth time
 * correct?" must not open a picker). These three strings are positive shapes
 * of that cue, and `chatservice/tests/test_astrology_field_correction.py`
 * asserts each of them fires it and names the right field.
 *
 * That mutual pin is the point. A sentence composed at runtime ("I need to
 * correct my " + label) can drift out of the cue's shape with NOTHING going
 * red: the user taps "Change it", the engine answers with a paragraph
 * instead of a picker, and the screen shows the honest "not a form" state
 * forever. Two files that assert the same literal cannot fail that quietly.
 */
export const CORRECTION_TURNS: Record<FactKey, string> = {
  date_of_birth: 'Please correct my date of birth.',
  time_of_birth: 'Please correct my birth time.',
  place_of_birth: 'Please correct my birth place.',
};

/** Is this a fact this app knows how to open a correction for? */
export function isEditableFactKey(field: string): field is FactKey {
  return (FACT_ORDER as readonly string[]).includes(field);
}

/**
 * The opening turn for a field, or null when this build has no sentence for
 * it. Null rather than a composed fallback, deliberately: a sentence this
 * module did not declare is a sentence no engine test has ever fired, and
 * sending it would produce the silent prose degradation described above.
 */
export function correctionTurn(field: string): string | null {
  return isEditableFactKey(field) ? CORRECTION_TURNS[field] : null;
}

export interface EditRoute {
  pathname: '/birth-details';
  params: { opening: string; field: FactKey; returnTo: 'profile' };
}

/**
 * Where "Change it" goes.
 *
 * Screen 2's own screen, with two extra params. It is the SAME mechanism —
 * open the pinned chat headless, render the engine's `input_request`
 * full-screen, hand back the typed carrier — because a second screen that
 * drew its own date/time/place fields would be the second widget ASTRAL-91
 * forbids, and would drift from the engine's payload the first time a kind
 * changed. `returnTo` is the only behavioural difference: a correction lands
 * back on Profile, not in a chat the user never asked to see.
 */
export function editRoute(field: string): EditRoute | null {
  const opening = correctionTurn(field);
  if (!opening || !isEditableFactKey(field)) return null;
  return { pathname: '/birth-details', params: { opening, field, returnTo: 'profile' } };
}

/** Does this screen instance belong to an in-place edit? */
export function isReturningEdit(returnTo: string | undefined): boolean {
  return returnTo === 'profile';
}

const BLOCK_FENCE = /```[\s\S]*?```/g;

/**
 * The outcome line, out of the engine's own reply.
 *
 * VERBATIM, and out of the ENGINE. The sentence that says what a correction
 * invalidated ("Your birth time is now 15:20. That leaves your chart and 1
 * saved match to be recomputed…") is computed server-side from the same
 * `edit_impact` the Profile sheet promised from — so the promise and the
 * receipt cannot disagree. A sentence composed here from a count this screen
 * guessed at would be a second answer to the same question.
 *
 * Fenced blocks are stripped (a correction turn carries none today, and a
 * screen that rendered raw JSON at the user because one arrived would be the
 * failure `parseInputRequest` exists to prevent), italic note markers are
 * unwrapped, and the FIRST paragraph is taken: the outcome leads the reply
 * by construction, and anything after it belongs to the transcript.
 */
export function outcomeLine(reply: string | undefined | null): string {
  const text = String(reply ?? '').replace(BLOCK_FENCE, '').trim();
  if (!text) return '';
  const first = text.split(/\n\s*\n/).find((p) => p.trim().length > 0) ?? '';
  return first
    .trim()
    .replace(/^\*+\s*Note:\s*/i, '')
    .replace(/\*+$/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

export type EditFailure = 'transport' | 'no_form' | 'refused';

/**
 * What to say when an edit does not complete — and the three cases are kept
 * apart on purpose.
 *
 * "We could not reach the engine", "the engine answered but did not offer a
 * form" and "the engine refused the value" are three different facts about
 * the world, and collapsing them into "something went wrong" is what makes a
 * user try the same thing four times. The refusal's own words come from the
 * engine (INV-4 says it names a reason); this only frames them.
 */
export function editFailure(kind: EditFailure, detail?: string): string {
  const said = String(detail ?? '').trim();
  if (kind === 'transport') {
    return `I couldn't reach the engine to make that change${said ? ` (${said})` : ''}. ` +
      'Nothing was changed — try again in a moment.';
  }
  if (kind === 'no_form') {
    return (
      'The engine answered without the picker this time, so there is nothing to ' +
      'change here. Nothing was changed — you can make the correction in chat.'
    );
  }
  return said
    ? `That value was not accepted: ${said}`
    : 'That value was not accepted, so nothing was changed.';
}
