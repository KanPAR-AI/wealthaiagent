/**
 * `POST /astrology/extract-profile`, read into panel states
 * (docs/73 §4, ASTRAL-333, F169) — pure.
 *
 * ── candidates, not facts ─────────────────────────────────────────────────
 *
 * The response is a machine's reading of an image. It becomes a
 * `ParsedProfile` — the UNBRANDED type — and goes to the same review screen
 * the paste path uses. Nothing here constructs a `ConfirmedProfile`, and the
 * type system is what says so: `confirmProfile` takes DECISIONS, not values,
 * so there is no expression in this module that could confirm on the user's
 * behalf (ASTRAL-326).
 *
 * ── every failure is a state with a next step ─────────────────────────────
 *
 * F169: the app reshapes every `HTTPException` to `{"error": {"message"}}`,
 * and the daily cap's reset date rides the `X-Resets-On` HEADER rather than
 * the body. Both are read through `errors.readApiFailure`, which is where
 * that measurement lives.
 *
 * The five failures and what each offers:
 *
 *   unreadable (422)  the model could not find the fields — paste or type,
 *                     which are never capped and never leave the browser
 *   capped (429)      the engine's own sentence and its reset date, plus the
 *                     always-free doors. The COUNT is the engine's; this
 *                     client keeps no counter of its own (ASTRAL-318)
 *   too-large (413,   re-crop. Also raised locally BEFORE the send, because
 *     or local)       a bound the client can check should not cost a round
 *                     trip and a paid call
 *   signed-out (401)  sign in again; a reading run unauthenticated comes
 *                     back as somebody else's empty account
 *   unreachable (0)   the network, said as the network, with a retry
 */

import type { Candidate, ParsedProfile, PersonFieldKey } from './confirmed';
import { PERSON_FIELD_KEYS } from './confirmed';
import { failureSentence, readApiFailure, type HeaderLike } from './errors';

/** A way out that this panel can actually offer. */
export type ExtractDoor = 'recrop' | 'paste' | 'manual' | 'sign-in' | 'retry';

export type ExtractOutcome =
  | { kind: 'candidates'; parsed: ParsedProfile; model: string; extractorVersion: number }
  | { kind: 'unreadable'; message: string; doors: ExtractDoor[] }
  | { kind: 'capped'; message: string; resetsOn: string | null; doors: ExtractDoor[] }
  | { kind: 'too-large'; message: string; doors: ExtractDoor[] }
  | { kind: 'signed-out'; message: string; doors: ExtractDoor[] }
  | { kind: 'unreachable'; message: string; doors: ExtractDoor[] };

export const UNREADABLE_FALLBACK =
  "I couldn't read birth details off that crop. Try selecting a tighter " +
  'region around the details, or paste the text instead.';

export const TOO_LARGE_MESSAGE =
  'That crop is too big to send. Draw a smaller region around the birth ' +
  'details and try again.';

export const SIGNED_OUT_MESSAGE =
  'Your sign-in has expired. Sign in again and the capture will run from the top.';

export const UNREACHABLE_MESSAGE =
  "I couldn't reach Astral to read that crop. Nothing was sent anywhere " +
  'else — try again in a moment.';

/** The always-free ways in, named wherever a capture cannot happen. */
const FREE_DOORS: ExtractDoor[] = ['paste', 'manual'];

/**
 * One candidate field, validated on arrival.
 *
 * PARSE, DON'T TRUST — the package's rule, applied to our own backend. A
 * field with a state this client does not know is `missing` with no value,
 * because the alternative is a review screen that renders an unknown state
 * as a blank and lets the user confirm past it.
 */
