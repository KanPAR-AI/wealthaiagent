// The birth-details privacy lock — every decision, pure.
//
// Owner, 2026-09-19: "on the app hide my birth details only visible with a
// screen lock or face lock — exact date and time of birth should not be
// visible."
//
// PURE: no React, no react-native, no expo — so the root jest project can run
// it, which is where every rule below is actually enforced. The screens render
// what these functions return and decide nothing. The NATIVE half (does this
// binary contain the authenticator, is a screen lock enrolled, prompt for it)
// lives in `lib/birth-privacy.ts`; it computes no rule of its own.
//
// ── the four rules ─────────────────────────────────────────────────────────
//
//  1. DEFAULT = HIDDEN. Every function here takes `revealed` and every one of
//     them hides when it is false. There is no "hide" call to forget: the
//     masked value is what a caller gets by asking, and the WRAPPERS below
//     (`maskedFactRows`, `maskedChartBirthLines`, …) are the only shape the
//     screens import — `__tests__/birth-privacy-structure.test.ts` pins that
//     the screens do not reach around them to the unmasked builders.
//
//  2. A MASK LEAKS NOTHING. Not the year, not the month, not the weekday, not
//     the length of the place name. `••••••` is the same six dots for a birth
//     on 1 January and for one on 31 December. What SURVIVES the mask is the
//     provenance line ("from your chat, 28 Aug 2026") and whether the birth
//     time is KNOWN — the first is about the record and not about the value,
//     and the second is a fact this product must state (ASTRAL-137: a screen
//     that stops saying the birth time is unknown is a screen whose missing
//     lagna has no explanation on it). Neither is the value.
//
//  3. NO FALLBACK AT THE BOUNDARY. A phone with no screen lock does NOT get
//     the values — it gets a sentence saying to set one. A binary without the
//     authenticator does not get a "Show" button that does nothing; the
//     control is ABSENT and one sentence says why (the capability rule:
//     absent REMOVES, never greys).
//
//  4. THE UNLOCK IS IN MEMORY AND IT EXPIRES. `UnlockState` is a timestamp
//     and nothing else — there is no storage key here and there must not be
//     one, because a persisted unlock is a lock that only asks once ever.
//     Three things re-lock it: leaving the screen, the app going to the
//     background (so the iOS app-switcher snapshot is taken masked), and 60
//     seconds.

import {
  MASKED_VALUE,
  formatIsoDate,
  readInputResponse,
  type InputResponseRead,
} from '@wealthai/astral';

import type { FactRow } from './profile-view';
import { factRows } from './profile-view';
import type { BirthLine as ChartBirthLine } from './chart-view';
import { birthLines, dashaRows as chartDashaRows } from './chart-view';
import {
  antardashaBands as timelineAntardashaBands,
  dashaAxis as timelineDashaAxis,
  rows as timelineRows,
} from './timeline-view';
import { dashaLines } from './daily-view';
import type { PersonView } from './people-shapes';

/** What a hidden value reads as: six dots for every value, always.
 *  Re-exported from `@wealthai/astral` rather than declared again, so the
 *  mask the natal card draws and the mask this app draws are ONE string
 *  (`packages/astral/src/format.ts`). */
export { MASKED_VALUE };

/**
 * The fact keys this lock covers, in the People store's vocabulary.
 *
 * The PLACE is in here with the date and the time. A birth date, a birth time
 * and a birth place together are an identity — the trio is what a stranger
 * needs — so the default hides all three. It is a SEPARATE entry rather than
 * a third case of "the date and time" so the owner can relax the place later
 * by deleting one line, without touching the rule that covers the two the
 * owner actually named.
 */
export const LOCKED_FACT_KEYS = ['date_of_birth', 'time_of_birth', 'place_of_birth'] as const;

