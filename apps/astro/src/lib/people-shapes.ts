// The People API's SHAPES — types only, and one type guard (docs/49 S18/S19).
//
// Split from `people.ts` for a mechanical reason worth stating: the transport
// imports `lib/auth.ts`, which imports react-native, which the root jest
// project cannot parse. The view models are pure and unit-tested there, so
// the shapes they speak must be reachable without dragging a native module in
// behind them. A type-only import would have been erased; `isFirmOnly` is a
// real function and is not.
//
// Mirrors of `chatservice/services/people/views.py` and `matches.py`,
// verified against the live API.

import type { MatchDosha } from '@wealthai/astral';

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
