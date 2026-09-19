/**
 * `POST /astrology/extract-profile`, read into states (docs/73 §4, F169).
 *
 * `fixtures/extract-table-00.json` is CAPTURED — the live engine's answer to
 * one of its own synthetic screenshots, sent through the panel's real canvas
 * path by `e2e/measure-encoding.mjs` on 2026-09-19. A hand-written fixture
 * would prove the client parses what somebody imagined; the malformed bodies
 * further down ARE written here on purpose, because their subject is what
 * this client does with a shape the engine should never send.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { PERSON_FIELD_KEYS } from '../confirmed';
import {
  basisFor,
  fieldChoices,
  isAmbiguous,
  prefillValue,
  provenanceLine,
  spellClock,
  stateSentence,
} from '../review-view';
import { RESETS_ON_HEADER } from '../errors';
import {
  DOOR_LABELS,
  SIGNED_OUT_MESSAGE,
  candidatesToParsed,
  readExtractResponse,
  type ExtractDoor,
} from '../extract';

const CAPTURED = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'extract-table-00.json'), 'utf8'),
);

const headers = (bag: Record<string, string>) => ({ get: (n: string) => bag[n] ?? null });

describe('the captured response, as the review screen receives it', () => {
  it('is the ENGINE\'s own answer, not a shape we imagined', () => {
    expect(CAPTURED.model).toBe('gemini-flash-latest');
    // F367 — this fixture was captured from extractor v1. v2 is built in the
    // chatservice tree and not deployed, and re-capturing costs one of the
    // account's ten daily captures, which are spent. So the version is
    // pinned STRUCTURALLY (a positive integer this client understands) and
    // the fixture is MARKED FOR RE-CAPTURE at v2 the day the endpoint ships.
    expect([1, 2]).toContain(CAPTURED.extractor_version);
    // §4's own assertion, on the wire and asserted here too
    expect(CAPTURED.retained).toBe(false);
  });

  it('becomes a SNAPSHOT parse — the label the provenance ladder reads', () => {
    const parsed = candidatesToParsed(CAPTURED);
    expect(parsed.kind).toBe('parsed');
    expect(parsed.source).toBe('snapshot');
  });

  it('carries three states, and a missing field carries no value', () => {
    const { fields } = candidatesToParsed(CAPTURED);
    expect(fields.name).toEqual({ state: 'stated', value: 'Kavya Nair', confidence: 1 });
    expect(fields.dob.state).toBe('stated');
    expect(fields.dob.value).toBe('1988-01-01');
    // The birth time was not on the page. NOT guessed, NOT noon.
    expect(fields.tob).toEqual({ state: 'missing', value: null, confidence: 0 });
    expect(fields.pob.value).toBe('Coimbatore');
  });

  it('reads a 200 as candidates and NOTHING more', () => {
    const outcome = readExtractResponse(200, CAPTURED, null);
    expect(outcome.kind).toBe('candidates');
    if (outcome.kind !== 'candidates') throw new Error('unreachable');
    expect(outcome.model).toBe('gemini-flash-latest');
    expect([1, 2]).toContain(outcome.extractorVersion);
  });
});

describe('a candidate is validated on arrival (parse, don\'t trust)', () => {
  const body = (candidates: unknown) => ({ candidates });

  it('demotes an INFERRED field whose basis did not arrive', () => {
    // §4 requires `basis` on `inferred`. An inference whose grounds are
    // missing is not one the user can check, so it is demoted rather than
    // shown as a bare guess — the engine's own F166 move, in the same
    // direction (downward, never up).
    const { fields } = candidatesToParsed(
      body({ pob: { state: 'inferred', value: 'Patna', confidence: 0.5 } }),
    );
    expect(fields.pob).toEqual({ state: 'missing', value: null, confidence: 0 });
  });

  it('keeps an inferred field WITH a basis, and shows the basis', () => {
    const { fields } = candidatesToParsed(
      body({
        pob: {
          state: 'inferred',
          value: 'Patna',
          confidence: 0.52,
          basis: 'the page says "Patna, Bihar" under Location',
        },
      }),
    );
    expect(fields.pob.state).toBe('inferred');
    expect(fields.pob.basis).toContain('Location');
  });

  it('turns a state it does not know into MISSING, never into a blank row', () => {
    const { fields } = candidatesToParsed(body({ dob: { state: 'probably', value: '1994-05-14' } }));
    expect(fields.dob.state).toBe('missing');
    expect(fields.dob.value).toBeNull();
  });

  it('refuses a value on a missing field', () => {
    const { fields } = candidatesToParsed(body({ dob: { state: 'missing', value: '1994-05-14' } }));
    expect(fields.dob.value).toBeNull();
  });

  it('clamps a confidence rather than rendering an impossible one', () => {
    const { fields } = candidatesToParsed(body({ name: { state: 'stated', value: 'A', confidence: 4 } }));
    expect(fields.name.confidence).toBe(1);
  });

  it('is total — an empty body is four missing fields, not a crash', () => {
    const { fields } = candidatesToParsed(null);
    for (const key of PERSON_FIELD_KEYS) expect(fields[key].state).toBe('missing');
  });
});

describe('every failure is a state with a door (§4, F169)', () => {
  const doorsOf = (outcome: { doors?: ExtractDoor[] }) => outcome.doors ?? [];

  it('422 — unreadable, and the engine\'s own sentence', () => {
    const outcome = readExtractResponse(422, {
      error: { code: 'UNPROCESSABLE', message: 'name: that value is too long to be one' },
    });
    expect(outcome.kind).toBe('unreadable');
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    expect(outcome.message).toContain('too long');
    expect(doorsOf(outcome)).toEqual(['recrop', 'paste', 'manual']);
  });

  it('F303 — a 200 with NOTHING on the image is the same state, not an empty form', () => {
    // ASTRAL-316: a field that is not visible is `missing`, never guessed —
    // so a crop with no birth details on it SUCCEEDS with four missing
    // candidates. Handing that to the review screen would show four empty
    // rows and no explanation of what happened to the capture.
    const nothing = {
      candidates: Object.fromEntries(
        PERSON_FIELD_KEYS.map((k) => [k, { state: 'missing', value: null, confidence: 0 }]),
      ),
    };
    const outcome = readExtractResponse(200, nothing);
    expect(outcome.kind).toBe('unreadable');
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    expect(outcome.message).toContain('no birth details');
    expect(doorsOf(outcome)).toContain('recrop');
  });

  it('one field found is still candidates — the review screen handles the rest', () => {
    const one = {
      candidates: {
        name: { state: 'stated', value: 'Asha Verma', confidence: 0.9 },
        dob: { state: 'missing', value: null, confidence: 0 },
        tob: { state: 'missing', value: null, confidence: 0 },
        pob: { state: 'missing', value: null, confidence: 0 },
      },
    };
    expect(readExtractResponse(200, one).kind).toBe('candidates');
  });

  it('429 — the ENGINE\'s sentence and the reset date off the HEADER (F169)', () => {
    const outcome = readExtractResponse(
      429,
      { error: { message: "That's today's ten captures." } },
      headers({ [RESETS_ON_HEADER]: '2026-09-20' }),
    );
    expect(outcome.kind).toBe('capped');
    if (outcome.kind !== 'capped') throw new Error('unreachable');
    expect(outcome.message).toContain("That's today's ten captures.");
    // the date is on the header, not in the body — this is the half that
    // would silently go missing
    expect(outcome.resetsOn).toBe('2026-09-20');
    expect(outcome.message).toContain('2026-09-20');
    // and the free doors are named, because they are never capped
    expect(doorsOf(outcome)).toEqual(['paste', 'manual']);
    expect(doorsOf(outcome)).not.toContain('recrop');
  });

  it('429 without a header still says something true', () => {
    const outcome = readExtractResponse(429, { error: { message: 'Capped.' } }, null);
    expect(outcome.kind).toBe('capped');
    if (outcome.kind !== 'capped') throw new Error('unreachable');
    expect(outcome.resetsOn).toBeNull();
    expect(outcome.message).toBe('Capped.');
  });

  it('413 — re-crop, and only re-crop', () => {
    const outcome = readExtractResponse(413, null);
    expect(outcome.kind).toBe('too-large');
    expect(doorsOf(outcome as { doors: ExtractDoor[] })).toEqual(['recrop']);
  });

  it('401 — sign in again, not "retry"', () => {
    const outcome = readExtractResponse(401, { error: { message: 'Unauthorized' } });
    expect(outcome.kind).toBe('signed-out');
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    // the transport's own sentence is not shown to somebody whose session
    // simply expired
    expect(outcome.message).toBe(SIGNED_OUT_MESSAGE);
    expect(doorsOf(outcome)).toEqual(['sign-in']);
  });

  it('a dead network is its own state, with the free doors', () => {
    const outcome = readExtractResponse(0, null);
    expect(outcome.kind).toBe('unreachable');
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    expect(outcome.message).toContain('Nothing was sent anywhere else');
    expect(doorsOf(outcome)).toEqual(['retry', 'paste', 'manual']);
  });

  it('never renders an empty message, whatever came back', () => {
    for (const status of [400, 422, 429, 500, 503, 0]) {
      const outcome = readExtractResponse(status, null);
      if (outcome.kind === 'candidates') throw new Error('unreachable');
      expect(outcome.message.trim().length).toBeGreaterThan(10);
    }
  });

  it('every door it can emit has a label', () => {
    for (const status of [401, 413, 422, 429, 0, 500]) {
      const outcome = readExtractResponse(status, null);
      if (outcome.kind === 'candidates') continue;
      for (const door of outcome.doors) expect(DOOR_LABELS[door]).toBeTruthy();
    }
  });
});

// ── §4's widening: `alternatives` and `note` ──────────────────────────────

/**
 * ⚠ CONTRACT TESTS, NOT CAPTURED FIXTURES.
 *
 * The engine side of these two keys is being written right now
 * (`chatservice/services/agents/astrology/profile_capture.py`) and is not
 * live, so the bodies below are HAND-BUILT from the stated contract. Every
 * other case in this file drives the engine's own captured answer, and these
 * must be replaced by a captured fixture the day the endpoint sends them —
 * a hand-written fixture proves the client parses what somebody imagined.
 *
 * What they do prove today: both keys are OPTIONAL, and their absence is
 * byte-for-byte the behaviour that is already shipped.
 */