/**
 * The same three facts as `input_response` CARRIER keys (the engine's
 * `INPUT_FIELDS`, `graph.py:116`).
 *
 * This is how a transcript bubble is identified — STRUCTURALLY, by the keys
 * in the typed fence the user's own widget answer carries, never by a regex
 * over the sentence beside it. A regex over prose would mask an assistant
 * paragraph that happened to contain a date, and would miss the one bubble
 * that matters the first time the engine changed a label.
 *
 * `person1_*` is here because its engine labels are literally "Your date of
 * birth" / "Your birth time" / "Your birth place" — the synastry flow's name
 * for the same three self facts. `person2_*` is NOT here: another person's
 * details are out of scope for this change (see the report's list).
 */
export const LOCKED_CARRIER_KEYS = [
  'dob', 'tob', 'pob',
  'person1_dob', 'person1_tob', 'person1_pob',
] as const;

export function isLockedCarrierKey(key: string): boolean {
  return (LOCKED_CARRIER_KEYS as readonly string[]).includes(key);
}

// ── the gate: may this build offer to reveal at all? ───────────────────────

/**
 * `SecurityLevel.NONE` from `expo-local-authentication` — no screen lock of
 * any kind is enrolled on this phone. Transcribed rather than imported: this
 * module may not import the package (see rule 3 in `lib/birth-privacy.ts`),
 * and 0 is the value the native module returns.
 */
export const SECURITY_LEVEL_NONE = 0;

export type RevealGate =
  /** show the "Show" control */
  | { kind: 'available' }
  /** the probe has not answered yet — no control, no sentence, no flicker */
  | { kind: 'probing' }
  /** no control, and this sentence instead ('' when the product withdrew it) */
  | { kind: 'absent'; reason: 'capability_off' | 'no_native_module' | 'no_screen_lock'; sentence: string };

/**
 * ONE OTA BUNDLE, TWO BINARIES.
 *
 * `expo-local-authentication` is not in TestFlight build 13, and every OTA
 * reaches build 13 as well as build 14. So this build says plainly that the
 * REVEAL needs the next version — and hides the details on both, because the
 * hiding needs no native module at all. A "Show" button that threw would be
 * the dead affordance the capability rule forbids; a button that silently
 * revealed would be the fallback rule 3 forbids.
 */
export const NEEDS_NEW_BUILD =
  'Your birth details are hidden. Revealing them needs Face ID or your ' +
  'phone’s passcode, which arrives in the next version of Astral AI.';

/**
 * No screen lock enrolled. The values STAY HIDDEN — this is the sentence,
 * not a fallback to showing them. (`getEnrolledLevelAsync()` returns SECRET
 * for a passcode and a biometric level for Face/Touch ID, so anything above
 * NONE is something this phone can actually prompt for.)
 */
export const NO_SCREEN_LOCK =
  'Set a screen lock on this phone to view your birth details. Until then ' +
  'they stay hidden — there is nothing for Astral AI to check you against.';

export function revealGate(input: {
  /** the product has the feature (`CAPABILITIES.birthDetailsReveal`) */
  capability: boolean;
  /** THIS binary contains the native authenticator */
  moduleAvailable: boolean;
  /** `getEnrolledLevelAsync()`, or null when it has not answered yet */
  enrolledLevel: number | null;
}): RevealGate {
  if (!input.capability) {
    return { kind: 'absent', reason: 'capability_off', sentence: '' };
  }
  if (!input.moduleAvailable) {
    return { kind: 'absent', reason: 'no_native_module', sentence: NEEDS_NEW_BUILD };
  }
  if (input.enrolledLevel === null) return { kind: 'probing' };
  if (input.enrolledLevel <= SECURITY_LEVEL_NONE) {
    return { kind: 'absent', reason: 'no_screen_lock', sentence: NO_SCREEN_LOCK };
  }
  return { kind: 'available' };
}

/** The prompt iOS shows over the Face ID sheet. */
export const REVEAL_PROMPT = 'Show your birth details';

/** The control's label, and the one that takes it back. */
export const REVEAL_LABEL = 'Show';
export const HIDE_LABEL = 'Hide';

/** Said once under the card, so "hidden" reads as a decision and not a bug. */
export const HIDDEN_EXPLANATION =
  'Your exact birth date, time and place are hidden on this phone. Unlock ' +
  'them with Face ID or your passcode when you want to read them.';

