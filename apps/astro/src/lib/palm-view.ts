// The palm surface's decisions (docs/49 ASTRAL-44..49, AMB-26(a)).
//
// Pure — no React, no react-native, no expo — so the ROOT jest project runs
// it and the screen renders what it returns and decides nothing.
//
// ── what this screen is ────────────────────────────────────────────────────
//
// Palm is a live engine intent with a shipped two-pass vision analysis, a
// classical-rule layer with citations, and a role-labelled two-hand capture
// ask. What it never had is a SURFACE: F36 records that neither palm nor
// muhurta appears on any of the board's twelve frames, and AMB-26 asks where
// they live. So the reading was reachable only by typing into a chat and
// attaching a photo — and in this app the composer has no attach button.
//
// This screen is AMB-26's recommended (a) — "screen 3's tile row gains Palm
// Reading and Muhurta" — taken as a default under the standing rule that a
// recommendation stands unless the owner overrides it (§6, 2026-08-27). It
// is deliberately NOT (b): no sixth tab ships, `tabs.ts` is unchanged in its
// tab set, and the bar is still five. A tile and a pushed screen pre-empt
// nothing — the same shape ASTRAL-233 used for the chart while AMB-50 is
// open.
//
// ── the computation happens in a turn, and that is not a workaround ───────
//
// ASTRAL-242's zero-turn rule names the surfaces it binds: Home, Insights,
// Timeline, the chart, Matches, a scorecard, Profile. Every one of those
// READS a stored artifact. A palm reading is not a read — there is nothing
// to read until a photograph has been analysed — so it runs the engine, once,
// through the same lifecycle every other turn uses. The user does not see a
// chat; they see this screen. That is the headless-turn pattern
// `birth-details.tsx` established, and the reason it is the right one here is
// the same reason it was right there: the ask, the fields and the analysis
// are all the engine's, and nothing is composed on the client for a model to
// parse back out (F18).

/** The engine asks for these; the screen renders whichever arrives. */
export type PalmAskKind = 'upload' | 'handedness' | 'other';

/**
 * Which ask arrived.
 *
 * Read off the engine's own `ask` reason, never off the field set: a field
 * list is a shape that two different asks can share, and the reason is the
 * engine's statement of what it is asking FOR.
 */
export function palmAskKind(ask: string | null | undefined): PalmAskKind {
  if (ask === 'palm_intent_needs_upload') return 'upload';
  if (ask === 'handedness_for_palm') return 'handedness';
  return 'other';
}

export type PalmPhase =
  /** the retention disclosure, before any photo is chosen */
  | 'disclosure'
  /** the turn is out; the engine has not answered yet */
  | 'asking'
  /** the engine asked for photos (or for handedness) */
  | 'capture'
  /** the photos are in and the analysis turn is running */
  | 'analysing'
  /** a reading came back */
  | 'reading'
  /** the engine answered, and it was not a reading — its words are shown */
  | 'engine_said'
  /** the transport failed */
  | 'error';

export interface PalmDisclosure {
  title: string;
  /** the paragraphs, in order */
  body: string[];
  /** what the button says */
  cta: string;
}

/**
 * The retention disclosure (docs/49 ASTRAL-44, §10.3), written against what
 * is TRUE today rather than against what the row asks for.
 *
 * F7, unfixed and verified again on 2026-08-28: `file_service.py:50` sets
 * `expiresAt=None` unconditionally, the only `blob.delete()` is commented out
 * at `:70`, and `api/v1/endpoints/files.py` has no DELETE route. So:
 *
 *   - the screen SAYS the photo is kept and cannot yet be removed;
 *   - the screen offers NO delete affordance, because one would report
 *     success and remove nothing — `lesson_silent_success_failures` inside a
 *     privacy surface, which is the worst place for it (ASTRAL-109);
 *   - the screen offers NO "analyse without long-term storage" option, which
 *     ASTRAL-44 asks for and which does not exist: there is no code path
 *     that analyses an image without filing it, so the option would be a
 *     checkbox that changes nothing.
 *
 * ASTRAL-44 also asks for the acknowledgement to be a STORED RECORD ("who,
 * what, when, which option") rather than a checkbox that leaves no trace.
 * There is no endpoint that stores one. So this text makes no claim to have
 * recorded anything — it discloses, and the user continues. Writing "your
 * consent has been recorded" would be the lie the row exists to prevent.
 *
 * The partner paragraph is not optional politeness: §10.3 singles out the
 * case where one partner uploads for another, and the engine already refuses
 * to narrate another person's palm as yours (`palm_other`).
 */