describe('CONTRACT (extractor v2, built but not deployed) — `alternatives`', () => {
  /**
   * ⚠ HAND-BUILT, and marked so. The engine side is in the chatservice tree
   * and is not deployed, and re-capturing costs one of ten daily captures.
   * Every other case in this file drives the engine's own captured answer;
   * these must be REPLACED by a captured fixture the day v2 ships.
   *
   * v2's stated shape: `alternatives` appears on `dob` (ISO dates) and `tob`
   * (`HH:MM`) only, 2-4 distinct readings, and the field then arrives
   * `inferred` with a NULL value and a model-written `basis`.
   */
  const ambiguous = (field: 'dob' | 'tob', alternatives: string[], basis = 'two readings') => ({
    candidates: {
      name: { state: 'stated', value: 'Asha Verma', confidence: 0.9 },
      dob: { state: 'stated', value: '1994-05-14', confidence: 0.9 },
      tob: { state: 'missing', value: null, confidence: 0 },
      pob: { state: 'stated', value: 'Nagpur', confidence: 0.9 },
      [field]: { state: 'inferred', value: null, confidence: 0.5, basis, alternatives },
    },
    extractor_version: 2,
  });

  it('F366 — a NULL value with alternatives is an AMBIGUITY, not a missing field', () => {
    // The bug this pins: `readCandidate` opened with "missing or null value →
    // missing", which flattened exactly this case and put "not there —
    // please add it" under a date the user can see on their screenshot.
    const { fields } = candidatesToParsed(ambiguous('dob', ['1989-04-03', '1989-03-04']));
    expect(fields.dob.state).toBe('inferred');
    expect(fields.dob.value).toBeNull();
    expect(fields.dob.alternatives).toEqual(['1989-04-03', '1989-03-04']);
    expect(stateSentence(fields.dob)).not.toContain('not there');
  });

  it('lights the date chips, in words, with nothing pre-filled', () => {
    const { fields } = candidatesToParsed(ambiguous('dob', ['1989-04-03', '1989-03-04']));
    expect(isAmbiguous(fields.dob)).toBe(true);
    expect(prefillValue(fields.dob)).toBe('');
    expect(fieldChoices('dob', fields.dob)).toEqual([
      { value: '1989-04-03', label: '3 April 1989' },
      { value: '1989-03-04', label: '4 March 1989' },
    ]);
  });

  it('lights the TIME chips too, and says which half of the day', () => {
    // v2 sends a zero-padded hour ≤ 12 with no am/pm cue as two readings,
    // and it is right to: a twelve-hour error moves the ascendant by half
    // the zodiac. "05:13" and "17:13" side by side are two strings the
    // reader has to decode before they can choose.
    const { fields } = candidatesToParsed(ambiguous('tob', ['05:13', '17:13']));
    expect(isAmbiguous(fields.tob)).toBe(true);
    expect(prefillValue(fields.tob)).toBe('');
    expect(fieldChoices('tob', fields.tob)).toEqual([
      { value: '05:13', label: '5:13 in the morning' },
      { value: '17:13', label: '5:13 in the evening' },
    ]);
  });

  it('spells a clock without computing anything about a chart', () => {
    expect(spellClock('00:05')).toBe('12:05 in the morning');
    expect(spellClock('12:00')).toBe('12:00 in the afternoon');
    expect(spellClock('21:30')).toBe('9:30 at night');
    expect(spellClock('nonsense')).toBe('');
    expect(spellClock('29:99')).toBe('');
  });

  it('carries up to four readings, and drops a list of one', () => {
    const four = candidatesToParsed(
      ambiguous('dob', ['1989-04-03', '1989-03-04', '1989-04-30', '1989-03-40']),
    );
    expect(four.fields.dob.alternatives).toHaveLength(4);
    const one = candidatesToParsed(ambiguous('dob', ['1989-04-03']));
    expect(one.fields.dob.alternatives).toBeUndefined();
    // a single reading with a null value IS a missing field
    expect(one.fields.dob.state).toBe('missing');
  });

  it('an empty list is none, exactly as absent is', () => {
    const { fields } = candidatesToParsed({
      candidates: { dob: { state: 'missing', value: null, confidence: 0, alternatives: [] } },
    });
    expect(fields.dob.alternatives).toBeUndefined();
    expect(fields.dob.state).toBe('missing');
  });
});

