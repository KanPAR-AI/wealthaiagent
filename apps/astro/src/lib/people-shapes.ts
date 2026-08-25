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

/** docs/49 ASTRAL-147/160: what a stored priority carries. `provenance` is
 *  what keeps "your chart suggested this" and "you chose this" from looking
 *  alike on a screen, and `basis` is the chart feature behind the first. */
export interface PriorityEntry {
  key: string;
  label: string;
  provenance: 'user_set' | 'chart_derived' | 'accepted_proposal' | string;
  basis?: string | null;
  /** docs/49 F55: the mapping version this basis was computed under, and
   *  whether the table has moved since. A frozen "your chart says" that a
   *  screen cannot tell from a current one is the two-generations failure
   *  ASTRAL-158 names, with a UI in front of it. */
  basis_mapping_version?: number;
  basis_stale?: boolean;
  recorded_at?: string;
}

/** The second tier (ASTRAL-162, AMB-32(c)). `free_text` is the user's own
 *  note: stored, shown back to them, and never rendered into composed prose. */
export interface StatedInterest {
  key: string | null;
  text: string;
  provenance: string;
  free_text: boolean;
  unscored_sentence?: string | null;
}

export interface PriorityProposal {
  key: string;
  basis: string;
  why?: string;
  feature_terms?: string[];
  row?: string;
}

export interface PrioritiesResponse {
  set: {
    ranked: PriorityEntry[];
    interests: StatedInterest[];
    removed: { key: string; removed_at: string }[];
    updated_at?: string | null;
    mapping_version?: number;
  };
  proposed: {
    entries: PriorityProposal[];
    skipped: { row: string; key: string; reason: string }[];
    reason?: string;
    chart_status?: string;
  };
  vocabulary: {
    max_ranked: number;
    priorities: { key: string; label: string; kootas: string[] }[];
    interests: { key: string; label: string; domains: string[] }[];
  };
  /** ASTRAL-158 / F55: the comparison, not just the stamp. `migration` is
   *  null when the stored set is current — there is nothing to name. */
  mapping?: {
    stored_version: number;
    current_version: number;
    stale: boolean;
    migration: {
      stored_version: number;
      current_version: number;
      stale_keys: string[];
      note: string;
    } | null;
  };
  disclosure: string;
  /** the SENTENCE that opens the ask. Never a value — no route param of this
   *  app carries anything a fact could be reconstructed from (F24). */
  edit_turn: string;
}

/** ASTRAL-157: the koota the ordering used, with the points the ENGINE
 *  computed for it. `points` is null on a koota that was not scored — a
 *  pending koota is not a zero. */
export interface LeadingKoota {
  name: string;
  points: number | null;
  max: number | null;
  pending: boolean;
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
  /** the prioritised kootas, on the row, so the printed rule is checkable */
  leading_kootas?: LeadingKoota[];
}

export type MatchGroupKey = 'complete' | 'firm_only' | 'refused';

export interface MatchGroup {
  key: MatchGroupKey | string;
  label: string;
  rows: MatchRow[];
  /** ASTRAL-157: the rule the server sorted by, in the words of its own
   *  mapping. Printed above the group, so the ordering is falsifiable. */
  sort_rule?: string;
  /** the firm-only group's honest note when it could not use a priority */
  sort_note?: string;
}