function readCandidate(raw: unknown): Candidate {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const state = o.state === 'stated' || o.state === 'inferred' ? o.state : 'missing';
  const value = typeof o.value === 'string' && o.value.trim() ? o.value.trim() : null;
  const confidence =
    typeof o.confidence === 'number' && Number.isFinite(o.confidence)
      ? Math.max(0, Math.min(1, o.confidence))
      : 0;
  const basis = typeof o.basis === 'string' && o.basis.trim() ? o.basis.trim() : undefined;

  /**
   * §4's TWO NEW OPTIONAL KEYS (the widening in flight on the engine side).
   *
   * `note` — the engine's own sentence about a downgrade: a value that was
   * on the page but could not be read as a date (now `missing`), or one that
   * looks cut off by the image edge (now `inferred`). It carries where
   * `basis` carries, so a `missing` row says what happened instead of "not
   * there — please add it" about something the user can see.
   *
   * `alternatives` — two or more readings that are both real: `03/04/1989`,
   * a 12-hour time with no am/pm. They land on the SAME field the local
   * parser uses, so the chips, the no-pre-fill rule and the confirm gate
   * behave identically on the snapshot path and the paste path. One entry is
   * not an ambiguity and is dropped.
   *
   * Both absent → today's behaviour, byte for byte.
   */
  const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined;
  const alternatives = Array.isArray(o.alternatives)
    ? (o.alternatives as unknown[])
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
    : [];

  /**
   * ORDER MATTERS HERE, AND IT IS WHY F366 EXISTS.
   *
   * This function used to open with `if (state === 'missing' || value ===
   * null) return missing`. Under extractor v2 an ambiguous date arrives
   * `inferred` with `value: null` and TWO readings in `alternatives` — so
   * that first line would have flattened it to plain `missing` and the row
   * would have read "not there — please add it" about a date the user can
   * see on their own screenshot. The ambiguity, and the chips that resolve
   * it, would have been thrown away on the way in.
   *
   * So the ambiguous case is decided FIRST, the note case second, and the
   * plain empty case last.
   */

  // (1) AMBIGUOUS — two or more readings that are both real. v2 sends these
  // on `dob` (ISO dates) and `tob` (HH:MM) only, as `inferred` with a null
  // value, because choosing one of them is the user's act and not ours.
  if (alternatives.length > 1) {
    return {
      state: 'inferred',
      value: null,
      confidence,
      ...(basis || note ? { basis: basis ?? note! } : {}),
      ...(note ? { note } : {}),
      alternatives,
    };
  }

  // (2) DOWNGRADED, with the engine's own sentence. `note` is written by
  // engine CODE, never by the model, and it is the difference between "not
  // there" and "there, and I could not read it" — two different things to
  // say to somebody looking at their own screenshot.
  if (state === 'missing' || value === null) {
    return { state: 'missing', value: null, confidence: 0, ...(note ? { note } : {}) };
  }

  // (3) `basis` is REQUIRED on `inferred` (§4). An inference whose grounds
  // were dropped in transit is not one the user can check, so it is demoted
  // the way the engine demotes it (F166) rather than shown as a bare guess.
  // A `note` counts as grounds — it is the engine saying why, in words.
  if (state === 'inferred' && !basis && !note) {
    return { state: 'missing', value: null, confidence: 0 };
  }
  return {
    state,
    value,
    confidence,
    ...(state === 'inferred' && (basis || note) ? { basis: basis ?? note! } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * The §4 body → the review screen's input.
 *
 * `source: 'snapshot'` rides on the parse and travels to the engine on the
 * carrier as `capture_source`, which is what makes an accepted field land
 * `parsed_from_page` rather than `stated_by_user` (ASTRAL-313, AMB-68(a)).
 */
export function candidatesToParsed(body: unknown): ParsedProfile {
  const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const bag =
    typeof o.candidates === 'object' && o.candidates !== null
      ? (o.candidates as Record<string, unknown>)
      : {};
  const fields = {} as Record<PersonFieldKey, Candidate>;
  for (const key of PERSON_FIELD_KEYS) fields[key] = readCandidate(bag[key]);
  return { kind: 'parsed', source: 'snapshot', fields };
}

/**
 * The whole reply, as a state.
 *
 * `status === 0` is the transport's own "nothing answered" — the worker
 * reports it that way rather than throwing, so the panel gets a sentence
 * instead of an exception.
 */
export function readExtractResponse(
  status: number,
  body: unknown,
  headers?: HeaderLike | null,
): ExtractOutcome {
  if (status === 200 || status === 201) {
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const parsed = candidatesToParsed(body);
    // F303 — A CROP WITH NOTHING ON IT IS A 200, NOT A 422.
    //
    // ASTRAL-316's rule is that a field which is not visible is `missing`,
    // never guessed, so an image with no birth details on it comes back
    // SUCCESSFULLY with four `missing` candidates. Handing that to the
    // review screen gives the user four empty fields, three sentences saying
    // "not there — please add it", and no explanation of what just happened
    // to their capture. It is the same outcome as an unreadable crop from
    // where they are standing, and it gets the same designed state and the
    // same doors.
    // F366: a field carrying `alternatives` or a `note` is the engine
    // telling the user something about their page. "There were no birth
    // details on it" over the top of that is a flat contradiction — and it
    // would throw away the chips that resolve the ambiguity.
    const engineSaidSomething = PERSON_FIELD_KEYS.some(
      (key) => parsed.fields[key].note || (parsed.fields[key].alternatives?.length ?? 0) > 1,
    );
    if (
      !engineSaidSomething &&
      PERSON_FIELD_KEYS.every((key) => parsed.fields[key].state === 'missing')
    ) {
      return {
        kind: 'unreadable',
        message:
          "I read that crop and there were no birth details on it — no name, " +
          'no date, no time, no place. Try a region that includes the details, ' +
          'or paste the text instead.',
        doors: ['recrop', ...FREE_DOORS],
      };
    }
    return {
      kind: 'candidates',
      parsed,
      model: typeof o.model === 'string' ? o.model : '',
      extractorVersion:
        typeof o.extractor_version === 'number' ? o.extractor_version : 0,
    };
  }

  const failure = readApiFailure(status, body, headers);

  if (status === 401 || status === 403) {
    return { kind: 'signed-out', message: SIGNED_OUT_MESSAGE, doors: ['sign-in'] };
  }
  if (status === 413) {
    return { kind: 'too-large', message: TOO_LARGE_MESSAGE, doors: ['recrop'] };
  }
  if (status === 429) {
    return {
      kind: 'capped',
      // The ENGINE's sentence, with the reset date it sent on the header.
      // This client counts nothing and words nothing: `astral_usage`
      // decides what the allowance is and how it is said (ASTRAL-318).
      message: failureSentence(
        failure,
        'You have used today\'s captures.',
      ),
      resetsOn: failure.resetsOn,
      doors: FREE_DOORS,
    };
  }
  if (status === 422) {
    return {
      kind: 'unreadable',
      message: failure.message || UNREADABLE_FALLBACK,
      doors: ['recrop', ...FREE_DOORS],
    };
  }
  if (status === 0) {
    return { kind: 'unreachable', message: UNREACHABLE_MESSAGE, doors: ['retry', ...FREE_DOORS] };
  }
  return {
    kind: 'unreachable',
    message: failureSentence(failure, UNREACHABLE_MESSAGE),
    doors: ['retry', ...FREE_DOORS],
  };
}

/** Everything but a success. The panel's failure screen takes exactly this,
 *  so a `candidates` outcome cannot reach it. */
export type ExtractFailure = Exclude<ExtractOutcome, { kind: 'candidates' }>;

/** The door labels, in one place, so two screens cannot word them differently. */
export const DOOR_LABELS: Record<ExtractDoor, string> = {
  // F309: the door reopens the ORIGINAL capture, so the instruction is to
  // ADJUST the box — usually to widen it, since a read that failed on a
  // clipped value is fixed by taking in more, not less. "Choose a smaller
  // region" told the user to do the opposite of what would help, on the one
  // recovery path there is.
  recrop: 'Adjust the region',
  paste: 'Paste their biodata instead',
  manual: 'Type their details instead',
  'sign-in': 'Sign in again',
  retry: 'Try again',
};
