/**
 * The trust boundary, in the type system (docs/73 ASTRAL-326, INV-10).
 *
 * TWO OBJECTS, NEVER ONE. `Parsed` is what a machine read — the local text
 * parser today, the vision extractor at PH-40. `Confirmed` is what the user
 * approved, field by field, and it is the ONLY thing the service worker will
 * put on the wire. That mirrors INV-1 at the edge: the engine's `reconcile`
 * is the one fact-writer, and here the review screen is the one fact-source.
 *
 * ── why a brand and not a comment ──────────────────────────────────────────
 *
 * "Don't send the parsed object" is a rule a future edit breaks silently: the
 * two objects have the same field names, so a `send(parsed)` typo compiles
 * and the failure is a stranger's un-reviewed birth date leaving the browser.
 * So `ConfirmedProfile` carries a `unique symbol` property that this module
 * alone can produce. `type-fixtures/sends-parsed.ts` proves it: a `Parsed`
 * handed to the send signature is a COMPILE error, and `trust-boundary.test.ts`
 * runs the compiler to check that the error is real and is about the brand.
 *
 * ── and why a runtime tag as well ──────────────────────────────────────────
 *
 * The panel and the service worker are different contexts and the object
 * crosses between them through `chrome.runtime.sendMessage`, which structured-
 * clones it — and a symbol-keyed property does not survive a structured clone.
 * A compile-time brand alone would therefore protect the panel and leave the
 * worker taking whatever arrived. So the object also carries a string TAG,
 * and `parseConfirmedProfile` — the only re-brander in the codebase — checks
 * the tag AND re-validates every field before the worker will touch it.
 */

import type { InputValue } from '@wealthai/astral';

import { ENGINE_HAS_CAPTURE_FIELDS } from './config';
// `parse-profile` imports only TYPES from this module, so this is not a
// runtime cycle. `isoDate` is the real-calendar check — the 31st of February
// is not a date, and `new Date()` would roll it into March.
import { isoDate } from './parse-profile';

/** How the details reached the panel. A LABEL, never a fact, and never a
 *  site name (X-3): the value set is the capture channel and nothing else. */
export type CaptureSource = 'snapshot' | 'paste' | 'selection' | 'manual';

/**
 * The three states, and there are exactly three (docs/73 §4, ASTRAL-327).
 *
 * `stated` — the value is legible in what the machine read.
 * `inferred` — it was reached by reasoning, and `basis` says how.
 * `missing` — not there. NEVER guessed: "not found" and "found but guessed"
 * are different risks and the review screen shows them differently.
 */
export type FieldState = 'stated' | 'inferred' | 'missing';

export interface Candidate {
  state: FieldState;
  /** null exactly when the state is `missing` */
  value: string | null;
  /** 0..1. A machine's own confidence, shown, never used to auto-confirm. */
  confidence: number;
  /** REQUIRED on `inferred`, forbidden on `stated` and `missing` */
  basis?: string;
  /**
   * The LINE this value was read from (B2).
   *
   * Client-side only — §4's wire contract has no such field, and nothing
   * here ever travels. It exists because "where did this come from?" is the
   * question a page about a whole family makes a user ask, and the answer
   * should not be "go and read the page again".
   */
  sourceLine?: string;
  /**
   * The readings this value could ALSO have had (B3).
   *
   * Present only where a candidate is `inferred` because two readings are
   * both real — `03/04/1989`, `7:30` with no am/pm. The review screen offers
   * them as chips and pre-fills NEITHER, because a pre-filled ambiguous date
   * is a default the user is being asked to notice rather than choose.
   */
  alternatives?: string[];
}

export type PersonFieldKey = 'name' | 'dob' | 'tob' | 'pob';

export const PERSON_FIELD_KEYS: readonly PersonFieldKey[] = ['name', 'dob', 'tob', 'pob'];

/** What a machine read. Untrusted by construction: it has no brand. */
export interface ParsedProfile {
  readonly kind: 'parsed';
  readonly source: CaptureSource;
  readonly fields: Readonly<Record<PersonFieldKey, Candidate>>;
}

/**
 * What the user did to one field at the review screen.
 *
 * `accepted` and `typed` are deliberately different acts, because they earn
 * different provenance: AMB-68(a) stamps a value the user accepted unchanged
 * as `parsed_from_page` and a value they typed as `stated_by_user`, so a
 * later correction by the person themselves still outranks a page reading.
 * `declined` is the explicit "I don't know" the engine allows on a birth time
 * (`allow_unknown`), and on nothing else.
 */
