/**
 * docs/73 ASTRAL-327 — review & confirm, and the three designed failures.
 *
 * The two `resolve-*.json` fixtures were captured from the running backend on
 * 2026-09-19 (`POST /api/v1/astrology/resolve-location` on a local
 * container): one place that resolves, and one that does not. The 404 body is
 * the interesting one and it is why `readResolveResponse` never echoes it —
 * see the finding on that function.
 *
 * The CONTESTED fixture is the exception and it is said plainly: the live
 * gazetteer resolved both "Springfield" and "Pune, India" to a single zone,
 * so there was nothing to capture. Its shape is taken from
 * `services/agents/astrology/models.py`'s `LocationResult` — `timezone:
 * Optional[str]` with `timezone_candidates` / `place_candidates` — which is
 * the declaration the engine serialises, not something imagined.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

import { parseProfileText } from '../parse-profile';
import type { FieldDecision, PersonFieldKey } from '../confirmed';
import {
  UNREACHABLE_MESSAGE,
  UNRESOLVABLE_MESSAGE,
  basisFor,
  basisToShow,
  confirmGate,
  fieldChoices,
  isAmbiguous,
  prefillValue,
  valueInWords,
  placeIsSettled,
  readResolveResponse,
  rowsFor,
  shouldResolvePlace,
  stateSentence,
} from '../review-view';

const FIXTURES = join(__dirname, 'fixtures');
const read = (f: string) => JSON.parse(readFileSync(join(FIXTURES, f), 'utf8'));
const APP = join(__dirname, '..', '..', '..');

const BIODATA = [
  'Name: Meera Iyer',
  'Date of Birth: 03/04/1989',
  'Time of Birth: Not known',
  'Location: Pune',
].join('\n');

describe('the three states reach the screen as three different rows', () => {
  const parsed = parseProfileText(BIODATA);
  const rows = rowsFor(parsed.fields, {});

  it('shows one row per field, none of them pre-confirmed', () => {
    expect(rows.map((r) => r.key)).toEqual(['name', 'dob', 'tob', 'pob']);
    expect(rows.every((r) => r.act === null)).toBe(true);
  });

  it('says something different for each state, and never a dash', () => {
    const sentences = rows.map((r) => stateSentence(r.candidate));
    expect(new Set(sentences).size).toBe(3);
    for (const s of sentences) expect(s).not.toBe('—');
  });

  it('carries a basis on the INFERRED rows and on no others', () => {
    for (const row of rows) {
      const basis = basisFor(row.candidate);
      if (row.candidate.state === 'inferred') expect(typeof basis).toBe('string');
      else expect(basis).toBeNull();
    }
  });

  it('a two-state field does not compile', () => {
    const errors = diagnosticsFor('two-state-field.ts');
    expect(errors.length).toBeGreaterThan(0);
    const text = errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n');
    expect(text).toContain('FieldState');
    expect(errors.map((d) => d.code)).toContain(2322);
  });

  it('a three-state field compiles clean', () => {
    expect(
      diagnosticsFor('three-state-field.ts').map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, ' '),
      ),
    ).toEqual([]);
  });
});

function diagnosticsFor(fixture: string): ts.Diagnostic[] {
  const program = ts.createProgram([join(APP, 'type-fixtures', fixture)], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
  });
  return [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];
}

describe('B3 — an ambiguous candidate offers choices and pre-fills nothing', () => {
  const ambiguous = parseProfileText('Date of Birth: 03/04/1989').fields.dob;
  const plain = parseProfileText('Date of Birth: 14 May 1994').fields.dob;
  const missing = parseProfileText('Name: A').fields.dob;

  it('knows which candidates are ambiguous', () => {
    expect(isAmbiguous(ambiguous)).toBe(true);
    expect(isAmbiguous(plain)).toBe(false);
    expect(isAmbiguous(missing)).toBe(false);
  });

  it('opens the control EMPTY on an ambiguous value, and at the value otherwise', () => {
    expect(prefillValue(ambiguous)).toBe('');
    expect(prefillValue(plain)).toBe('1994-05-14');
    expect(prefillValue(missing)).toBe('');
  });

  it('offers both readings, labelled in words', () => {
    expect(fieldChoices('dob', ambiguous)).toEqual([
      { value: '1989-04-03', label: '3 April 1989' },
      { value: '1989-03-04', label: '4 March 1989' },
    ]);
    expect(fieldChoices('dob', plain)).toEqual([]);
  });

  it('offers a time\'s two readings IN WORDS, and travels the 24-hour value', () => {
    // PIN UPDATED, deliberately (the COPY ruling + extractor v2). It used to
    // assert the label was the 24-hour string itself, on the grounds that a
    // 24-hour time is already unambiguous. It is unambiguous and it is not
    // legible: "07:30" and "19:30" side by side are two strings a reader has
    // to decode before they can choose, and the choosing is the whole point
    // of showing them. The VALUE that travels is unchanged — that is what
    // the first column of each row asserts — and no assertion was dropped.
    const tob = parseProfileText('Time of Birth: 7:30').fields.tob;
    expect(fieldChoices('tob', tob)).toEqual([
      { value: '07:30', label: '7:30 in the morning' },
      { value: '19:30', label: '7:30 in the evening' },
    ]);
  });

  it('states a date in words, and says nothing for the other fields', () => {
    expect(valueInWords('dob', '1989-04-03')).toBe('3 April 1989');
    expect(valueInWords('dob', '')).toBe('');
    expect(valueInWords('pob', 'Pune')).toBe('');
  });

  it('stops repeating the basis once the user has acted', () => {
    expect(basisToShow(ambiguous, null)).toContain('two real dates');
    for (const act of ['accepted', 'typed', 'declined'] as const) {
      expect(basisToShow(ambiguous, act)).toBeNull();
    }
  });
});

describe('the place resolves on the engine, and its failures are designed', () => {
  it('reads a resolved place, with the clock it will be cast on', () => {
    const state = readResolveResponse(200, read('resolve-pune.json'));
    expect(state).toEqual({
      kind: 'resolved',
      label: 'Pune, Maharashtra, India',
      timezone: 'Asia/Kolkata',
    });
    expect(placeIsSettled(state)).toBe(true);
  });

  it('turns a 404 into the designed sentence and NEVER shows the body', () => {
    const body = read('resolve-nowhere-404.json');
    // What the backend actually sends for an unresolvable place: its global
    // not-found handler rewrites the route's own 404, so the body talks
    // about a URL. Showing it would tell a user who typed a village name
    // that a path is missing.
    expect(JSON.stringify(body)).toContain('Path not found');
    const state = readResolveResponse(404, body);
    expect(state).toEqual({ kind: 'unresolvable', message: UNRESOLVABLE_MESSAGE });
    expect(state.kind === 'unresolvable' && state.message).not.toContain('Path not found');
  });

  it('names the candidate places when one name is more than one clock', () => {
    const state = readResolveResponse(200, {
      display_name: 'Springfield',
      latitude: 0,
      longitude: 0,
      timezone: null,
      timezone_source: 'unresolved',
      timezone_candidates: ['America/Chicago', 'America/New_York'],
      place_candidates: [
        { display_name: 'Springfield, Illinois, US' },
        { display_name: 'Springfield, Massachusetts, US' },
      ],
    });
    expect(state.kind).toBe('contested');
    if (state.kind !== 'contested') throw new Error('unreachable');
    expect(state.candidates).toEqual([
      'Springfield, Illinois, US',
      'Springfield, Massachusetts, US',
    ]);
    // The user narrows the TEXT. They are not offered a tz-database choice:
    // "America/Chicago vs America/New_York" is a question about a database,
    // not about somebody's life (F19).
    expect(state.message).not.toContain('America/');
    expect(state.message).toMatch(/district|state|country/);
  });

  it('treats an unreachable lookup as its own state, not as a refusal', () => {
    for (const status of [500, 502, 0]) {
      const state = readResolveResponse(status === 0 ? 599 : status, null);
      expect(state).toEqual({ kind: 'unreachable', message: UNREACHABLE_MESSAGE });
    }
  });

  it('never settles on anything but a resolved place', () => {
    const states = [
      readResolveResponse(404, {}),
      readResolveResponse(500, {}),
      readResolveResponse(200, { display_name: 'x', timezone: null, timezone_candidates: [] }),
      { kind: 'idle' as const },
      { kind: 'resolving' as const },
    ];
    for (const s of states) expect(placeIsSettled(s)).toBe(false);
  });
});

describe('a parsed place is not resolved until the user has looked at it', () => {
  // INV-10 / ASTRAL-326: the birth place is the only parsed field this
  // screen would otherwise put on the wire. Resolving it as the user reads
  // the review would send a machine's reading of somebody's page before
  // they had confirmed a thing.
  it('does not resolve a place the user has not acted on', () => {
    expect(shouldResolvePlace(null, 'Pune, India')).toBe(false);
  });

  it('resolves once the user accepted what was read', () => {
    expect(shouldResolvePlace('accepted', 'Pune, India')).toBe(true);
  });

  it('resolves once the user typed their own', () => {
    expect(shouldResolvePlace('typed', 'Jamshedpur')).toBe(true);
  });

  it('never resolves an empty or two-character place', () => {
    expect(shouldResolvePlace('typed', '')).toBe(false);
    expect(shouldResolvePlace('typed', 'Pu')).toBe(false);
  });

  it('never resolves a declined field', () => {
    expect(shouldResolvePlace('declined', 'Pune')).toBe(false);
  });
});

describe('the confirm gate', () => {
  const parsed = parseProfileText(BIODATA);
  const allTouched: Partial<Record<PersonFieldKey, FieldDecision>> = {
    name: { act: 'accepted', value: 'Meera Iyer' },
    dob: { act: 'typed', value: '1989-04-03' },
    tob: { act: 'declined' },
    pob: { act: 'typed', value: 'Pune, Maharashtra' },
  };
  const resolved = readResolveResponse(200, read('resolve-pune.json'));

  it('opens only when every field has been acted on AND the place resolved', () => {
    expect(confirmGate(rowsFor(parsed.fields, allTouched), resolved)).toEqual({
      ready: true,
      reason: '',
    });
  });

  it('blocks on an unresolved place and says the designed sentence', () => {
    const gate = confirmGate(
      rowsFor(parsed.fields, allTouched),
      readResolveResponse(404, read('resolve-nowhere-404.json')),
    );
    expect(gate.ready).toBe(false);
    expect(gate.reason).toBe(UNRESOLVABLE_MESSAGE);
  });

  it('blocks while the lookup is unreachable, and offers the retry', () => {
    const gate = confirmGate(rowsFor(parsed.fields, allTouched), readResolveResponse(500, {}));
    expect(gate.ready).toBe(false);
    expect(gate.reason).toMatch(/try again/i);
  });

  it('blocks on a contested place', () => {
    const gate = confirmGate(rowsFor(parsed.fields, allTouched), {
      kind: 'contested',
      message: 'more than one place',
      candidates: ['a', 'b'],
    });
    expect(gate.ready).toBe(false);
  });

  it('blocks while a field has not been looked at, and names it', () => {
    const gate = confirmGate(
      rowsFor(parsed.fields, { ...allTouched, tob: undefined }),
      resolved,
    );
    expect(gate.ready).toBe(false);
    expect(gate.reason).toContain('birth time');
  });

  it('never returns a blocked gate with no reason', () => {
    const states = [
      readResolveResponse(404, {}),
      readResolveResponse(500, {}),
      { kind: 'idle' as const },
      { kind: 'resolving' as const },
    ];
    for (const place of states) {
      const gate = confirmGate(rowsFor(parsed.fields, allTouched), place);
      expect(gate.ready).toBe(false);
      expect(gate.reason.length).toBeGreaterThan(10);
    }
  });
});

describe('the gazetteer suggestions, as the engine sends them', () => {
  // Captured from `GET /api/v1/people/self/places?q=pun` on 2026-09-19. The
  // `self` in that path is where the chosen city lands in the app's flow, not
  // a filter on the read (F160) — it is usable for ANY person's birth place.
  const captured = read('places-pun.json');

  it('is a pure offline list the panel only DISPLAYS', () => {
    expect(captured.query).toBe('pun');
    expect(Array.isArray(captured.places)).toBe(true);
    expect(captured.places[0].name).toBe('Pune');
    // biggest cities first, decided by the engine — the panel does not sort,
    // does not filter and does not score
    expect(captured.places[0].population).toBeGreaterThan(captured.places[1].population);
  });

  it('carries a country per row, which is what the chip shows', () => {
    const chips = captured.places
      .slice(0, 4)
      .map((p: { name: string; country?: string }) => (p.country ? `${p.name}, ${p.country}` : p.name));
    expect(chips[0]).toBe('Pune, IN');
    for (const chip of chips) expect(chip).not.toContain('undefined');
  });
});

describe('no client-side geocoding anywhere in this app', () => {
  it('the manifest carries no geocoding dependency', () => {
    const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const FORBIDDEN =
      /geocod|places-autocomplete|node-geocoder|opencage|mapbox|@googlemaps|leaflet|nominatim/i;
    expect(deps.filter((d) => FORBIDDEN.test(d))).toEqual([]);
  });

  it('the review module resolves nothing itself', () => {
    const src = readFileSync(join(APP, 'src', 'lib', 'review-view.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bfetch\s*\(/);
    // no coordinate arithmetic, no timezone table, no city list
    expect(src).not.toMatch(/latitude\s*[+\-*/]/);
    expect(src).not.toMatch(/'Asia\/[A-Z]/);
  });
});
