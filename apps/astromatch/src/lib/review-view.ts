/**
 * Review & confirm — the trust boundary's rules, as a pure module
 * (docs/73 ASTRAL-327, F160, F161).
 *
 * The screen renders what this returns and decides nothing, which is
 * `apps/astro`'s second rule and the reason every one of these states can be
 * tested at the workspace root with no browser in the room.
 *
 * ── the place is resolved by the ENGINE, and the failures are designed ────
 *
 * There is no geocoding library in this bundle and no client-side
 * autocomplete: `POST /astrology/resolve-location` is the authority and it
 * REFUSES an implausible match, which a client-side geocoder would resolve
 * optimistically on the user's machine (ASTRAL-57/69/96's standing rule).
 * Suggestions come from `GET /people/self/places`, which is a pure offline
 * gazetteer — the `self` in the path is where the chosen city lands in the
 * app's flow, not a filter on the read (F160).
 *
 * Three failures, none of which is a spinner:
 *
 *   (i)   UNRESOLVABLE — "I couldn't find that place". Confirm is BLOCKED and
 *         no chart is cast.
 *   (ii)  CONTESTED — the place resolved to more than one clock
 *         (`timezone` null, or `timezone_candidates` non-empty:
 *         `location.py:296-304`). The candidate places are NAMED and the user
 *         narrows the text, because the synastry leg cannot bind a candidate
 *         answer — it names the places in prose and explicitly does not
 *         persist the ask (`graph.py:12736-12746`, F161). Confirm is BLOCKED.
 *   (iii) UNREACHABLE — say so and offer to retry. Never proceed.
 *
 * A silent pick of candidate #1 is forbidden by name. The same Ranchi birth
 * reads Capricorn rising under Asia/Kolkata and Aries rising under UTC —
 * three signs apart, silently (`models.py`'s own comment, measured).
 */

import type {
  Candidate,
  CaptureSource,
  FieldAct,
  FieldDecision,
  PersonFieldKey,
} from './confirmed';
import { PERSON_FIELD_KEYS } from './confirmed';
import { spell } from './parse-profile';

export type PlaceResolution =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved'; label: string; timezone: string }
  | { kind: 'unresolvable'; message: string }
  | { kind: 'contested'; message: string; candidates: string[] }
  | { kind: 'unreachable'; message: string };

export const UNRESOLVABLE_MESSAGE =
  "I couldn't find that place — can you give the district or nearest city?";

export const UNREACHABLE_MESSAGE =
  "I couldn't reach the place lookup just now. Try again — I won't cast " +
  'anything until it answers.';

/**
 * The engine's answer, read into a state.
 *
 * `status` and `body` are passed separately because the ONE thing that must
 * not happen here is echoing the backend's 404 body at the user: a 404 from
 * this route is rewritten by the app's global not-found handler into
 * `{"error":{"code":"NOT_FOUND","message":"Path not found: /api/v1/astrology/
 * resolve-location"}}` — measured on 2026-09-19 — which would tell somebody
 * who typed a village name that a URL is missing. So a 404 becomes the
 * DESIGNED sentence and the body is not shown.
 */
export function readResolveResponse(status: number, body: unknown): PlaceResolution {
  if (status === 404) return { kind: 'unresolvable', message: UNRESOLVABLE_MESSAGE };
  if (status >= 400) return { kind: 'unreachable', message: UNREACHABLE_MESSAGE };

  if (typeof body !== 'object' || body === null) {
    return { kind: 'unreachable', message: UNREACHABLE_MESSAGE };
  }
  const o = body as Record<string, unknown>;
  const label = typeof o.display_name === 'string' ? o.display_name : '';
  const timezone = typeof o.timezone === 'string' && o.timezone ? o.timezone : null;
  const candidates = Array.isArray(o.place_candidates)
    ? (o.place_candidates as Array<Record<string, unknown>>)
        .map((c) => (typeof c?.display_name === 'string' ? c.display_name : ''))
        .filter(Boolean)
    : [];
  const zones = Array.isArray(o.timezone_candidates)
    ? (o.timezone_candidates as unknown[]).filter((z) => typeof z === 'string')
    : [];

  if (!timezone || zones.length > 1) {
    return {
      kind: 'contested',
      message: contestedMessage(candidates),
      candidates,
    };
  }
  if (!label) return { kind: 'unreachable', message: UNREACHABLE_MESSAGE };
  return { kind: 'resolved', label, timezone };
}