export type FieldAct = 'accepted' | 'typed' | 'declined';

export interface FieldDecision {
  act: FieldAct;
  /** absent exactly when the act is `declined` */
  value?: string;
}

declare const CONFIRMED: unique symbol;

export interface ConfirmedProfile {
  /** the brand. Producible only by `confirmProfile` / `parseConfirmedProfile`. */
  readonly [CONFIRMED]: 'confirmed';
  readonly tag: typeof CONFIRMED_TAG;
  readonly source: CaptureSource;
  readonly name: string;
  /** ISO `YYYY-MM-DD` — the ambiguous form never travels */
  readonly dob: string;
  /** 24-hour `HH:MM`, or null for an explicit "I don't know" */
  readonly tob: string | null;
  readonly pob: string;
  readonly acts: Readonly<Record<PersonFieldKey, FieldAct>>;
}

/** Survives a structured clone, unlike the brand. */
export const CONFIRMED_TAG = 'astromatch.confirmed.v1' as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A real date on a real calendar (follow-up 1).
 *
 * `/^\d{4}-\d{2}-\d{2}$/` admits `1989-02-31`, and the engine would cast
 * whatever its own parser made of it. The shape check is not the check.
 */
function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return isoDate(y, m, d) === value;
}

export type ConfirmOutcome =
  | { ok: true; profile: ConfirmedProfile }
  | { ok: false; refusals: Array<{ field: PersonFieldKey; reason: string }> };

/**
 * Build the one object that may leave the browser.
 *
 * It takes a DECISION per field, not values: "the user confirmed this" is a
 * fact about an act, and a function that accepted bare values would let a
 * caller confirm on the user's behalf — which is the whole failure this
 * boundary exists to stop.
 *
 * It REFUSES rather than repairing (INV-4). A date that is not ISO, a time
 * that is not 24-hour, an empty place: each comes back named, and the review
 * screen keeps the user there. Nothing is coerced into plausibility.
 */
export function confirmProfile(
  source: CaptureSource,
  decisions: Partial<Record<PersonFieldKey, FieldDecision>>,
): ConfirmOutcome {
  const refusals: Array<{ field: PersonFieldKey; reason: string }> = [];
  const acts = {} as Record<PersonFieldKey, FieldAct>;

  for (const key of PERSON_FIELD_KEYS) {
    const decision = decisions[key];
    if (!decision) {
      refusals.push({ field: key, reason: 'has not been confirmed yet' });
      continue;
    }
    acts[key] = decision.act;
  }

  const value = (key: PersonFieldKey): string =>
    (decisions[key]?.value ?? '').trim();

  const name = value('name');
  if (acts.name && !name) refusals.push({ field: 'name', reason: 'is empty' });

  const dob = value('dob');
  if (acts.dob === 'declined') {
    refusals.push({ field: 'dob', reason: 'cannot be answered with "I don\'t know"' });
  } else if (acts.dob && !isRealDate(dob)) {
    refusals.push({
      field: 'dob',
      reason: ISO_DATE.test(dob)
        ? 'is not a day on the calendar'
        : 'is not a date I can read (YYYY-MM-DD)',
    });
  }

  const pob = value('pob');
  if (acts.pob === 'declined') {
    refusals.push({ field: 'pob', reason: 'cannot be answered with "I don\'t know"' });
  } else if (acts.pob && !pob) {
    refusals.push({ field: 'pob', reason: 'is empty' });
  }

  const tobDeclined = acts.tob === 'declined';
  const tob = value('tob');
  if (!tobDeclined && acts.tob && !CLOCK_24H.test(tob)) {
    refusals.push({ field: 'tob', reason: 'is not a 24-hour time (HH:MM)' });
  }

  if (refusals.length) return { ok: false, refusals };

  return {
    ok: true,
    profile: brand({
      tag: CONFIRMED_TAG,
      source,
      name,
      dob,
      tob: tobDeclined ? null : tob,
      pob,
      acts,
    }),
  };
}

/**
 * The service worker's door. `unknown` in, a confirmed profile or null out.
 *
 * This is the runtime half of the boundary and the ONLY place a plain object
 * becomes branded. It re-validates rather than trusting the tag: a tag is a
 * string anyone can write, and the point is not to detect malice inside our
 * own extension but to make "it arrived shaped like a parse" impossible to
 * mistake for "the user approved it".
 */