export function palmDisclosure(): PalmDisclosure {
  return {
    title: 'Before you upload',
    body: [
      'Your photo is sent to our servers and read by a vision model. The '
      + 'reading it produces is an interpretation of what is visible in the '
      + 'image — it is not medical, financial or legal advice.',
      'The photo is kept. This app cannot delete it for you yet, and we will '
      + 'not pretend otherwise: there is no removal path today, so treat the '
      + 'upload as permanent.',
      'If the hand is not yours, ask that person first. A palm reading is '
      + 'about them, and it will be labelled as theirs everywhere it appears.',
    ],
    cta: 'Continue',
  };
}

/**
 * The sentence for an ask this screen is not for.
 *
 * A palm turn can come back asking for something else entirely — the engine
 * decides what it needs, not this screen. Rather than rendering an unrelated
 * form under a "Palm reading" heading, the screen says what happened and
 * hands the conversation over. Never a spinner, and never a form whose
 * heading lies about what it is collecting.
 */
export function offTopicAskLine(ask: string | null | undefined): string {
  return ask === 'handedness_for_palm'
    ? 'One quick question first — which hand do you write with?'
    : 'The reading needs something else first. Continue in chat and I’ll ask '
      + 'you there.';
}

/**
 * Is this reply usable as a palm result?
 *
 * Three outcomes and they are genuinely different, which is why this returns
 * a kind rather than a boolean:
 *
 *   `reading`  a `palm_analysis` block arrived — draw it.
 *   `said`     the engine answered in words and computed nothing. This is
 *              the ASTRAL-47 case: a photo of a wall is REFUSED and not
 *              filed, and the refusal is the engine's own sentence. The
 *              screen must not route around it, must not retry it silently,
 *              and must not turn it into "something went wrong".
 *   `empty`    neither, which is the state that used to spin forever.
 */
export type PalmReplyKind = 'reading' | 'said' | 'empty';

export function palmReplyKind(hasBlock: boolean, prose: string): PalmReplyKind {
  if (hasBlock) return 'reading';
  if (prose.trim()) return 'said';
  return 'empty';
}

/** What to show when the reply carried neither a block nor a word. */
export const PALM_EMPTY_LINE =
  'The reading did not come back. Nothing was stored for it — try again, or '
  + 'continue in chat.';

/**
 * The turn that opens the palm arc.
 *
 * A SENTENCE, like every other opening turn this app sends. It names an
 * intent and no value: the engine decides it needs photographs, which hands
 * it needs, and whether it needs to know which hand you write with. If this
 * string were "upload dominant_palm_file_id" the client would be driving the
 * engine's ask, which is ASTRAL-83's discipline inverted.
 */
export const PALM_OPENING_TURN = 'I’d like a palm reading.';

/**
 * How many photo slots the user has filled, and whether that is enough.
 *
 * The engine marks BOTH palm fields `required: false` on purpose — one usable
 * photo is a legitimate reading, not a failed two-hand one — so the gate here
 * is "at least one", and the encouragement to add the second is copy rather
 * than a block. Getting this wrong in the strict direction is the
 * "upload your left hand" loop ASTRAL-46's gate criterion forbids.
 */
export function captureReady(filled: number): boolean {
  return filled > 0;
}

export function captureHint(filled: number): string | null {
  if (filled === 0) return null;
  if (filled === 1) {
    return 'One hand is a real reading. Adding the other reads what you were '
      + 'given against what you have made of it.';
  }
  return 'Both hands ready.';
}