export interface MatchesResponse {
  groups: MatchGroup[];
  total: number;
  priorities?: {
    ranked: PriorityEntry[];
    koota_order: string[];
    interests: { key: string; label: string; unscored_sentence: string }[];
    notes: string[];
  };
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

// ══════════════════════════════════════════════════════════════════════════
// The derived reads screens 3, 8 and 9 open with (docs/49 PH-16)
//
// Mirrors of `chatservice/services/people/artifacts.py` and
// `services/agents/astrology/daily_facets.py`. Written as a DISCRIMINATED
// UNION on `state`, because the alternative — one optional-everything
// interface — is how a screen ends up rendering a card that is not there.
// TypeScript refuses `res.card` until the code has proved `state === 'ready'`,
// which is ASTRAL-125's "a stated absence, never yesterday's card" enforced
// by the compiler rather than by review.
// ══════════════════════════════════════════════════════════════════════════

/** Why there is nothing to show. Each one asks for a DIFFERENT action from
 *  the reader, which is why they are not one string (`artifacts.py`). */
export type ReadState =
  | 'ready'
  | 'not_established'
  | 'chart_absent'
  | 'chart_stale'
  | 'chart_unstamped'
  | 'chart_unprovable'
  | 'refused';

export interface ReadAbsent {
  state: Exclude<ReadState, 'ready'>;
  reason: string;
  chart?: { status: string; computed_at?: string | null };
}

/** A layer the engine could NOT compute, with its reason — never an empty
 *  slot. `unlocked_by` names the fact that would fix it, when one would. */
export interface AbsentLayer {
  layer: string;
  reason: string;
  unlocked_by?: string;
}

export interface DailyDasha {
  mahadasha?: DashaPeriod;
  antardasha?: DashaPeriod;
  selected_by?: string;
}

export interface TransitPlanet {
  sign?: string;
  degree?: number;
  retrograde?: boolean;
  house_from_lagna?: number;
  house_from_moon?: number;
}

/** F31: the place a panchang is FOR, on the card. A tithi with no city is a
 *  tithi for somewhere the reader has to guess. */
export interface PanchangPlace {
  name?: string | null;
  basis?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  pending_decision?: string;
}

export interface DailyCard {
  type: string;
  /** the ARTIFACT's own date — never the device's (ASTRAL-125) */
  date: string;
  market: string;
  shape: string;
  key: string;
  inputs_hash: string;
  layers: string[];
  absent_layers: AbsentLayer[];
  omitted_by_shape: string[];
  undetermined: Undetermined[];
  time_known: boolean;
  calculation: Record<string, unknown>;
  transit?: {
    as_of?: string;
    window?: { start: string; end: string };
    transit_place?: PanchangPlace;
    natal_anchors?: Record<string, unknown>;
    planets?: Record<string, TransitPlanet>;
    rules?: Record<string, Record<string, unknown>>;
  };
  dasha?: DailyDasha;
  panchang?: {
    tithi?: string;
    vara?: string;
    nakshatra?: string;
    yoga?: string;
    karana?: string;
    panchang_place?: PanchangPlace;
  };
  narration?: { text: string; task: string; narrated_for: string };
}

export interface FacetItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  /** dasha items carry their dates as DATA, so the client formats them the
   *  way it formats every other date (a server-joined range printed raw ISO
   *  on screen — measured on-sim) */
  start_date?: string;
  end_date?: string;
  /** the adjudicator domains this item touches; empty is a real answer */
  domains: string[];
  basis: string;
  place?: { name?: string | null; basis?: string };
  alternatives?: string[];
  unlocked_by?: string | null;
}

export interface FacetTab {
  id: string;
  label: string;
  domains: string[];
  items: FacetItem[];
  /** present when the tab has nothing today, and it says which areas */
  empty_reason: string | null;
}

export interface DailyReady {
  state: 'ready';
  date: string;
  card: DailyCard;
  facets: { version: number; tabs: FacetTab[]; item_count: number; artifact_key?: string; date?: string };
  narration: { text: string; generated_this_request: boolean; available: boolean };
  chart: { status: string; computed_at?: string | null };
  person: { id: string; display_name: string };
  served_from_store: boolean;
}

export type DailyResponse = DailyReady | ReadAbsent;

export interface TimelinePeriod {
  level: 'mahadasha' | 'antardasha' | string;
  index?: number;
  parent_index?: number;
  parent?: string;
  planet: string;
  start_date: string;
  end_date: string;
  houses_ruled?: number[];
  /** house significations, decided by the ENGINE (ASTRAL-127: no category
   *  inferred on the client) */
  categories?: string[];
  category_basis?: string;
}

export interface TimelineWindow {
  planet?: string;
  kind?: string;
  rule?: string;
  sign?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  categories?: string[];
  houses?: number[];
}

export interface TimelineArtifact {
  type: string;
  as_of: string;
  key: string;
  inputs_hash: string;
  layers: string[];
  absent_layers: AbsentLayer[];
  undetermined: Undetermined[];
  time_known: boolean;
  calculation: Record<string, unknown>;
  dasha?: { periods: TimelinePeriod[]; sub_periods: TimelinePeriod[] };
  transit?: { windows?: TimelineWindow[]; active_without_dates?: unknown[] };
  cursor: { as_of: string; mahadasha_index: number | null; antardasha_index: number | null };
  /** ASTRAL-127: the current period, or the NAMED absence in its place */
  headline:
    | { kind: 'dasha_period'; mahadasha: TimelinePeriod; antardasha?: TimelinePeriod | null }
    | { kind: 'absent_layer'; layer: string; reason: string };
  span: { start: string | null; end: string | null };
  years: number[];
}

export interface TimelineReady {
  state: 'ready';
  as_of: string;
  timeline: TimelineArtifact;
  years: number[];
  chart: { status: string; computed_at?: string | null };
  person: { id: string; display_name: string };
  served_from_store: boolean;
}

export type TimelineResponse = TimelineReady | ReadAbsent;

/** F59 (Role-3 ruled: spec-clean) — adopt the signed-in account's name as
 *  the profile LABEL when the store has none. A label is what a person is
 *  CALLED, not what they ARE: `display_name` is absent from the chart's
 *  inputs, `update_labels` invalidates nothing, and the labels route is the
 *  sanctioned writer. Three conditions, and they are the whole ruling:
 *  only when the stored name is empty; only the account's displayName —
 *  never the email or a local-part split of one; only when `self` exists.
 *  Returns the name it adopted, or null when any condition failed. */
export function nameToAdopt(
  storedName: string | null | undefined,
  selfEstablished: boolean,
  accountName: string | null | undefined,
): string | null {
  if (!selfEstablished) return null;
  if (storedName && storedName.trim()) return null;
  const name = (accountName || '').trim();
  if (!name || name.includes('@')) return null;
  return name;
}