export function parseConfirmedProfile(raw: unknown): ConfirmedProfile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.tag !== CONFIRMED_TAG) return null;
  const source = o.source;
  if (source !== 'snapshot' && source !== 'paste' && source !== 'selection' && source !== 'manual') {
    return null;
  }
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const dob = typeof o.dob === 'string' ? o.dob.trim() : '';
  const pob = typeof o.pob === 'string' ? o.pob.trim() : '';
  const tob = o.tob === null ? null : typeof o.tob === 'string' ? o.tob.trim() : undefined;
  if (!name || !isRealDate(dob) || !pob) return null;
  if (tob === undefined) return null;
  if (tob !== null && !CLOCK_24H.test(tob)) return null;
  const rawActs = (typeof o.acts === 'object' && o.acts !== null ? o.acts : {}) as Record<string, unknown>;
  const acts = {} as Record<PersonFieldKey, FieldAct>;
  for (const key of PERSON_FIELD_KEYS) {
    const act = rawActs[key];
    if (act !== 'accepted' && act !== 'typed' && act !== 'declined') return null;
    acts[key] = act;
  }
  return brand({ tag: CONFIRMED_TAG, source, name, dob, tob, pob, acts });
}

/** The one cast in this module, kept to one line so it can be read. */
function brand(value: Omit<ConfirmedProfile, typeof CONFIRMED>): ConfirmedProfile {
  return value as ConfirmedProfile;
}

/**
 * Which belief keys the user typed or corrected themselves.
 *
 * `capture_edited`'s menu is the three PERSON2 BELIEF KEYS and nothing else
 * (`graph.INPUT_FIELDS`, PH-38) — keys, never values, so what travels is
 * "they typed the date", not the date a second time. The engine refuses an
 * off-menu value, so `name` is deliberately absent: it is not a birth fact
 * and the menu does not carry it.
 *
 * `declined` is NOT edited. "I don't know" is a real answer but it states no
 * value, so there is nothing for the ladder to stamp `stated_by_user`.
 */
const EDITABLE: ReadonlyArray<[PersonFieldKey, string]> = [
  ['dob', 'person2_dob'],
  ['tob', 'person2_tob'],
  ['pob', 'person2_pob'],
];

export function editedKeys(profile: ConfirmedProfile): string[] {
  return EDITABLE.filter(([field]) => profile.acts[field] === 'typed').map(([, key]) => key);
}

/**
 * The carrier's values (docs/73 §3a step 3).
 *
 * The KEYS are the engine's own field names — the client cannot invent a
 * field, and `graph._parse_input_response` refuses an undeclared one by name.
 *
 * Two of them ride along rather than answering the ask: `capture_source` and
 * `capture_edited` are STAMPS about how the details reached us, and the asks
 * that matter (`required_slots_missing`, `save_match_offer`) do not list them
 * in their own field sets (`_input_request_keys`). The engine's parser
 * accepts any DECLARED field on the fence, and `_persist_saved_match` reads
 * both off the belief's slots at save time — so they are sent with the
 * details, where they are true, rather than only at the save.
 */
export function carrierValues(
  profile: ConfirmedProfile,
  askedKeys: readonly string[],
  /**
   * Does the engine declare the two capture fields?
   *
   * A PARAMETER, defaulting to the build's constant, because the alternative
   * is a test that reads the constant and skips itself — three of them did,
   * and they would all have gone vacuously green the day the flag flipped
   * (docs/73 B7). Both branches are now exercised in the same run.
   */
  engineHasCaptureFields: boolean = ENGINE_HAS_CAPTURE_FIELDS,
): Record<string, InputValue> {
  const answers: Record<string, InputValue> = {
    person2_dob: profile.dob,
    person2_tob: profile.tob,
    person2_pob: profile.pob,
    person2_name: profile.name,
  };
  // Answer what was ASKED and nothing else. The engine decides which fields
  // are missing (`graph._prose_birth_ask_block`); a panel that sent its own
  // field set would meet a refusal for every key the ask did not carry.
  const out: Record<string, InputValue> = {};
  for (const key of askedKeys) {
    if (key in answers) out[key] = answers[key];
  }
  if (engineHasCaptureFields && Object.keys(out).length > 0) {
    out.capture_source = profile.source;
    out.capture_edited = editedKeys(profile);
  }
  return out;
}