/** Said while they are visible, so the 60 seconds are not a surprise. */
export const REVEALED_NOTE = 'Hidden again in a minute, or when you leave this screen.';

/** The failure, in the engine's grammar: named, never swallowed. */
export function revealFailure(error?: string | null): string {
  const said = String(error ?? '').trim();
  if (said === 'user_cancel' || said === 'app_cancel' || said === 'system_cancel') {
    return 'Left hidden.';
  }
  if (said === 'lockout') {
    return 'Too many failed attempts — unlock your phone with its passcode first, then try again.';
  }
  if (said === 'not_enrolled' || said === 'passcode_not_set') return NO_SCREEN_LOCK;
  return said
    ? `Your birth details stayed hidden: ${said}.`
    : 'Your birth details stayed hidden — that check did not pass.';
}

// ── the unlock, as a state machine with the clock injected ─────────────────

/** How long a reveal lasts with the screen untouched. */
export const REVEAL_WINDOW_MS = 60_000;

/** IN MEMORY ONLY. There is no storage key for this and there must not be. */
export interface UnlockState {
  /** epoch ms of the device-authentication that opened it, or null */
  unlockedAt: number | null;
}

export const LOCKED: UnlockState = { unlockedAt: null };

export type PrivacyEvent =
  /** device authentication succeeded */
  | { type: 'unlocked'; at: number }
  /** the user tapped "Hide" */
  | { type: 'hide' }
  /** the app went to the background — re-lock BEFORE the snapshot is taken */
  | { type: 'app_backgrounded' }
  /** the screen lost focus */
  | { type: 'left_screen' }
  /** the timer fired, or a render asked what time it is */
  | { type: 'tick'; now: number };

/**
 * The whole lifecycle, in one place, with no clock of its own.
 *
 * Every event but `unlocked` and `tick` re-locks unconditionally — there is
 * no "was it recent enough" clause on leaving the screen or backgrounding,
 * because the point of both is that the next thing to be drawn (another
 * screen, the app-switcher card) must not contain the values.
 */
export function reduce(state: UnlockState, event: PrivacyEvent): UnlockState {
  switch (event.type) {
    case 'unlocked':
      return { unlockedAt: event.at };
    case 'hide':
    case 'app_backgrounded':
    case 'left_screen':
      return LOCKED;
    case 'tick':
      return isRevealed(state, event.now) ? state : LOCKED;
  }
}

/**
 * The guard every surface asks, and the belt to the timer's braces: an
 * expired unlock reads as locked even if no tick ever arrived (a screen that
 * was backgrounded with its timer suspended is exactly that case).
 */
export function isRevealed(state: UnlockState, now: number): boolean {
  if (state.unlockedAt === null) return false;
  const age = now - state.unlockedAt;
  return age >= 0 && age < REVEAL_WINDOW_MS;
}

/** Milliseconds until this unlock expires, for the screen's one timer. */
export function msUntilRelock(state: UnlockState, now: number): number {
  if (state.unlockedAt === null) return 0;
  return Math.max(0, state.unlockedAt + REVEAL_WINDOW_MS - now);
}

// ── surface 1: the Profile card's three rows ───────────────────────────────

/**
 * The rows Profile draws — masked unless this view is unlocked.
 *
 * It WRAPS `factRows` rather than sitting beside it so that a screen cannot
 * get the unmasked rows by calling the other one;
 * `__tests__/birth-privacy-structure.test.ts` pins that `app/profile.tsx`
 * imports this and not that.
 *
 * The label, the provenance and the chevron survive: a user must still be
 * able to see WHERE a fact came from and to correct it (see
 * `maskedInputRequest` — a correction does not require revealing the old
 * value first).
 */
export function maskedFactRows(person: PersonView, revealed: boolean): FactRow[] {
  const rows = factRows(person);
  if (revealed) return rows;
  return rows.map((row) =>
    (LOCKED_FACT_KEYS as readonly string[]).includes(row.key)
      ? { ...row, value: MASKED_VALUE }
      : row,
  );
}

