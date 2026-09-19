// lib/__tests__/full-graph-filters-url.test.ts — the URL <-> filter-state
// codec for the Full Knowledge Graph page. Pure functions, no DOM.
import {
  DEFAULT_FULL_GRAPH_FILTERS,
  isDefaultFullGraphFilters,
  parseFullGraphFiltersFromParams,
  serializeFullGraphFilters,
} from "@/lib/full-graph-filters-url";

describe("full-graph-filters-url", () => {
  test("parsing empty params yields DEFAULT_FULL_GRAPH_FILTERS", () => {
    expect(parseFullGraphFiltersFromParams(new URLSearchParams())).toEqual(DEFAULT_FULL_GRAPH_FILTERS);
    expect(isDefaultFullGraphFilters(DEFAULT_FULL_GRAPH_FILTERS)).toBe(true);
  });

  test("round-trips every field through the URL exactly", () => {
    const state = {
      namespace: "travel",
      statuses: ["active", "disputed"] as const,
      predicateQuery: "allergy",
      onlyProblems: true,
      tab: "table" as const,
      selected: "record:mem_123",
    };
    const params = serializeFullGraphFilters({ ...state, statuses: [...state.statuses] });
    const restored = parseFullGraphFiltersFromParams(params);
    expect(restored).toEqual({ ...state, statuses: [...state.statuses] });
  });

  test("an unknown status value in the URL is dropped, not crashed on", () => {
    const params = new URLSearchParams("status=active&status=bogus");
    expect(parseFullGraphFiltersFromParams(params).statuses).toEqual(["active"]);
  });

  test("tab defaults to 'graph' for any value other than 'table'", () => {
    expect(parseFullGraphFiltersFromParams(new URLSearchParams("tab=bogus")).tab).toBe("graph");
    expect(parseFullGraphFiltersFromParams(new URLSearchParams("tab=table")).tab).toBe("table");
  });

  test("serialize omits keys at their default value (no ?tab=graph noise)", () => {
    const params = serializeFullGraphFilters(DEFAULT_FULL_GRAPH_FILTERS);
    expect(params.toString()).toBe("");
  });

  test("isDefaultFullGraphFilters is false once any field is set", () => {
    expect(isDefaultFullGraphFilters({ ...DEFAULT_FULL_GRAPH_FILTERS, onlyProblems: true })).toBe(false);
  });
});
