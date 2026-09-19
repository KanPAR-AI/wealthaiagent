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

import type { Candidate, FieldAct, FieldDecision, PersonFieldKey } from './confirmed';
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
    label: key === 'dob' ? spell(value) || value : value,
  }));
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
  return candidate.state === 'inferred' ? candidate.basis ?? null : null;
}

/** What the row says about where its value came from. Three sentences for
 *  three states, and never a `—`. */
export function stateSentence(candidate: Candidate): string {
  switch (candidate.state) {
    case 'stated':
      return 'read from what you gave me';
    case 'inferred':
      return 'I worked this one out — check it';
    case 'missing':
      return 'not there — please add it';
  }
}