function contestedMessage(candidates: string[]): string {
  if (candidates.length) {
    return (
      `That name is more than one place — I found ${candidates.join(' and ')}. ` +
      'Add the district, state or country so I know which clock to cast on.'
    );
  }
  return (
    "That place lands on more than one clock, and a birth chart moves with " +
    'the clock. Add the district, state or country and I will try again.'
  );
}

/**
 * May the panel send this place text to the resolver yet?
 *
 * INV-10 / ASTRAL-326, enforced at the one place a text path can leak: the
 * birth place is the ONLY parsed field this screen would otherwise put on the
 * wire, because resolving it needs the engine. Resolving as the user types
 * would send a MACHINE'S READING of somebody's page before the user had
 * looked at it — which is precisely the thing "parsed never leaves the
 * browser" forbids.
 *
 * So the resolver is not called until the user has ACTED on that field:
 * accepted what was read, or typed their own. One extra tap, and the rule
 * stays true instead of nearly true.
 */
export function shouldResolvePlace(act: FieldAct | null, text: string): boolean {
  if (act === null) return false;
  if (act === 'declined') return false;
  return text.trim().length >= 3;
}

/** A place state that is not `resolved` may not be confirmed past. */
export function placeIsSettled(resolution: PlaceResolution): boolean {
  return resolution.kind === 'resolved';
}

/**
 * The review screen's per-field row.
 *
 * `state` is the machine's three-state reading and `act` is what the USER
 * has done about it so far — two different facts that a two-state design
 * collapses into one. `type-fixtures/two-state-field.ts` proves the collapse
 * is not representable.
 */
export interface ReviewRow {
  key: PersonFieldKey;
  candidate: Candidate;
  /** null until the user has acted on this field */
  act: FieldAct | null;
  value: string;
}

export function rowsFor(
  fields: Readonly<Record<PersonFieldKey, Candidate>>,
  decisions: Partial<Record<PersonFieldKey, FieldDecision>>,
): ReviewRow[] {
  return PERSON_FIELD_KEYS.map((key) => {
    const decision = decisions[key];
    return {
      key,
      candidate: fields[key],
      act: decision?.act ?? null,
      value: decision?.value ?? prefillValue(fields[key]),
    };
  });
}

/**
 * What the control OPENS at (B3).
 *
 * Empty when the candidate is ambiguous — when two readings of the same text
 * are both real dates, or both real times. A pre-filled ambiguous value is a
 * DEFAULT the user is being asked to notice rather than choose, and the
 * failure it produces is silent: the wire carries the right ISO, the control
 * renders it in the browser's locale, and "03/04/1989" looks correct to
 * somebody who meant the other one. So neither is offered as a starting
 * point; the two chips below are.
 */
export function prefillValue(candidate: Candidate): string {
  if (isAmbiguous(candidate)) return '';
  return candidate.value ?? '';
}

export function isAmbiguous(candidate: Candidate): boolean {
  return (
    candidate.state === 'inferred' &&
    Array.isArray(candidate.alternatives) &&
    candidate.alternatives.length > 1
  );
}

export interface FieldChoice {
  /** what travels: ISO `YYYY-MM-DD`, or 24-hour `HH:MM` */
  value: string;
  /** what the user reads: unambiguous in every locale */
  label: string;
}

/**
 * The chips an ambiguous field offers, IN WORDS.
 *
 * "3 April 1989" and "4 March 1989" — never "03/04/1989", which is the string
 * that caused the ambiguity. A time's alternatives are already unambiguous in
 * 24-hour form, so they are shown as they travel.
 */
export function fieldChoices(key: PersonFieldKey, candidate: Candidate): FieldChoice[] {
  if (!isAmbiguous(candidate)) return [];
  return (candidate.alternatives ?? []).map((value) => ({
    value,
    label:
      key === 'dob'
        ? spell(value) || value
        : key === 'tob'
          ? spellClock(value) || value
          : value,
  }));
}

/**
 * "05:13" → "5:13 in the morning", "17:13" → "5:13 in the evening".
 *
 * Extractor v2 sends a zero-padded time with no am/pm cue as TWO readings,
 * and it is right to: a twelve-hour error moves the ascendant by half the
 * zodiac. But "05:13" and "17:13" side by side are two strings a reader has
 * to decode before they can choose, and the choice is the whole point of
 * showing them.
 *
 * This is FORMATTING and nothing else — the hour decides the words and the
 * ISO 24-hour value is what travels. No astrology is computed here: "the
 * morning" is a fact about a clock, not about a chart.
 */
