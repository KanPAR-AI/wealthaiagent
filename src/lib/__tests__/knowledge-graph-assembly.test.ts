// lib/__tests__/knowledge-graph-assembly.test.ts — thorough unit tests for
// the pure Full Knowledge Graph assembly logic. Fixtures are wire-shaped
// (mirror MemoryRecord.to_dict / GraphEdge / Entity verbatim) and every
// assertion checks against a LITERAL value from the fixture — never a
// value the test derives from the code under test (test-traceability:
// "assert against the fixture/wire values, never a value the test just
// derived").
import {
  buildGraphView,
  buildProblemSets,
  buildSupersedeChains,
  computeHealth,
  dedupeRelations,
  filterRecordsForView,
  findActiveDuplicates,
  findOrphans,
  findSuspiciousValues,
  recordMatchesFilters,
} from "@/lib/knowledge-graph-assembly";
import type { Entity, GraphEdge, MemoryRecord, MemoryStatus } from "@/services/memory-engine-service";

function makeRecord(overrides: Partial<MemoryRecord> & { id: string }): MemoryRecord {
  return {
    tenant_id: "platform",
    owner_type: "user",
    owner_id: "u1",
    owner_key: "user:u1",
    namespace: "travel",
    type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference",
    value: "aisle",
    text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats",
    status: "active",
    authority: 0.9,
    confidence: 0.95,
    importance: 0.5,
    source_type: "user_explicit",
    valid_from: null,
    valid_until: null,
    observed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    last_accessed_at: null,
    access_count: 0,
    version: 1,
    supersedes: [],
    superseded_by: null,
    entity_ids: [],
    tags: [],
    evidence_ids: [],
    qualifiers: {},
    pinned: false,
    exact_tokens: [],
    idempotency_keys: [],
    projections_pending: [],
    dedup_key: `dk-${overrides.id}`,
    policy: {},
    metadata: {},
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  return {
    tenant_id: "platform",
    owner_key: "user:u1",
    canonical_name: "Priya",
    entity_type: "person",
    aliases: [],
    attributes: {},
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEdge(overrides: Partial<GraphEdge> & { id: string; source: string; target: string }): GraphEdge {
  return {
    relation_type: "spouse_of",
    valid_from: null,
    valid_until: null,
    confidence: 0.9,
    status: "active",
    evidence_id: null,
    ...overrides,
  };
}

// ── dedupeRelations ─────────────────────────────────────────────────────

describe("dedupeRelations", () => {
  it("keeps one copy of a relation returned by both of its endpoints' neighborhoods", () => {
    const edge = makeEdge({ id: "rel_1", source: "ent_a", target: "ent_b" });
    const result = dedupeRelations([[edge], [edge]]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rel_1");
  });

  it("preserves distinct relations across multiple entity calls", () => {
    const e1 = makeEdge({ id: "rel_1", source: "ent_a", target: "ent_b" });
    const e2 = makeEdge({ id: "rel_2", source: "ent_b", target: "ent_c", relation_type: "sibling_of" });
    const result = dedupeRelations([[e1], [e2, e1]]);
    expect(result.map((r) => r.id).sort()).toEqual(["rel_1", "rel_2"]);
  });

  it("returns an empty array for no entities", () => {
    expect(dedupeRelations([])).toEqual([]);
  });
});

// ── findActiveDuplicates ────────────────────────────────────────────────

describe("findActiveDuplicates", () => {
  it("flags two ACTIVE records sharing namespace+predicate+subject", () => {
    const a = makeRecord({ id: "mem_a", namespace: "diet", predicate: "allergy", status: "active" });
    const b = makeRecord({ id: "mem_b", namespace: "diet", predicate: "allergy", status: "active" });
    const groups = findActiveDuplicates([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].namespace).toBe("diet");
    expect(groups[0].predicate).toBe("allergy");
    expect(groups[0].recordIds.sort()).toEqual(["mem_a", "mem_b"]);
  });

  it("does NOT flag when one of the pair is superseded (the normal, healthy case)", () => {
    const old = makeRecord({ id: "mem_old", namespace: "diet", predicate: "allergy", status: "superseded" });
    const current = makeRecord({ id: "mem_new", namespace: "diet", predicate: "allergy", status: "active" });
    expect(findActiveDuplicates([old, current])).toEqual([]);
  });

  it("does NOT flag the same namespace+predicate for two DIFFERENT subjects", () => {
    const forUser = makeRecord({
      id: "mem_user",
      namespace: "diet",
      predicate: "allergy",
      status: "active",
      subject: { kind: "literal", entity_id: null, text: "user" },
    });
    const forKid = makeRecord({
      id: "mem_kid",
      namespace: "diet",
      predicate: "allergy",
      status: "active",
      subject: { kind: "entity", entity_id: "ent_kid", text: "my daughter" },
    });
    expect(findActiveDuplicates([forUser, forKid])).toEqual([]);
  });

  it("ignores records with no predicate", () => {
    const a = makeRecord({ id: "mem_a", predicate: null, status: "active" });
    const b = makeRecord({ id: "mem_b", predicate: null, status: "active" });
    expect(findActiveDuplicates([a, b])).toEqual([]);
  });
});

// ── findOrphans ─────────────────────────────────────────────────────────

describe("findOrphans", () => {
  it("flags a superseded_by id that does not resolve in the fetched set", () => {
    const record = makeRecord({ id: "mem_a", superseded_by: "mem_ghost" });
    const orphans = findOrphans([record]);
    expect(orphans).toEqual([{ recordId: "mem_a", field: "superseded_by", missingId: "mem_ghost" }]);
  });

  it("flags a supersedes id that does not resolve in the fetched set", () => {
    const record = makeRecord({ id: "mem_a", supersedes: ["mem_ghost_1", "mem_ghost_2"] });
    const orphans = findOrphans([record]);
    expect(orphans).toHaveLength(2);
    expect(orphans.map((o) => o.missingId).sort()).toEqual(["mem_ghost_1", "mem_ghost_2"]);
    expect(orphans[0].field).toBe("supersedes");
  });

  it("does NOT flag a supersede link that resolves within the set", () => {
    const older = makeRecord({ id: "mem_old", status: "superseded", superseded_by: "mem_new" });
    const newer = makeRecord({ id: "mem_new", status: "active", supersedes: ["mem_old"] });
    expect(findOrphans([older, newer])).toEqual([]);
  });
});

// ── findSuspiciousValues ────────────────────────────────────────────────

describe("findSuspiciousValues", () => {
  it("flags an impossible ISO date (2024-02-30)", () => {
    const record = makeRecord({ id: "mem_a", valid_from: "2024-02-30T00:00:00Z" });
    const flags = findSuspiciousValues([record]);
    expect(flags).toHaveLength(1);
    expect(flags[0].recordId).toBe("mem_a");
    expect(flags[0].reasons[0]).toContain("valid_from");
    expect(flags[0].reasons[0]).toContain("2024-02-30T00:00:00Z");
  });

  it("flags an impossible free-text date (31 February 2024) in text", () => {
    const record = makeRecord({ id: "mem_b", text: "Trip booked for 31 February 2024" });
    const flags = findSuspiciousValues([record]);
    expect(flags).toHaveLength(1);
    expect(flags[0].reasons.some((r) => r.includes("text"))).toBe(true);
  });

  it("flags an obviously synthetic value string", () => {
    const record = makeRecord({ id: "mem_c", value: "asdf" });
    const flags = findSuspiciousValues([record]);
    expect(flags).toHaveLength(1);
    expect(flags[0].reasons[0]).toContain('value looks like a synthetic placeholder ("asdf")');
  });

  it("does NOT flag an ordinary valid date or ordinary text", () => {
    const record = makeRecord({ id: "mem_d", valid_from: "2024-02-29T00:00:00Z", text: "Prefers window seats" });
    expect(findSuspiciousValues([record])).toEqual([]);
  });

  it("does NOT flag a normal short real-world value like 'test drive scheduled' (word boundary, not substring)", () => {
    // "test" as an exact trimmed value is a placeholder; a real sentence
    // merely containing the word "test" must not be flagged.
    const record = makeRecord({ id: "mem_e", text: "Wants to test drive the new SUV before buying" });
    expect(findSuspiciousValues([record])).toEqual([]);
  });
});

// ── buildSupersedeChains ────────────────────────────────────────────────

describe("buildSupersedeChains", () => {
  it("orders a 3-record chain oldest -> newest from supersedes/superseded_by", () => {
    const r1 = makeRecord({ id: "mem_1", status: "superseded", superseded_by: "mem_2" });
    const r2 = makeRecord({ id: "mem_2", status: "superseded", supersedes: ["mem_1"], superseded_by: "mem_3" });
    const r3 = makeRecord({ id: "mem_3", status: "active", supersedes: ["mem_2"] });
    const chains = buildSupersedeChains([r3, r1, r2]); // deliberately out of order
    expect(chains).toHaveLength(1);
    expect(chains[0].memberIds).toEqual(["mem_1", "mem_2", "mem_3"]);
    expect(chains[0].chainId).toBe("mem_1");
  });

  it("does not treat a singleton (never superseded) record as a chain", () => {
    const solo = makeRecord({ id: "mem_solo" });
    expect(buildSupersedeChains([solo])).toEqual([]);
  });

  it("builds two independent chains for two unrelated lineages", () => {
    const a1 = makeRecord({ id: "mem_a1", status: "superseded", superseded_by: "mem_a2" });
    const a2 = makeRecord({ id: "mem_a2", status: "active", supersedes: ["mem_a1"] });
    const b1 = makeRecord({ id: "mem_b1", status: "superseded", superseded_by: "mem_b2" });
    const b2 = makeRecord({ id: "mem_b2", status: "active", supersedes: ["mem_b1"] });
    const chains = buildSupersedeChains([a1, a2, b1, b2]);
    expect(chains).toHaveLength(2);
    expect(chains.map((c) => c.memberIds)).toEqual([
      ["mem_a1", "mem_a2"],
      ["mem_b1", "mem_b2"],
    ]);
  });

  it("does not hang on a cycle (defensive guard)", () => {
    const a = makeRecord({ id: "mem_x", superseded_by: "mem_y" });
    const b = makeRecord({ id: "mem_y", superseded_by: "mem_x" });
    const chains = buildSupersedeChains([a, b]);
    // both are keys AND targets of `next`, so neither is a root — the
    // pathological cycle produces no chain rather than an infinite loop.
    expect(chains).toEqual([]);
  });
});

// ── computeHealth ───────────────────────────────────────────────────────

describe("computeHealth", () => {
  it("counts records by status, entity links, valid_until, and problem totals verbatim", () => {
    const active1 = makeRecord({ id: "mem_1", status: "active", entity_ids: ["ent_1"] });
    const active2 = makeRecord({ id: "mem_2", status: "active", valid_until: "2030-01-01T00:00:00Z" });
    const superseded1 = makeRecord({ id: "mem_3", status: "superseded" });
    const health = computeHealth(
      [active1, active2, superseded1],
      [makeEntity({ id: "ent_1" })],
      [makeEdge({ id: "rel_1", source: "ent_1", target: "ent_2" })],
      [{ namespace: "diet", predicate: "allergy", subjectKey: "literal:user", recordIds: ["mem_1", "mem_2"] }],
      [{ recordId: "mem_3", field: "superseded_by", missingId: "mem_ghost" }],
      [{ recordId: "mem_1", reasons: ["value looks like a synthetic placeholder"] }],
    );
    expect(health.recordCount).toBe(3);
    expect(health.byStatus.active).toBe(2);
    expect(health.byStatus.superseded).toBe(1);
    expect(health.entityCount).toBe(1);
    expect(health.relationCount).toBe(1);
    expect(health.recordsWithEntityLinks).toBe(1);
    expect(health.recordsWithValidUntil).toBe(1);
    expect(health.activeDuplicateGroupCount).toBe(1);
    expect(health.activeDuplicateRecordCount).toBe(2);
    expect(health.orphanCount).toBe(1);
    expect(health.suspiciousCount).toBe(1);
  });
});

// ── recordMatchesFilters / filterRecordsForView ────────────────────────

describe("recordMatchesFilters / filterRecordsForView", () => {
  const emptyProblems = buildProblemSets([], [], []);

  it("filters by namespace exactly", () => {
    const travel = makeRecord({ id: "mem_1", namespace: "travel" });
    const diet = makeRecord({ id: "mem_2", namespace: "diet" });
    expect(filterRecordsForView([travel, diet], { namespace: "diet" }, emptyProblems)).toEqual([diet]);
  });

  it("filters by a status set", () => {
    const active = makeRecord({ id: "mem_1", status: "active" });
    const disputed = makeRecord({ id: "mem_2", status: "disputed" });
    const result = filterRecordsForView([active, disputed], { statuses: ["disputed" as MemoryStatus] }, emptyProblems);
    expect(result).toEqual([disputed]);
  });

  it("filters by predicate substring, case-insensitive", () => {
    const a = makeRecord({ id: "mem_1", predicate: "diet.allergy" });
    const b = makeRecord({ id: "mem_2", predicate: "seat_preference" });
    expect(filterRecordsForView([a, b], { predicateQuery: "ALLERGY" }, emptyProblems)).toEqual([a]);
  });

  it("onlyProblems keeps only flagged records", () => {
    const flagged = makeRecord({ id: "mem_1" });
    const clean = makeRecord({ id: "mem_2" });
    const problems = buildProblemSets(
      [{ namespace: "x", predicate: "y", subjectKey: "literal:user", recordIds: ["mem_1"] }],
      [],
      [],
    );
    expect(recordMatchesFilters(flagged, { onlyProblems: true }, problems)).toBe(true);
    expect(recordMatchesFilters(clean, { onlyProblems: true }, problems)).toBe(false);
  });
});

// ── buildGraphView ──────────────────────────────────────────────────────

describe("buildGraphView", () => {
  const emptyProblems = buildProblemSets([], [], []);

  it("builds subject -> namespace -> record nodes, and a record -> entity edge from entity_ids", () => {
    const entity = makeEntity({ id: "ent_1", canonical_name: "Priya" });
    const record = makeRecord({ id: "mem_1", namespace: "travel", entity_ids: ["ent_1"] });
    const view = buildGraphView([record], [entity], [], emptyProblems);

    expect(view.clustered).toBe(false);
    expect(view.shownRecordCount).toBe(1);
    expect(view.matchingRecordCount).toBe(1);

    const kinds = view.nodes.map((n) => n.kind).sort();
    expect(kinds).toEqual(["entity", "namespace", "record", "subject"]);

    const recordNode = view.nodes.find((n) => n.kind === "record")!;
    expect(recordNode.recordId).toBe("mem_1");
    expect(recordNode.status).toBe("active");

    const entityNode = view.nodes.find((n) => n.kind === "entity")!;
    expect(entityNode.label).toBe("Priya");
    expect(entityNode.entityId).toBe("ent_1");

    const recordEntityEdge = view.edges.find((e) => e.kind === "record-entity")!;
    expect(recordEntityEdge.source).toBe(recordNode.id);
    expect(recordEntityEdge.target).toBe(entityNode.id);
  });

  it("draws a supersede edge old -> new for two records both within scope", () => {
    const older = makeRecord({ id: "mem_old", status: "superseded", superseded_by: "mem_new" });
    const newer = makeRecord({ id: "mem_new", status: "active", supersedes: ["mem_old"] });
    const view = buildGraphView([older, newer], [], [], emptyProblems);
    const supersedeEdge = view.edges.find((e) => e.kind === "supersede");
    expect(supersedeEdge).toBeDefined();
    expect(supersedeEdge!.source).toBe("record:mem_old");
    expect(supersedeEdge!.target).toBe("record:mem_new");
  });

  it("draws a typed, dated entity-relation edge from the relation set", () => {
    const e1 = makeEntity({ id: "ent_a", canonical_name: "Priya" });
    const e2 = makeEntity({ id: "ent_b", canonical_name: "Rahul" });
    const relation = makeEdge({
      id: "rel_1",
      source: "ent_a",
      target: "ent_b",
      relation_type: "spouse_of",
      valid_from: "2020-01-01T00:00:00Z",
    });
    const view = buildGraphView([], [e1, e2], [relation], emptyProblems);
    const relEdge = view.edges.find((e) => e.kind === "entity-relation")!;
    expect(relEdge.relationType).toBe("spouse_of");
    expect(relEdge.validFrom).toBe("2020-01-01T00:00:00Z");
    expect(relEdge.source).toBe("entity:ent_a");
    expect(relEdge.target).toBe("entity:ent_b");
  });

  it("clusters into namespace hubs once matching records exceed the threshold, with no namespace filter", () => {
    const records = Array.from({ length: 5 }, (_, i) => makeRecord({ id: `mem_${i}`, namespace: "travel" }));
    const view = buildGraphView(records, [], [], emptyProblems, { clusterThreshold: 3 });
    expect(view.clustered).toBe(true);
    expect(view.matchingRecordCount).toBe(5);
    expect(view.shownRecordCount).toBe(0);
    expect(view.nodes.some((n) => n.kind === "record")).toBe(false);
    const nsNode = view.nodes.find((n) => n.kind === "namespace")!;
    expect(nsNode.count).toBe(5);
  });

  it("explodes to individual records when a namespace filter is set, even above the cluster threshold", () => {
    const records = Array.from({ length: 5 }, (_, i) => makeRecord({ id: `mem_${i}`, namespace: "travel" }));
    const view = buildGraphView(records, [], [], emptyProblems, { clusterThreshold: 3, namespace: "travel" });
    expect(view.clustered).toBe(false);
    expect(view.shownRecordCount).toBe(5);
  });

  it("hard-caps record nodes and reports truncated", () => {
    const records = Array.from({ length: 10 }, (_, i) => makeRecord({ id: `mem_${i}`, namespace: "travel" }));
    const view = buildGraphView(records, [], [], emptyProblems, {
      clusterThreshold: 1000,
      hardCap: 4,
      namespace: "travel",
    });
    expect(view.shownRecordCount).toBe(4);
    expect(view.matchingRecordCount).toBe(10);
    expect(view.truncated).toBe(true);
  });

  it("gives two distinct subjects two distinct subject nodes", () => {
    const forUser = makeRecord({
      id: "mem_user",
      subject: { kind: "literal", entity_id: null, text: "user" },
    });
    const forKid = makeRecord({
      id: "mem_kid",
      subject: { kind: "entity", entity_id: "ent_kid", text: "my daughter" },
    });
    const view = buildGraphView([forUser, forKid], [], [], emptyProblems);
    const subjectNodes = view.nodes.filter((n) => n.kind === "subject");
    expect(subjectNodes).toHaveLength(2);
  });
});