// ── surface 2: the chart screen's birth block ──────────────────────────────

/**
 * ASTRAL-245's birth block, masked.
 *
 * The ZONE row survives ("Asia/Kolkata (UTC+05:30)"): it is not the birth
 * instant and it is not the birth place — it is the frame the instant was
 * pinned to, which a user comparing our chart against another astrologer's
 * needs, and which names a country at best. The three rows that ARE the
 * instant and the place go.
 */
const LOCKED_CHART_LINE_KEYS = ['date', 'time', 'place'];

export function maskedChartBirthLines(
  chart: Parameters<typeof birthLines>[0],
  revealed: boolean,
): ChartBirthLine[] {
  const lines = birthLines(chart);
  if (revealed) return lines;
  return lines.map((line) =>
    LOCKED_CHART_LINE_KEYS.includes(line.key)
      ? { ...line, value: MASKED_VALUE }
      : line,
  );
}

// ── surface 3: the transcript's own echo bubble ────────────────────────────

/**
 * The user's widget answer, as it reads back in their transcript.
 *
 * A widget answer travels as `echo + a fenced input_response block`
 * (`packages/astral/src/input-request.ts`). The fence is already suppressed
 * on render (AMB-17 (a)); what is left is the ASTRAL-89 echo — "Date of
 * birth: <their date> · Birth time: <their time> · Birth place: <their
 * town>" — the user's own exact details, sitting in the transcript forever.
 *
 * ── how a bubble is identified, and why not by its words ──────────────────
 *
 * By the KEYS in the fence. `values` is a typed map the client built and the
 * engine parsed; `dob` in it is a fact about the MESSAGE, while the date
 * spelled out in the echo is a fact about a sentence. A regex over the words
 * would mask an assistant paragraph that mentioned a date and would miss
 * this bubble the first time the engine renamed a label.
 *
 * ── what replaces the echo, and the cost that is stated rather than hidden ─
 *
 * The echo is REBUILT from the keys, not edited. The labels in the original
 * echo came from the engine's payload and can be Hindi; the values in it are
 * FORMATTED (a date goes out ISO on the wire and comes back as a sentence),
 * so locating them inside the echo would be exactly the prose-matching this
 * function refuses to do. So: every locked key present becomes `<our label>: ••••••`, the
 * qualifier that rides with the birth time is kept (it is not a time), and
 * any other key in the same carrier is DROPPED from the echo rather than
 * guessed at. Nothing on the server reads the echo — it is presentation —
 * so dropping a segment costs a line of transcript and never a fact.
 *
 * A bubble with no locked key (a partner's details, a saved-match choice, a
 * name) is returned EXACTLY as it was: other people are out of scope here.
 */
const ECHO_LABELS: Record<string, string> = {
  dob: 'Date of birth',
  tob: 'Birth time',
  pob: 'Birth place',
  person1_dob: 'Your date of birth',
  person1_tob: 'Your birth time',
  person1_pob: 'Your birth place',
};

/** Not a time and not a date — "how exact is that time" is a qualifier, and
 *  it is the one companion key the birth-details ask sends. */
const KEPT_QUALIFIERS: Record<string, { label: string; values: Record<string, string> }> = {
  birth_time_confidence: {
    label: 'How exact is that time?',
    values: { exact: 'Exact', approximate: 'Approximate' },
  },
};

/**
 * What the fence in a user bubble says — READ BY THE MODULE THAT OWNS IT.
 *
 * `readInputResponse` lives in `packages/astral/src/input-request.ts`, which
 * is the one module in the workspace that knows the `input_response` fence,
 * and `packages/astral/src/__tests__/structural.test.ts` fails if a second
 * one learns it. A copy of that parser here would be exactly the drift that
 * test exists to catch: the engine changes the envelope, the carrier keeps
 * up, and the privacy mask quietly stops recognising the bubble it is for.
 *
 * The three cases stay apart on the way through. `unreadable` — "this IS a
 * widget answer and I could not tell which fields it holds" — FAILS CLOSED
 * here, because an exit boundary rejects rather than falling back to the
 * plausible value, and the plausible value here is "show it".
 */