export function spellClock(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return '';
  const hour = Number(m[1]);
  const minute = m[2];
  if (hour > 23 || Number(minute) > 59) return '';
  const part =
    hour < 12 ? 'in the morning' : hour < 17 ? 'in the afternoon' : hour < 21 ? 'in the evening' : 'at night';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minute} ${part}`;
}

/**
 * The value, in words, for the row to show BESIDE the control (B3).
 *
 * `<input type="date">` renders in the browser's locale and there is no way
 * to ask it not to. The words are the only reading that means the same thing
 * to every user, and they are derived from the ISO on every change rather
 * than from what the control displays.
 */
export function valueInWords(key: PersonFieldKey, value: string): string {
  if (key !== 'dob') return '';
  return spell(value);
}

/**
 * The basis to show, given what the user has done about it.
 *
 * Once they have ACTED on the field — picked a chip, typed, declined — the
 * doubt has been answered and repeating it reads as the panel not having
 * noticed. The `basis` is a prompt, not a permanent label.
 */
export function basisToShow(candidate: Candidate, act: FieldAct | null): string | null {
  if (act !== null) return null;
  return basisFor(candidate);
}

export interface ConfirmGate {
  ready: boolean;
  /** why not, in the user's words. Empty when ready. */
  reason: string;
}

/**
 * May the user press Confirm?
 *
 * Stated as ONE function so the button, the hint under it and the test all
 * read the same rule. A `false` always carries the sentence — a disabled
 * button with no reason is the affordance the capability rule forbids.
 */
export function confirmGate(
  rows: ReviewRow[],
  place: PlaceResolution,
): ConfirmGate {
  const untouched = rows.filter((r) => r.act === null).map((r) => r.key);
  if (untouched.length) {
    return {
      ready: false,
      reason: `Check ${untouched.map(label).join(', ')} before I cast anything.`,
    };
  }
  if (place.kind === 'unresolvable' || place.kind === 'contested') {
    return { ready: false, reason: place.message };
  }
  if (place.kind === 'unreachable') return { ready: false, reason: place.message };
  if (place.kind !== 'resolved') {
    return { ready: false, reason: 'I still need to look that place up.' };
  }
  return { ready: true, reason: '' };
}

function label(key: PersonFieldKey): string {
  return key === 'dob' ? 'the date of birth'
    : key === 'tob' ? 'the birth time'
      : key === 'pob' ? 'the birth place'
        : 'the name';
}

/** docs/73 §4 — a `basis` belongs to `inferred` and to nothing else. */
export function basisFor(candidate: Candidate): string | null {
  if (candidate.state !== 'inferred') return null;
  return candidate.basis ?? candidate.note ?? null;
}

/** What the row says about where its value came from. Three sentences for
 *  three states, and never a `—`.
 *
 *  A `missing` field that carries the ENGINE's own `note` says that instead:
 *  "not there — please add it" about a value the user can see on their own
 *  screenshot reads as the panel not having looked (§4's widening). */
export function stateSentence(candidate: Candidate,
                              source: CaptureSource = 'paste'): string {
  if (candidate.state === 'missing' && candidate.note) return candidate.note;
  switch (candidate.state) {
    case 'stated':
      // PH-41, the selection path: the user did not GIVE this text, they
      // highlighted it on somebody else's page. The distinction matters on
      // exactly the screen where they are being asked whether a machine read
      // it correctly. Everything else about the path is the paste path's.
      return source === 'selection'
        ? 'read from what you selected on the page'
        : 'read from what you gave me';
    case 'inferred':
      return 'I worked this one out — check it';
    case 'missing':
      return 'not there — please add it';
  }
}

// ── PH-40 · confidence, attention, and where a value was read (ASTRAL-333) ──

/**
 * The confidence BAND, in words (INV-5).
 *
 * A machine's confidence is an interpretive quantity and a headline
 * percentage over one is the false precision INV-5 removes: "0.52" and "52%"
 * both read as a measurement of whether the date is right, which is not what
 * the number is. So the row says `moderate`, and the number itself is
 * available on tap for whoever wants it — visible, never the headline.
 *
 * The thresholds are this client's own presentational bands over a number
 * the engine sent. They score nothing and change nothing: the same candidate
 * is confirmed the same way at 0.59 and at 0.61 — the only difference is
 * whether the row asks for attention.
 */
export type ConfidenceBand = 'high' | 'moderate' | 'low';

export const ATTENTION_BELOW = 0.6;
const HIGH_AT = 0.8;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_AT) return 'high';
  if (confidence >= ATTENTION_BELOW) return 'moderate';
  return 'low';
}

/**
 * The words beside a field, or null when there is nothing to say.
 *
 * A `missing` field has no confidence worth showing: the machine is not
 * "0% sure of the date", it did not find one, and `stateSentence` already
 * says so.
 */
export function confidenceLabel(candidate: Candidate): string | null {
  if (candidate.state === 'missing') return null;
  return `${confidenceBand(candidate.confidence)} confidence`;
}

/**
 * Does this row need the user to look at it properly?
 *
 * ASTRAL-333: "a low-confidence `stated` field is presented exactly as an
 * `inferred` one for the purpose of demanding attention". A machine that
 * says it READ something and is only half sure it read it right is the same
 * risk as one that reasoned its way to a value, and the screen should not
 * make the first look settled.
 */
export function needsAttention(candidate: Candidate): boolean {
  if (candidate.state === 'missing') return false;
  if (candidate.state === 'inferred') return true;
  return candidate.confidence < ATTENTION_BELOW;
}

/**
 * Where this value came from, in one sentence per capture channel.
 *
 * The text paths can name the LINE (`sourceLine`, B2) because the parse ran
 * over text this panel still holds. A vision candidate has no line — §4's
 * contract carries none and inventing one would be the panel claiming to
 * know something the extractor never said — so the snapshot path names the
 * snapshot instead. Never a blank, and never a fabricated quotation.
 */
export function sourceNote(source: CaptureSource, candidate: Candidate): string | null {
  if (candidate.state === 'missing') return null;
  if (candidate.sourceLine) return `read from: ${candidate.sourceLine}`;
  if (source === 'snapshot') return 'read from your snapshot';
  if (source === 'selection') return 'read from what you selected';
  return null;
}

/**
 * ONE provenance line for a value read off a SNAPSHOT (the COPY ruling).
 *
 * The snapshot path used to stack three sentences under every field — the
 * state ("read from what you gave me"), the confidence ("high confidence")
 * and the source ("read from your snapshot"). Three lines for one fact, and
 * the first of them was FALSE on this path: the user gave a screenshot, not
 * a value. A machine's reading of a picture is not something they told us.
 *
 * So on the image paths the three collapse into one sentence that says where
 * the value came from AND how sure the machine is, in that order, because
 * that is the order the question arrives in. The text paths keep their own
 * sentence — there the user really did give the text.
 *
 * `tone` is the ink: `warn` is the attention treatment a low-confidence
 * `stated` field gets, which is the same treatment an `inferred` one gets
 * (ASTRAL-333) and for the same reason.
 */
export interface Provenance {
  text: string;
  tone: 'plain' | 'warn' | 'pending';
  /** the machine's number, revealed on tap. Null when there is nothing to show. */
  confidence: number | null;
}

export function provenanceLine(
  source: CaptureSource,
  candidate: Candidate,
): Provenance | null {
  // THE IMAGE PATH ONLY, and PH-41 narrowed it (finding F380).
  //
  // This function was written for `snapshot` and `selection` together, before
  // the selection path existed. It turns out they are not the same kind of
  // path at all: a selection is TEXT, parsed locally by `parse-profile.ts`,
  // which knows the exact LINE each value came from — and this sentence
  // SUPPRESSES that line (`review.tsx` draws one or the other). So the
  // selection path would have traded "read from: Date of Birth: 14 May 1994"
  // — the evidence a page about a whole family makes a user want — for a
  // confidence band over a constant the parser wrote. The selection path is
  // the paste path's, and it says so through `stateSentence`.
  if (source !== 'snapshot') return null;
  const where = 'your snapshot';
  if (candidate.state === 'missing') {
    // `stateSentence` prefers the engine's own note when it sent one.
    return { text: stateSentence(candidate), tone: 'pending', confidence: null };
  }
  if (candidate.state === 'inferred') {
    return {
      text: `worked out from ${where} — check it`,
      tone: 'warn',
      confidence: candidate.confidence,
    };
  }
  // ONE rule for "this row demands attention", and it is `needsAttention` —
  // the same predicate the text paths' ink uses (ASTRAL-333). Reading the
  // band directly here would have been a second copy of the threshold, and
  // a mutation that disabled the first would have left this one agreeing
  // with it by accident.
  const band = confidenceBand(candidate.confidence);
  if (needsAttention(candidate)) {
    return {
      text: `read off ${where} — but I'm not sure I read it right`,
      tone: 'warn',
      confidence: candidate.confidence,
    };
  }
  return {
    text: `read off ${where} — ${band} confidence`,
    tone: 'plain',
    confidence: candidate.confidence,
  };
}
