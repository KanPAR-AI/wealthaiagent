// lib/memory-filters-url.ts — pure URL <-> filter-state codec for the
// Memories browser (UI-1, §5, MUI-0007/UI-25). STATE_MODEL: "the URL owns
// filter/selection state" — this module is the ONE place that encodes/
// decodes it, so every control (rail + header) agrees on the same shape
// and a page reload/deep-link restores EXACTLY (UI-25).
//
// Pure functions only — no React, no fetch, trivially unit-testable.
import type {
  ListMemoriesQuery,
  MemoryStatus,
  MemoryType,
  SearchQuery,
  SourceType,
} from "@/services/memory-engine-service";

export type SortMode = "relevance" | "browse";

export interface MemoryFiltersState {
  q: string;
  namespace: string;
  types: MemoryType[];
  sources: SourceType[];
  statuses: MemoryStatus[];
  /** Minimum-confidence threshold as a string so "" (any) round-trips
   *  distinctly from "0". Only floor values the backend can express are
   *  offered (no max_confidence filter exists — see API_MAPPING). */
  minConfidence: "" | "0.7" | "0.9";
  minAuthority: "" | "0.5" | "0.8";
  /** yyyy-mm-dd, or "" for unset. */
  createdAfter: string;
  createdBefore: string;
  /** "Valid date" (§5) — a point-in-time query, mapped onto the engine's
   *  existing temporal `at` (T9), never a new range semantics. */
  validAt: string;
  entityId: string;
  /** "relevance" (default) = ranked POST /search (engine ranking,
   *  unchanged). "browse" = structured GET /memories, the engine's own
   *  stable order, explicitly unranked — never client-resorted either
   *  way (STATE_MODEL "what the client must not compute"). */
  sort: SortMode;
}

export const DEFAULT_MEMORY_FILTERS: MemoryFiltersState = {
  q: "",
  namespace: "",
  types: [],
  sources: [],
  statuses: [],
  minConfidence: "",
  minAuthority: "",
  createdAfter: "",
  createdBefore: "",
  validAt: "",
  entityId: "",
  sort: "relevance",
};

function parseList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function serializeList(values: string[]): string | null {
  return values.length ? values.join(",") : null;
}

/** URLSearchParams -> MemoryFiltersState. Unknown/absent keys fall back to
 *  DEFAULT_MEMORY_FILTERS (never throws on a malformed param). */
export function parseMemoryFiltersFromParams(
  params: URLSearchParams,
): MemoryFiltersState {
  const minConfidence = params.get("confidence");
  const minAuthority = params.get("authority");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    namespace: params.get("namespace") ?? "",
    types: parseList(params, "type") as MemoryType[],
    sources: parseList(params, "source") as SourceType[],
    statuses: parseList(params, "status") as MemoryStatus[],
    minConfidence: minConfidence === "0.7" || minConfidence === "0.9" ? minConfidence : "",
    minAuthority: minAuthority === "0.5" || minAuthority === "0.8" ? minAuthority : "",
    createdAfter: params.get("createdAfter") ?? "",
    createdBefore: params.get("createdBefore") ?? "",
    validAt: params.get("at") ?? "",
    entityId: params.get("entity") ?? "",
    sort: sort === "browse" ? "browse" : "relevance",
  };
}

/** Applies a partial filter change onto `current` search params, returning
 *  a NEW URLSearchParams (never mutates the input) with every OTHER
 *  existing param preserved untouched — a filter control writes only its
 *  own key(s) (MUI-0007). */
export function applyMemoryFilterChange(
  current: URLSearchParams,
  patch: Partial<MemoryFiltersState>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const state = { ...parseMemoryFiltersFromParams(current), ...patch };

  setOrDelete(next, "q", state.q);
  setOrDelete(next, "namespace", state.namespace);
  setOrDeleteRaw(next, "type", serializeList(state.types));
  setOrDeleteRaw(next, "source", serializeList(state.sources));
  setOrDeleteRaw(next, "status", serializeList(state.statuses));
  setOrDelete(next, "confidence", state.minConfidence);
  setOrDelete(next, "authority", state.minAuthority);
  setOrDelete(next, "createdAfter", state.createdAfter);
  setOrDelete(next, "createdBefore", state.createdBefore);
  setOrDelete(next, "at", state.validAt);
  setOrDelete(next, "entity", state.entityId);
  if (state.sort === "browse") next.set("sort", "browse");
  else next.delete("sort");

  return next;
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function setOrDeleteRaw(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value);
  else params.delete(key);
}

/** MemoryFiltersState -> SearchQuery (relevance/ranked mode). Every field
 *  maps 1:1 onto a real MemoryQuery/SearchBody filter (API_MAPPING
 *  MUI-1001) — this function invents nothing the backend doesn't already
 *  accept. `at` MUST carry a UTC-midnight ISO instant (T9 point query,
 *  naive input means UTC server-side, but we send tz-explicit to be
 *  unambiguous). */
export function buildSearchQuery(
  state: MemoryFiltersState,
  limit = 50,
): SearchQuery {
  const query: SearchQuery = { limit };
  if (state.q) query.text = state.q;
  if (state.namespace) query.namespaces = [state.namespace];
  if (state.types.length) query.types = state.types;
  if (state.sources.length) query.source_types = state.sources;
  if (state.statuses.length) query.statuses = state.statuses;
  if (state.minConfidence) query.min_confidence = Number(state.minConfidence);
  if (state.minAuthority) query.min_authority = Number(state.minAuthority);
  if (state.createdAfter) query.created_after = toDayStart(state.createdAfter);
  if (state.createdBefore) query.created_before = toDayEnd(state.createdBefore);
  if (state.validAt) query.at = toDayStart(state.validAt);
  if (state.entityId) query.entity_id = state.entityId;
  return query;
}

/** MemoryFiltersState -> ListMemoriesQuery (browse/unranked mode). GET
 *  /memories only supports namespace/status/type/source_type (no
 *  confidence/authority/date/entity filters — API_MAPPING MUI-1001) so
 *  this deliberately narrower mapping never claims to honor filters the
 *  endpoint can't apply. */
export function buildListQuery(state: MemoryFiltersState): ListMemoriesQuery {
  const query: ListMemoriesQuery = {};
  if (state.namespace) query.namespace = state.namespace;
  if (state.statuses.length) query.status = state.statuses;
  if (state.types.length) query.type = state.types;
  if (state.sources.length) query.source_type = state.sources;
  return query;
}

function toDayStart(yyyyMmDd: string): string {
  return `${yyyyMmDd}T00:00:00.000Z`;
}

function toDayEnd(yyyyMmDd: string): string {
  return `${yyyyMmDd}T23:59:59.999Z`;
}

/** Filters ignored by "browse" mode (for an honest UI hint, never silently
 *  dropped without explanation). */
export function browseModeIgnoredFilters(state: MemoryFiltersState): string[] {
  const ignored: string[] = [];
  if (state.q) ignored.push("search text");
  if (state.minConfidence) ignored.push("confidence");
  if (state.minAuthority) ignored.push("authority");
  if (state.createdAfter || state.createdBefore) ignored.push("created date");
  if (state.validAt) ignored.push("valid date");
  if (state.entityId) ignored.push("entity");
  return ignored;
}

export function isDefaultFilters(state: MemoryFiltersState): boolean {
  return JSON.stringify(state) === JSON.stringify(DEFAULT_MEMORY_FILTERS);
}