export type Carrier = InputResponseRead;

export function carrier(text: string): Carrier {
  return readInputResponse(String(text ?? ''));
}

export function carriesLockedBirthFacts(text: string): boolean {
  const c = carrier(text);
  if (c.kind === 'unreadable') return true;   // fail closed — see above
  if (c.kind === 'none') return false;
  return Object.keys(c.values).some(isLockedCarrierKey);
}

/** What an unreadable answer fence renders as: a stated absence, never the
 *  sentence beside it and never a blank bubble. */
export const HIDDEN_ANSWER = 'Answer hidden';

/**
 * The bubble's text as it should be DRAWN. `strip` is the host's existing
 * fence suppressor (`stripInputResponse`), passed in rather than imported so
 * this module stays free of every dependency but its own siblings.
 */
export function maskedUserBubbleText(
  text: string,
  revealed: boolean,
  strip: (t: string) => string,
): string {
  const shown = strip(String(text ?? ''));
  if (revealed) return shown;
  const c = carrier(String(text ?? ''));
  if (c.kind === 'none') return shown;
  if (c.kind === 'unreadable') return HIDDEN_ANSWER;
  const values = c.values;
  const locked = Object.keys(values).filter(isLockedCarrierKey);
  if (!locked.length) return shown;
  const parts: string[] = [];
  for (const key of LOCKED_CARRIER_KEYS) {
    if (locked.includes(key)) parts.push(`${ECHO_LABELS[key]}: ${MASKED_VALUE}`);
  }
  for (const [key, spec] of Object.entries(KEPT_QUALIFIERS)) {
    const v = values[key];
    if (typeof v === 'string' && spec.values[v]) parts.push(`${spec.label}: ${spec.values[v]}`);
  }
  return parts.join(' · ');
}

// ── surface 4: the correction form's pre-fill ──────────────────────────────

/**
 * A correction may be made WITHOUT revealing the value being corrected.
 *
 * The engine pre-fills a `field_correction` ask with the stored value so the
 * picker opens at it (ASTRAL-138: "a user correcting a birth time by two
 * minutes should not have to re-find the hour"). That pre-fill is the exact
 * value, drawn on a wheel. So when the view is locked the `value` is
 * REMOVED from the locked fields — the picker opens at its own default, the
 * user states the new value, and `reconcile` writes it exactly as before.
 * Nothing else about the ask changes: the label, the reason sentence, the
 * required flag and every other field are the engine's, untouched.
 *
 * Typed STRUCTURALLY and generically on purpose: it takes the parsed
 * `InputRequestPayload` and gives the same type back, so a screen cannot
 * lose a field by passing its request through here. The only shape it relies
 * on is `fields[].key` and `fields[].value`, which is the payload contract
 * the engine writes (`graph.py::_input_request_block`).
 */
export function maskedInputRequest<T extends { fields: Array<{ key: string; value?: unknown }> }>(
  request: T,
  revealed: boolean,
): T {
  if (revealed) return request;
  if (!request || !Array.isArray(request.fields)) return request;
  if (!request.fields.some((f) => isLockedCarrierKey(String(f.key)) && f.value !== undefined)) {
    return request;
  }
  return {
    ...request,
    fields: request.fields.map((f) => {
      if (!isLockedCarrierKey(String(f.key)) || f.value === undefined) return f;
      const { value: _dropped, ...rest } = f;
      return rest as typeof f;
    }),
  };
}

/** Said on the correction sheet when the old value is not being shown. */
export const CORRECTING_WHILE_HIDDEN =
  'The value on file is hidden, so this opens blank. What you enter replaces it.';

// ── surface 5: the outcome banner a correction leaves on Profile ───────────