describe('CONTRACT (extractor v2, built but not deployed) — `note`', () => {
  const noted = (field: string, body: Record<string, unknown>) => ({
    candidates: {
      name: { state: 'stated', value: 'Asha Verma', confidence: 0.9 },
      dob: { state: 'stated', value: '1994-05-14', confidence: 0.9 },
      tob: { state: 'missing', value: null, confidence: 0 },
      pob: { state: 'stated', value: 'Nagpur', confidence: 0.9 },
      [field]: body,
    },
    extractor_version: 2,
  });

  const UNREADABLE_DATE =
    'I could see something in the date row but could not read it as a date — please type it.';

  it('a MISSING dob with a note says the ENGINE\'s sentence, not "not there"', () => {
    const { fields } = candidatesToParsed(
      noted('dob', { state: 'missing', value: null, confidence: 0, note: UNREADABLE_DATE }),
    );
    expect(fields.dob.state).toBe('missing');
    expect(stateSentence(fields.dob)).toBe(UNREADABLE_DATE);
    expect(stateSentence(fields.dob)).not.toContain('not there');
  });

  it('an INFERRED value CUT OFF at the image edge keeps its value and its note', () => {
    const cut = 'This value looks cut off at the edge of the image.';
    const { fields } = candidatesToParsed(
      noted('pob', { state: 'inferred', value: 'Nagpur, Mahar-', confidence: 0.5, note: cut }),
    );
    expect(fields.pob.state).toBe('inferred');
    expect(fields.pob.value).toBe('Nagpur, Mahar-');
    expect(basisFor(fields.pob)).toBe(cut);
  });

  it('the note reaches the ONE provenance line on the snapshot path', () => {
    const { fields } = candidatesToParsed(
      noted('dob', { state: 'missing', value: null, confidence: 0, note: UNREADABLE_DATE }),
    );
    expect(provenanceLine('snapshot', fields.dob)?.text).toBe(UNREADABLE_DATE);
  });

  it('F366 — "no birth details on it" does NOT fire when the engine said something', () => {
    // All four fields empty, but one carries the engine's sentence. Telling
    // the user their page had nothing on it, over the top of the engine
    // saying it could see a date it could not read, is a flat contradiction.
    const allEmptyButNoted = {
      candidates: {
        name: { state: 'missing', value: null, confidence: 0 },
        dob: { state: 'missing', value: null, confidence: 0, note: UNREADABLE_DATE },
        tob: { state: 'missing', value: null, confidence: 0 },
        pob: { state: 'missing', value: null, confidence: 0 },
      },
      extractor_version: 2,
    };
    expect(readExtractResponse(200, allEmptyButNoted).kind).toBe('candidates');
  });

  it('F366 — nor when a field carries an AMBIGUITY', () => {
    const allEmptyButAmbiguous = {
      candidates: {
        name: { state: 'missing', value: null, confidence: 0 },
        dob: {
          state: 'inferred',
          value: null,
          confidence: 0.5,
          basis: 'the page prints 03/04/1989',
          alternatives: ['1989-04-03', '1989-03-04'],
        },
        tob: { state: 'missing', value: null, confidence: 0 },
        pob: { state: 'missing', value: null, confidence: 0 },
      },
      extractor_version: 2,
    };
    const outcome = readExtractResponse(200, allEmptyButAmbiguous);
    expect(outcome.kind).toBe('candidates');
    if (outcome.kind !== 'candidates') throw new Error('unreachable');
    expect(isAmbiguous(outcome.parsed.fields.dob)).toBe(true);
  });

  it('a genuinely empty read is STILL the unreadable state', () => {
    const nothing = {
      candidates: Object.fromEntries(
        PERSON_FIELD_KEYS.map((k) => [k, { state: 'missing', value: null, confidence: 0 }]),
      ),
    };
    expect(readExtractResponse(200, nothing).kind).toBe('unreadable');
  });

  it('BOTH keys absent is byte-for-byte what v1 ships today', () => {
    const before = candidatesToParsed(CAPTURED);
    expect(before.fields.dob.alternatives).toBeUndefined();
    expect(before.fields.dob.note).toBeUndefined();
    expect(before.fields.tob).toEqual({ state: 'missing', value: null, confidence: 0 });
  });
});

describe('CONTRACT (extractor v2) — the more-than-one-person 422', () => {
  const MULTI =
    "there seems to be more than one person's details on that image — crop it " +
    'tighter around the one you mean, or type their details in.';

  it('renders the engine\'s sentence VERBATIM, not a paraphrase', () => {
    const outcome = readExtractResponse(422, { error: { code: 'UNPROCESSABLE', message: MULTI } });
    expect(outcome.kind).toBe('unreadable');
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    expect(outcome.message).toBe(MULTI);
  });

  it('offers the ADJUST door first, because that is what fixes it', () => {
    const outcome = readExtractResponse(422, { error: { message: MULTI } });
    if (outcome.kind === 'candidates') throw new Error('unreachable');
    expect(outcome.doors[0]).toBe('recrop');
    expect(DOOR_LABELS.recrop).toBe('Adjust the region');
  });
});
