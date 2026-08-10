// lib/__tests__/memory-filters-url.test.ts — the URL <-> filter-state codec
// is the load-bearing piece for UI-25 (reload restores exactly) and UI-1's
// "filters go to the server as params" contract. Pure functions, no DOM.
import {
  DEFAULT_MEMORY_FILTERS,
  applyMemoryFilterChange,
  browseModeIgnoredFilters,
  buildListQuery,
  buildSearchQuery,
  isDefaultFilters,
  parseMemoryFiltersFromParams,
} from "@/lib/memory-filters-url";

describe("memory-filters-url", () => {
  test("parsing empty params yields DEFAULT_MEMORY_FILTERS", () => {
    expect(parseMemoryFiltersFromParams(new URLSearchParams())).toEqual(
      DEFAULT_MEMORY_FILTERS,
    );
    expect(isDefaultFilters(DEFAULT_MEMORY_FILTERS)).toBe(true);
  });

  test("round-trips every filter field through the URL exactly (UI-25)", () => {
    const params = new URLSearchParams();
    const withEverything = applyMemoryFilterChange(params, {
      q: "aisle seat",
      namespace: "travel",
      types: ["preference", "profile"],
      sources: ["user_explicit"],
      statuses: ["active", "disputed"],
      minConfidence: "0.9",
      minAuthority: "0.5",
      createdAfter: "2026-01-01",
      createdBefore: "2026-06-01",
      validAt: "2026-03-15",
      entityId: "ent_42",
      sort: "browse",
    });

    const restored = parseMemoryFiltersFromParams(withEverything);
    expect(restored).toEqual({
      q: "aisle seat",
      namespace: "travel",
      types: ["preference", "profile"],
      sources: ["user_explicit"],
      statuses: ["active", "disputed"],
      minConfidence: "0.9",
      minAuthority: "0.5",
      createdAfter: "2026-01-01",
      createdBefore: "2026-06-01",
      validAt: "2026-03-15",
      entityId: "ent_42",
      sort: "browse",
    });
  });

  test("a single-control patch changes ONLY that key, preserving every other existing param", () => {
    const params = new URLSearchParams("q=aisle&namespace=travel&scope=user:ravi");
    const next = applyMemoryFilterChange(params, { statuses: ["disputed"] });

    expect(next.get("q")).toBe("aisle");
    expect(next.get("namespace")).toBe("travel");
    expect(next.get("scope")).toBe("user:ravi"); // untouched, non-filter param
    expect(next.get("status")).toBe("disputed");
  });

  test("clearing a filter deletes its key rather than writing an empty string", () => {
    const params = applyMemoryFilterChange(new URLSearchParams(), {
      types: ["preference"],
    });
    expect(params.has("type")).toBe(true);

    const cleared = applyMemoryFilterChange(params, { types: [] });
    expect(cleared.has("type")).toBe(false);
  });

  test("malformed/unknown confidence and authority values fall back to 'any', never throw", () => {
    const params = new URLSearchParams("confidence=bogus&authority=nope");
    const state = parseMemoryFiltersFromParams(params);
    expect(state.minConfidence).toBe("");
    expect(state.minAuthority).toBe("");
  });

  test("sort defaults to relevance and only 'browse' is ever written explicitly", () => {
    const params = new URLSearchParams();
    const relevanceParams = applyMemoryFilterChange(params, { sort: "relevance" });
    expect(relevanceParams.has("sort")).toBe(false);

    const browseParams = applyMemoryFilterChange(params, { sort: "browse" });
    expect(browseParams.get("sort")).toBe("browse");
  });

  test("buildSearchQuery maps every filter onto a real MemoryQuery/SearchBody field", () => {
    const state = parseMemoryFiltersFromParams(
      new URLSearchParams(
        "q=aisle&namespace=travel&type=preference&source=user_explicit&status=active" +
          "&confidence=0.9&authority=0.5&createdAfter=2026-01-01&createdBefore=2026-06-01" +
          "&at=2026-03-15&entity=ent_42",
      ),
    );
    expect(buildSearchQuery(state, 50)).toEqual({
      limit: 50,
      text: "aisle",
      namespaces: ["travel"],
      types: ["preference"],
      source_types: ["user_explicit"],
      statuses: ["active"],
      min_confidence: 0.9,
      min_authority: 0.5,
      created_after: "2026-01-01T00:00:00.000Z",
      created_before: "2026-06-01T23:59:59.999Z",
      at: "2026-03-15T00:00:00.000Z",
      entity_id: "ent_42",
    });
  });

  test("buildSearchQuery omits unset fields entirely (never sends empty-string filters)", () => {
    expect(buildSearchQuery(DEFAULT_MEMORY_FILTERS, 8)).toEqual({ limit: 8 });
  });

  test("buildListQuery only forwards what GET /memories actually supports", () => {
    const state = parseMemoryFiltersFromParams(
      new URLSearchParams(
        "q=aisle&namespace=travel&type=preference&source=user_explicit&status=active" +
          "&confidence=0.9&entity=ent_42",
      ),
    );
    // No `q`/confidence/authority/date/entity in the structured-list request
    // — the endpoint has no way to apply them (API_MAPPING MUI-1001).
    expect(buildListQuery(state)).toEqual({
      namespace: "travel",
      status: ["active"],
      type: ["preference"],
      source_type: ["user_explicit"],
    });
  });

  test("browseModeIgnoredFilters names exactly the filters browse mode cannot honor", () => {
    const state = parseMemoryFiltersFromParams(
      new URLSearchParams("q=aisle&confidence=0.9&entity=ent_42"),
    );
    const ignored = browseModeIgnoredFilters(state);
    expect(ignored).toContain("search text");
    expect(ignored).toContain("confidence");
    expect(ignored).toContain("entity");
    expect(ignored).not.toContain("authority");
  });
});