/**
 * The engine's correction receipt, and what may be drawn of it while locked.
 *
 * F345. `graph.py::_correction_outcome_line` composes a DETERMINISTIC
 * sentence that states the new value: "Your birth time is now **15:20**.
 * That leaves your chart and 1 saved match to be recomputed…". Profile draws
 * it verbatim (ASTRAL-138: the promise and the receipt come from one source),
 * which means the one screen that hides the birth time was printing it three
 * lines below the mask.
 *
 * Until the engine emits that value in a field a client can mask, the client
 * does not draw it. While locked, a self birth-fact edit gets a
 * CLIENT-OWNED sentence keyed by the FIELD — and the field is known
 * structurally: `editRoute` put it in the route param, the correction screen
 * carried it, and `useEditOutcome` records it beside the sentence. Nothing
 * here parses the engine's prose for a value, and nothing here guesses which
 * fact moved.
 *
 * What is lost while locked is the engine's recompute clause ("that leaves
 * your chart and 1 saved match to be recomputed"). That is a real cost and
 * it is the reason the whole sentence returns the moment the user unlocks —
 * and the reason the engine-side fix is worth doing.
 */
const OUTCOME_NOUN: Record<string, string> = {
  date_of_birth: 'date of birth',
  time_of_birth: 'birth time',
  place_of_birth: 'birth place',
};

/** …and when the field did not travel: still true, just less specific. */
export const OUTCOME_NOUN_UNKNOWN = 'birth details';

export function outcomeBanner(input: {
  /** the engine's own sentence, verbatim (may be '') */
  engineSentence: string;
  /** the edit did not complete */
  failed: boolean;
  /** which fact the user was sent to correct, from the route param */
  field: string | null | undefined;
  revealed: boolean;
}): string {
  const engine = String(input.engineSentence ?? '').trim();
  if (!engine) return '';
  if (input.revealed) return engine;
  const key = String(input.field ?? '');
  // A field this lock does not cover (there is none today, and the store is
  // generic on purpose) keeps the engine's words: masking a sentence about
  // something else would hide information for no reason.
  if (key && !(LOCKED_FACT_KEYS as readonly string[]).includes(key)) return engine;
  // "was not updated" and "was updated" are different facts. A failed edit
  // must never read as a success just because the value is hidden.
  const noun = OUTCOME_NOUN[key];
  if (!noun) {
    // The field did not travel. Still true, just less specific — and plural,
    // which is why it is its own sentence rather than the same template with
    // a different noun in it.
    return input.failed
      ? `Your ${OUTCOME_NOUN_UNKNOWN} were not updated — nothing changed.`
      : `Your ${OUTCOME_NOUN_UNKNOWN} were updated.`;
  }
  return input.failed
    ? `Your ${noun} was not updated — nothing changed.`
    : `Your ${noun} was updated.`;
}

// ── surface 6: the dasha tables, which start ON THE BIRTH DATE ─────────────

/**
 * A Vimshottari table is ANCHORED AT BIRTH.
 *
 * `dasha_periods[0].start_date` IS `birth_data.date_of_birth`, and the
 * timeline's `span.start`, `dasha.periods[0].start_date` and
 * `sub_periods[0].start_date` are the same date again — verified on every
 * engine-captured fixture in this repo. So three surfaces printed the exact
 * birth date while the Birth block one tab away showed dots, and one of them
 * SPOKE it: the Timeline row's accessibility label.
 *
 * The rules live in the builders (`chart-view.ts` / `timeline-view.ts`),
 * where the ISO dates are, because masking an already-composed "<date> →
 * <date>" would mean splitting a sentence — the prose-matching this module
 * refuses to do everywhere else. These wrappers are what a SCREEN imports,
 * so a screen cannot get the unmasked table by calling the other one.
 */
export function maskedDashaRows(
  chart: Parameters<typeof chartDashaRows>[0],
  revealed: boolean,
): ReturnType<typeof chartDashaRows> {
  return chartDashaRows(chart, { mask: !revealed });
}

export function maskedTimelineRows(
  artifact: Parameters<typeof timelineRows>[0],
  year: number | null,
  revealed: boolean,
): ReturnType<typeof timelineRows> {
  return timelineRows(artifact, year, { mask: !revealed });
}

