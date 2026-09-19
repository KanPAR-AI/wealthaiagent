// lib/full-graph-filters-url.ts — pure URL <-> filter-state codec for the
// Full Knowledge Graph debug page (mirrors the pattern in
// lib/memory-filters-url.ts — STATE_MODEL "the URL owns filter state").
// Pure functions only; no React, no fetch.
import type { MemoryStatus } from "@/services/memory-engine-service";

export type KgTab = "graph" | "table";

export interface FullGraphFiltersState {
  namespace: string;
  statuses: MemoryStatus[];
  predicateQuery: string;
  onlyProblems: boolean;
  tab: KgTab;
  /** the selected node/record id for the inspector panel, or "" for none. */
  selected: string;
}

export const DEFAULT_FULL_GRAPH_FILTERS: FullGraphFiltersState = {
  namespace: "",
  statuses: [],
  predicateQuery: "",
  onlyProblems: false,
  tab: "graph",
  selected: "",
};

const VALID_STATUSES: MemoryStatus[] = ["active", "superseded", "expired", "disputed", "deleted"];

export function parseFullGraphFiltersFromParams(params: URLSearchParams): FullGraphFiltersState {
  const rawStatuses = params.getAll("status");
  const statuses = rawStatuses.filter((s): s is MemoryStatus =>
    (VALID_STATUSES as string[]).includes(s),
  );
  const tab = params.get("tab") === "table" ? "table" : "graph";
  return {
    namespace: params.get("namespace") ?? "",
    statuses,
    predicateQuery: params.get("predicate") ?? "",
    onlyProblems: params.get("problems") === "1",
    tab,
    selected: params.get("selected") ?? "",
  };
}

export function serializeFullGraphFilters(state: FullGraphFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.namespace) params.set("namespace", state.namespace);
  for (const s of state.statuses) params.append("status", s);
  if (state.predicateQuery) params.set("predicate", state.predicateQuery);
  if (state.onlyProblems) params.set("problems", "1");
  if (state.tab !== "graph") params.set("tab", state.tab);
  if (state.selected) params.set("selected", state.selected);
  return params;
}

export function isDefaultFullGraphFilters(state: FullGraphFiltersState): boolean {
  return (
    state.namespace === "" &&
    state.statuses.length === 0 &&
    state.predicateQuery === "" &&
    state.onlyProblems === false &&
    state.tab === "graph" &&
    state.selected === ""
  );
}
