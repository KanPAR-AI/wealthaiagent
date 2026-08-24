// The People API client (docs/49 ASTRAL-135, S18/S19).
//
// ONE module talks to `/people`, for the same reason `lib/credits.ts` is the
// only module that talks to `/credits`: a screen that fetches is a screen
// that owns a URL, a token header and an error shape, and three screens
// doing that is three places for the auth header to drift.
//
// ── what this client is NOT allowed to become ─────────────────────────────
//
// There is no `saveBirthDetails`, no `POST /people` and no `PATCH` that
// carries a date. The server has no such route and must not grow one (F24):
// birth facts reach state through the `input_request` → `input_response`
// carrier into `reconcile`, which is the only fact-writer (INV-1). What this
// file may write is what a person is CALLED and whether they are starred —
// owner-authored labels, never facts.
//
// ── reads never compute ───────────────────────────────────────────────────
//
// Opening Profile or Matches costs no ephemeris second, no model call and no
// credit (ASTRAL-135). There is deliberately no `recomputeChart()` here: no
// such endpoint exists, and a stale chart is RENDERED stale with the date it
// was cast rather than quietly refreshed (AMB-31, interim (a)).

import type { MatchDosha } from '@wealthai/astral';

import { getToken } from './auth';
import { apiUrl } from './core-adapter';

// ── the shapes the server actually sends ──────────────────────────────────
//
// Mirrors of `chatservice/services/people/views.py` and `matches.py`,
// verified against the live API. Optional fields are optional HERE because
// they are ABSENT THERE: the chart summary REMOVES what the undetermined
// register hides rather than nulling it (`chart.py:_hide`), which is what
// lets ASTRAL-137's "no `—` in the lagna row" be a property of the data
// instead of a rule a screen has to remember.

/** ASTRAL-35's closed vocabulary. A value this app does not know is rendered
 *  as an unattributed one rather than as something the user said. */
export type Provenance =
  | 'stated_by_user'
  | 'seeded_from_memory'
  | 'parsed_from_page'
  | 'parsed_from_biodata'
  | 'geocoded'
  | 'unattributed_legacy';

export interface Fact {
  value: unknown;
  provenance: Provenance | string;
  recorded_at: string;
}

/** ASTRAL-71's register entry: what this chart cannot determine, and why. */
export interface Undetermined {
  field: string;
  reason: string;
  alternatives: string[];
  unlocked_by: string;
}

export type ChartStatus =
  | 'fresh'
  | 'stale'
  | 'corrected_stale'
  | 'unprovable'
  | 'unstamped'
  | 'absent';

export interface DashaPeriod {
  planet?: string;
  start_date?: string;
  end_date?: string;
}

export interface ChartSummary {
  status: ChartStatus | string;
  computed_at?: string | null;
  reason?: string;
  missing_stamp?: string[];
  time_known?: boolean;
  zodiac_mode?: string;
  ayanamsa?: string;
  house_system?: string;
  moon_rashi?: string;
  sun_rashi?: string;
  nakshatra?: string;
  nakshatra_pada?: number;
  lagna?: string;
  lagna_degree?: number;
  houses?: number;
  mahadasha?: DashaPeriod;
  antardasha?: DashaPeriod;
  undetermined?: Undetermined[];
}

export interface PersonView {
  id: string;
  relation: string;
  display_name: string;
  source_label: string;
  favourite: boolean;
  notes?: string | null;
  tob_known: boolean;
  birth_facts: Record<string, Fact>;
  coordinates?: Record<string, Fact> | null;
  created_at: string;
  updated_at: string;
  /** self only (AMB-30: priorities are self-only in v1) */
  priorities?: unknown;
  chart?: ChartSummary;
}

/** A complete scorecard: `n` out of 36. */
export interface CompleteScore {
  points: number;
  out_of: number;
}

/** A firm-only scorecard: `n` out of 15, with the pending count NAMED.
 *  The two shapes are different types on purpose — `firm_points` cannot be
 *  read as `points` by accident, so no row can print 12/15 as if it were a
 *  score out of 36 (F39). */
export interface FirmOnlyScore {
  firm_points: number;
  out_of: number;
  pending: number;
  pending_reasons: string[];
}

export type MatchScore = CompleteScore | FirmOnlyScore;

export function isFirmOnly(score: MatchScore | undefined): score is FirmOnlyScore {
  return !!score && 'firm_points' in score;
}

export interface MatchRow {
  pair_key: string;
  person_id: string | null;
  display_name: string;
  favourite: boolean;
  relation: string | null;
  tob_known: boolean;
  freshness: 'fresh' | 'stale' | 'unprovable' | string;
  computed_at?: string | null;
  /** the engine's own word, verbatim — on a firm-only row it is `incomplete` */
  verdict?: string | null;
  /** the engine's own `{name, detail, provisional}` objects, verbatim. The
   *  shared payload type is imported rather than restated: a second dosha
   *  model in an app is a second place the word "provisional" can mean
   *  something slightly different. */
  doshas: MatchDosha[];
  dosha_count: number;
  refusal?: Record<string, unknown>;
  score?: MatchScore;
}

export type MatchGroupKey = 'complete' | 'firm_only' | 'refused';

export interface MatchGroup {
  key: MatchGroupKey | string;
  label: string;
  rows: MatchRow[];
}

export interface MatchesResponse {
  groups: MatchGroup[];
  total: number;
}

export interface PeopleResponse {
  people: PersonView[];
  self_established: boolean;
}

export interface SelfResponse {
  person: PersonView | null;
  state: 'established' | 'not_established' | string;
  reason?: string;
}

/** ASTRAL-138's disclosure: a field NAME in, the affected set out. No value
 *  is sent and none comes back — this is a read that describes a write it
 *  will never perform. */
export interface EditImpact {
  field: string;
  label: string;
  recomputes_coordinates: boolean;
  affected: { kind: 'chart' | 'match' | string; person_id?: string; pair_key?: string }[];
  derived_keys: string[];
}

// ── transport ─────────────────────────────────────────────────────────────

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : null),
      ...(init?.headers ?? null),
    },
  });
  if (!res.ok) {
    // Named and thrown, never swallowed into an empty list: "you have no
    // people" and "the read failed" are different sentences and the screens
    // below say the right one because this throws.
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchPeople(): Promise<PeopleResponse> {
  return call<PeopleResponse>('people');
}

export function fetchSelf(): Promise<SelfResponse> {
  return call<SelfResponse>('people/self');
}

export function fetchMatches(): Promise<MatchesResponse> {
  return call<MatchesResponse>('people/matches');
}

export function fetchEditImpact(personId: string, field: string): Promise<EditImpact> {
  return call<EditImpact>(`people/${encodeURIComponent(personId)}/edit-impact?field=${encodeURIComponent(field)}`);
}

/** Labels only: what a person is CALLED and whether they are starred.
 *  `invalidated` comes back empty by construction — the list joins artifact
 *  to person at render (ASTRAL-141), so a rename recomputes nothing. */
export function patchLabels(
  personId: string,
  patch: { display_name?: string; favourite?: boolean; notes?: string },
): Promise<{ person: PersonView; invalidated: string[] }> {
  return call(`people/${encodeURIComponent(personId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** ASTRAL-36's cascade. `self` is refused by the server, not hidden here. */
export function deletePerson(personId: string): Promise<{
  person_id: string;
  matches_deleted: string[];
  chart_deleted: boolean;
}> {
  return call(`people/${encodeURIComponent(personId)}`, { method: 'DELETE' });
}