export function maskedDashaAxis(
  artifact: Parameters<typeof timelineDashaAxis>[0],
  revealed: boolean,
): ReturnType<typeof timelineDashaAxis> {
  return timelineDashaAxis(artifact, { mask: !revealed });
}

export function maskedAntardashaBands(
  artifact: Parameters<typeof timelineAntardashaBands>[0],
  mahadashaIndex: number,
  revealed: boolean,
): ReturnType<typeof timelineAntardashaBands> {
  return timelineAntardashaBands(artifact, mahadashaIndex, { mask: !revealed });
}

// ── surface 7: the birth PLACE, named in clear on Home and on a day ────────

/**
 * `place_of_birth` is a locked fact, and the daily card names it out loud:
 * "scored for <their birth city>, from your Moon" on Home, on `/day`, and
 * under the panchang — the city hidden three taps away on Profile.
 *
 * The decision is STRUCTURAL and the engine already made it: every place on
 * a daily card carries its own `basis`, and `birth_place` is the engine
 * saying "this is where they were born". A place the user SET — their
 * current city — has a different basis, is not a birth fact, and is left
 * exactly as it is: hiding it would be hiding something the user typed this
 * week for no reason.
 *
 * Returns the string to print, or null when there is no place to name.
 */
export const BIRTH_PLACE_BASIS = 'birth_place';
export const BIRTH_PLACE_LABEL = 'your birth place';

export function maskedPlaceName(
  place: { name?: string | null; basis?: string | null } | null | undefined,
  revealed: boolean,
): string | null {
  const name = String(place?.name ?? '').trim() || null;
  if (revealed) return name;
  if (name === null) return null;
  // FAILS CLOSED, like every other boundary here. A place that does not say
  // what it is MIGHT be the birth place — an older card, a shape this build
  // has not met — and "we could not tell" is not a reason to print a city.
  // Only a basis that positively names something else earns the name.
  const basis = String(place?.basis ?? '').trim();
  if (!basis) return BIRTH_PLACE_LABEL;
  return basis === BIRTH_PLACE_BASIS ? BIRTH_PLACE_LABEL : name;
}

// ── surface 8: the ASSISTANT's own correction receipt, in the transcript ───

/**
 * F345, the other half: the receipt is a PERMANENT BOT BUBBLE.
 *
 * `graph.py::_correction_outcome_line` composes "Your birth time is now
 * **15:20**. That leaves your chart and 1 saved match to be recomputed…" —
 * deterministic, no model — and that sentence is stored in the transcript
 * forever. Masking it on the Profile banner and not here would be cosmetic:
 * the same string is one tab away, scrollable, for as long as the chat
 * exists.
 *
 * ── identified STRUCTURALLY, and here is exactly how ──────────────────────
 *
 * The receipt is the assistant message that ANSWERS a `field_correction`
 * `input_response` carrying a locked SELF key. Every part of that test is a
 * typed field of the message before it — the fence's `ask`, the fence's
 * `values` keys — and none of it is a regex over the assistant's prose. A
 * prose match would hide any paragraph that mentioned a time, and would miss
 * this one the moment the engine reworded it.
 *
 * ── why it cannot claim success ───────────────────────────────────────────
 *
 * A REFUSAL (INV-4) arrives as words in the same reply, in the same shape.
 * Nothing structural separates "is now 15:20" from "that value was not
 * accepted", so this sentence says both are possible rather than asserting
 * the happy one — the Profile banner CAN say "was updated" because the edit
 * screen told it whether the turn failed, and a transcript row has no such
 * witness. Claiming a success that did not happen is worse than saying less.
 *
 * Returns `undefined` when the bubble is none of this, which is the signal
 * to render it exactly as before.
 */
const CARRIER_TO_FACT: Record<string, string> = {
  dob: 'date_of_birth', person1_dob: 'date_of_birth',
  tob: 'time_of_birth', person1_tob: 'time_of_birth',
  pob: 'place_of_birth', person1_pob: 'place_of_birth',
};

export const FIELD_CORRECTION_ASK = 'field_correction';

export function correctionReceiptWhileLocked(field: string | null): string {
  const noun = field ? OUTCOME_NOUN[field] : undefined;
  return noun
    ? `Your ${noun} was changed or left as it was — unlock to read the details.`
    : `Your ${OUTCOME_NOUN_UNKNOWN} were changed or left as they were — `
      + 'unlock to read the details.';
}

export function maskedAssistantText(input: {
  /** the assistant bubble's own text */
  message: string;
  /** the message immediately before it, whatever it is */
  previous: string | undefined;
  revealed: boolean;
}): string | undefined {
  if (input.revealed) return undefined;
  if (!String(input.message ?? '').trim()) return undefined;
  const before = carrier(String(input.previous ?? ''));
  if (before.kind !== 'values') return undefined;
  if (before.ask !== FIELD_CORRECTION_ASK) return undefined;
  const key = Object.keys(before.values).find(isLockedCarrierKey);
  if (!key) return undefined;
  return correctionReceiptWhileLocked(CARRIER_TO_FACT[key] ?? null);
}

// ── the re-lock triggers, as decisions rather than as wiring ───────────────

/**
 * "The app's state changed — does that close the lock?"
 *
 * Extracted from the two `AppState` subscriptions that used to answer it
 * inline (the root layout's and the hook's) because Role-3 measured the
 * consequence: `if (state !== 'active')` could be changed to `if (false)` or
 * — the exact bug the comment beside it warns about — to
 * `if (state === 'active')`, which re-locks on the way BACK and therefore
 * lets the iOS app-switcher photograph the unlocked screen, and the whole
 * suite stayed green. A rule no test can see is a comment.
 *
 * Every state but `active` closes it, including `inactive`: on iOS that is
 * the state the app is in while the switcher's snapshot is being taken.
 */
export function eventForAppState(state: string): PrivacyEvent | null {
  return state === 'active' ? null : { type: 'app_backgrounded' };
}

/** …and leaving the screen. A function, for the same reason. */
export function eventForScreenBlur(): PrivacyEvent {
  return { type: 'left_screen' };
}

// ── surface 9: Home's "Your periods now" ──────────────────────────────────

/**
 * The running mahadasha and antardasha, WITHOUT their start dates.
 *
 * The residual Role-3 costed: a native still inside their FIRST mahadasha has
 * `dasha.mahadasha.start_date === their birth date`, and the daily card
 * carries neither an index nor a birth date, so no structural test can tell
 * that case from any other. P is 0 at age 20+ and about a quarter at age 10
 * — minors set as `self` — which is small but not empty, and the failure is
 * the exact one this feature exists to stop.
 *
 * So the start goes UNCONDITIONALLY while locked, and the unconditionality
 * IS the fix: any condition this module could write would be the client
 * guessing which period it is looking at, which is the derivation doctrine 9
 * forbids. What is lost is the start of two periods; what survives is the
 * planet, the end date and the sentence's whole usefulness — "Rahu · until
 * 29 Jan 2041" is what a reader wants from this card anyway.
 *
 * It wraps `dashaLines` for the reason every wrapper here does: so Home
 * cannot reach past it to the unmasked builder.
 */
export const UNTIL_PREFIX = 'until ';

export function maskedDashaLines(
  card: Parameters<typeof dashaLines>[0],
  revealed: boolean,
): ReturnType<typeof dashaLines> {
  const lines = dashaLines(card);
  if (revealed) return lines;
  return lines.map((line) => {
    // `<Planet> · <start> → <end>` becomes `<Planet> · until <end>`. Built
    // from the CARD's own fields, not by splitting the composed sentence:
    // the value is re-made here rather than edited, so no separator or
    // notation this file does not own can leak through a regex.
    const period = line.id === 'mahadasha' ? card.dasha?.mahadasha : card.dasha?.antardasha;
    const end = period?.end_date ? formatIsoDate(period.end_date) ?? period.end_date : null;
    if (!period?.planet || !end) return line;
    return { ...line, value: `${period.planet} · ${UNTIL_PREFIX}${end}` };
  });
}
