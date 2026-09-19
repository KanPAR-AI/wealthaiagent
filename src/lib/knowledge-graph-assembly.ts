// lib/knowledge-graph-assembly.ts — pure assembly logic for the Full
// Knowledge Graph debug page (owner request 2026-09-19: "Add a page on web
// to check and debug the complete knowledge graph").
//
// Everything here is PURE (no React, no fetch) so it can be unit-tested in
// isolation and mutation-run per test-traceability. It never invents a
// memory-engine truth (no ranking, no validity computation, no authority) —
// it only reshapes records/entities/relations the engine already returned
// into a renderable graph, and flags a small set of clearly-labelled
// heuristic "problems" (duplicates/orphans/suspicious values) for a human
// to look at. A heuristic flag is never treated as a mutation trigger.
import type {
  Entity,
  GraphEdge,
  MemoryRecord,
  MemoryStatus,
} from "@/services/memory-engine-service";

// ── dedupe relations across N per-entity neighborhood calls ────────────────

/** Assemble the complete relation set from calling GET /memories/graph once
 *  per entity (bounded per-entity 1-hop calls — there is no list-all-
 *  relations endpoint, API_MAPPING gap). Dedupes by relation id since the
 *  same edge is returned from BOTH of its endpoints' neighborhoods. */
export function dedupeRelations(edgeLists: GraphEdge[][]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();
  for (const edges of edgeLists) {
    for (const edge of edges) {
      if (!byId.has(edge.id)) byId.set(edge.id, edge);
    }
  }
  return Array.from(byId.values());
}

// ── problem detectors (heuristic, clearly labelled) ────────────────────────

export interface DuplicateGroup {
  namespace: string;
  predicate: string;
  /** the subject key duplicates were grouped on top of namespace+predicate
   *  (a same-namespace/same-predicate pair for TWO DIFFERENT subjects is
   *  not the "should have superseded each other" bug the owner described —
   *  only a duplicate active fact for the SAME subject is). */
  subjectKey: string;
  recordIds: string[];
}

function subjectKey(record: MemoryRecord): string {
  if (record.subject?.kind === "entity" && record.subject.entity_id) {
    return `entity:${record.subject.entity_id}`;
  }
  return `literal:${(record.subject?.text ?? "").trim().toLowerCase()}`;
}

/** "Same namespace + predicate active more than once — these should have
 *  superseded each other and did not" (owner's own words). Grouped by
 *  namespace + predicate + subject so two different people's identical
 *  predicate (e.g. two kids both having a "diet.preference") is never
 *  misflagged as a bug. */
export function findActiveDuplicates(records: MemoryRecord[]): DuplicateGroup[] {
  const groups = new Map<string, MemoryRecord[]>();
  for (const record of records) {
    if (record.status !== "active" || !record.predicate) continue;
    const key = `${record.namespace}::${record.predicate}::${subjectKey(record)}`;
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }
  const out: DuplicateGroup[] = [];
  for (const [key, recs] of groups) {
    if (recs.length < 2) continue;
    const [namespace, predicate, subject] = key.split("::");
    out.push({ namespace, predicate, subjectKey: subject, recordIds: recs.map((r) => r.id) });
  }
  return out;
}

export interface OrphanRef {
  recordId: string;
  /** which field on `recordId` points at a non-resolving id. */
  field: "supersedes" | "superseded_by";
  missingId: string;
}

/** A `supersedes`/`superseded_by` id that does not resolve within the
 *  fetched record set. NOTE (honest limitation): this page fetches
 *  active/superseded/expired/disputed only, never `deleted` — a reference
 *  to a since-forgotten (tombstoned) record is indistinguishable here from
 *  a genuinely broken link. The UI must label this caveat, not hide it. */
export function findOrphans(records: MemoryRecord[]): OrphanRef[] {
  const ids = new Set(records.map((r) => r.id));
  const out: OrphanRef[] = [];
  for (const record of records) {
    for (const supersededId of record.supersedes ?? []) {
      if (!ids.has(supersededId)) {
        out.push({ recordId: record.id, field: "supersedes", missingId: supersededId });
      }
    }
    if (record.superseded_by && !ids.has(record.superseded_by)) {
      out.push({ recordId: record.id, field: "superseded_by", missingId: record.superseded_by });
    }
  }
  return out;
}

export interface SuspiciousFlag {
  recordId: string;
  reasons: string[];
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** True for a calendar-impossible date, e.g. "31 February" / "2024-02-30".
 *  Deliberately generous on leap years (allows Feb 29 in any year) — this
 *  is a small heuristic, not a calendar library. */
function isImpossibleIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return true;
  const max = DAYS_IN_MONTH[month - 1];
  return day < 1 || day > max;
}

const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Catches free-text forms like "31 February 2024" or "February 31, 2024"
 *  that never reach `Date.parse`'s ISO fast path. */
function isImpossibleFreeTextDate(text: string): boolean {
  const dMonthY = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\b`, "i").exec(text);
  const monthDY = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})\\b`, "i").exec(text);
  const match = dMonthY
    ? { day: Number(dMonthY[1]), month: dMonthY[2] }
    : monthDY
      ? { day: Number(monthDY[2]), month: monthDY[1] }
      : null;
  if (!match) return false;
  const monthKey = match.month.slice(0, 3).toLowerCase();
  const monthNum = MONTH_INDEX[monthKey];
  if (!monthNum) return false;
  const max = DAYS_IN_MONTH[monthNum - 1];
  return match.day < 1 || match.day > max;
}

const SYNTHETIC_VALUE_PATTERN =
  /^(test|foo|bar|asdf+|qwerty+|lorem ipsum.*|x{3,}|todo|placeholder|n\/a|null|undefined|string|sample|dummy)$/i;

function stringifyForHeuristic(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Flags, don't hides. Deliberately small: impossible calendar dates in the
 *  record's own date fields, and an obviously-synthetic `text`/`value`
 *  string. Both are clearly heuristic — a false positive should read as
 *  "worth a human glance", never as a claim the record is wrong. */
export function findSuspiciousValues(records: MemoryRecord[]): SuspiciousFlag[] {
  const out: SuspiciousFlag[] = [];
  for (const record of records) {
    const reasons: string[] = [];

    const dateFields: [string, string | null][] = [
      ["valid_from", record.valid_from],
      ["valid_until", record.valid_until],
      ["observed_at", record.observed_at],
      ["created_at", record.created_at],
    ];
    for (const [fieldName, iso] of dateFields) {
      if (!iso) continue;
      if (isImpossibleIsoDate(iso) || isImpossibleFreeTextDate(iso)) {
        reasons.push(`${fieldName} is a calendar-impossible date ("${iso}")`);
      }
    }

    const textCandidates: [string, string | null][] = [
      ["text", record.text || null],
      ["value", stringifyForHeuristic(record.value)],
    ];
    for (const [fieldName, str] of textCandidates) {
      if (!str) continue;
      const trimmed = str.trim();
      if (SYNTHETIC_VALUE_PATTERN.test(trimmed)) {
        reasons.push(`${fieldName} looks like a synthetic placeholder ("${trimmed}")`);
      }
      if (isImpossibleFreeTextDate(trimmed)) {
        reasons.push(`${fieldName} contains a calendar-impossible date ("${trimmed}")`);
      }
    }

    if (reasons.length > 0) out.push({ recordId: record.id, reasons });
  }
  return out;
}

// ── supersede chains ────────────────────────────────────────────────────────

export interface SupersedeChain {
  /** the oldest record's id — stable identity for the chain. */
  chainId: string;
  /** oldest -> newest. */
  memberIds: string[];
}

/** Walks BOTH `supersedes` (this record replaced these) and
 *  `superseded_by` (this record was later replaced by this one) — the
 *  engine writes both directions, so this is a redundant cross-check, not
 *  two different sources of truth. Cycle-guarded (defensive only; a real
 *  cycle would itself be an engine bug, not something this page should
 *  hang on). Singleton records (no supersession at all) are not a chain. */
export function buildSupersedeChains(records: MemoryRecord[]): SupersedeChain[] {
  const ids = new Set(records.map((r) => r.id));
  const next = new Map<string, string>(); // older id -> newer id

  for (const record of records) {
    if (record.superseded_by && ids.has(record.superseded_by)) {
      next.set(record.id, record.superseded_by);
    }
    for (const olderId of record.supersedes ?? []) {
      if (ids.has(olderId)) next.set(olderId, record.id);
    }
  }

  const targets = new Set(next.values());
  const roots = Array.from(next.keys()).filter((id) => !targets.has(id));
  // deterministic order regardless of Map iteration
  roots.sort();

  const chains: SupersedeChain[] = [];
  const visited = new Set<string>();
  for (const root of roots) {
    if (visited.has(root)) continue;
    const members = [root];
    const seenInChain = new Set([root]);
    visited.add(root);
    let cursor = root;
    while (next.has(cursor)) {
      const nextId = next.get(cursor)!;
      if (seenInChain.has(nextId)) break; // cycle guard
      members.push(nextId);
      seenInChain.add(nextId);
      visited.add(nextId);
      cursor = nextId;
    }
    if (members.length > 1) chains.push({ chainId: root, memberIds: members });
  }
  return chains;
}

// ── health strip ─────────────────────────────────────────────────────────

export interface KgHealth {
  recordCount: number;
  byStatus: Partial<Record<MemoryStatus, number>>;
  entityCount: number;
  relationCount: number;
  recordsWithEntityLinks: number;
  recordsWithValidUntil: number;
  activeDuplicateGroupCount: number;
  activeDuplicateRecordCount: number;
  orphanCount: number;
  suspiciousCount: number;
}

export function computeHealth(
  records: MemoryRecord[],
  entities: Entity[],
  relations: GraphEdge[],
  duplicates: DuplicateGroup[],
  orphans: OrphanRef[],
  suspicious: SuspiciousFlag[],
): KgHealth {
  const byStatus: Partial<Record<MemoryStatus, number>> = {};
  let withEntityLinks = 0;
  let withValidUntil = 0;
  for (const record of records) {
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    if ((record.entity_ids ?? []).length > 0) withEntityLinks++;
    if (record.valid_until) withValidUntil++;
  }
  return {
    recordCount: records.length,
    byStatus,
    entityCount: entities.length,
    relationCount: relations.length,
    recordsWithEntityLinks: withEntityLinks,
    recordsWithValidUntil: withValidUntil,
    activeDuplicateGroupCount: duplicates.length,
    activeDuplicateRecordCount: new Set(duplicates.flatMap((d) => d.recordIds)).size,
    orphanCount: new Set(orphans.map((o) => o.recordId)).size,
    suspiciousCount: suspicious.length,
  };
}

// ── graph-view assembly (layout input) ─────────────────────────────────────

export type KgNodeKind = "subject" | "namespace" | "record" | "entity";
export type KgEdgeKind =
  | "subject-namespace"
  | "namespace-record"
  | "record-entity"
  | "entity-relation"
  | "supersede";

export interface KgNode {
  id: string;
  kind: KgNodeKind;
  label: string;
  status?: MemoryStatus;
  recordId?: string;
  entityId?: string;
  namespace?: string;
  /** how many records this node stands in for when clustered=true. */
  count?: number;
  problem?: boolean;
}

export interface KgEdge {
  id: string;
  source: string;
  target: string;
  kind: KgEdgeKind;
  status?: MemoryStatus;
  relationType?: string;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface ProblemSets {
  duplicateRecordIds: Set<string>;
  orphanRecordIds: Set<string>;
  suspiciousRecordIds: Set<string>;
}

export function buildProblemSets(
  duplicates: DuplicateGroup[],
  orphans: OrphanRef[],
  suspicious: SuspiciousFlag[],
): ProblemSets {
  return {
    duplicateRecordIds: new Set(duplicates.flatMap((d) => d.recordIds)),
    orphanRecordIds: new Set(orphans.map((o) => o.recordId)),
    suspiciousRecordIds: new Set(suspicious.map((s) => s.recordId)),
  };
}

export interface GraphViewFilters {
  namespace?: string;
  statuses?: MemoryStatus[];
  predicateQuery?: string;
  onlyProblems?: boolean;
}

export interface GraphViewOptions extends GraphViewFilters {
  /** above this many matching records (with no namespace filter set), the
   *  view clusters to namespace hubs instead of one node per record — a
   *  ~70-node neighborhood stays exploded; several hundred degrades to
   *  clusters rather than a hairball. */
  clusterThreshold?: number;
  /** absolute hard cap on record nodes even when exploded (namespace
   *  picked) — protects the canvas from a single huge namespace. */
  hardCap?: number;
}

export interface GraphViewResult {
  nodes: KgNode[];
  edges: KgEdge[];
  clustered: boolean;
  /** records matching the filters, before any cluster/cap trimming. */
  matchingRecordCount: number;
  /** record nodes actually rendered. */
  shownRecordCount: number;
  truncated: boolean;
}

const DEFAULT_CLUSTER_THRESHOLD = 70;
const DEFAULT_HARD_CAP = 300;

export function recordMatchesFilters(
  record: MemoryRecord,
  filters: GraphViewFilters,
  problems: ProblemSets,
): boolean {
  if (filters.namespace && record.namespace !== filters.namespace) return false;
  if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(record.status)) {
    return false;
  }
  if (filters.predicateQuery) {
    const q = filters.predicateQuery.trim().toLowerCase();
    if (q && !(record.predicate ?? "").toLowerCase().includes(q)) return false;
  }
  if (filters.onlyProblems) {
    const isProblem =
      problems.duplicateRecordIds.has(record.id) ||
      problems.orphanRecordIds.has(record.id) ||
      problems.suspiciousRecordIds.has(record.id);
    if (!isProblem) return false;
  }
  return true;
}

function statusEdgeStyle(status: MemoryStatus): MemoryStatus {
  return status;
}

/** The same namespace/status/predicate/onlyProblems filter, exposed for the
 *  raw table tab — the graph and the table apply IDENTICAL filtering (the
 *  page spec requires "same filters" for both surfaces). */
export function filterRecordsForView(
  records: MemoryRecord[],
  filters: GraphViewFilters,
  problems: ProblemSets,
): MemoryRecord[] {
  return records.filter((r) => recordMatchesFilters(r, filters, problems));
}

/** Builds the node/edge set the canvas (and the layout function) render.
 *  Pure reshaping of already-fetched records/entities/relations — never
 *  computes which records exist or what an edge means, only how to lay
 *  them out and whether to cluster for scale. */
export function buildGraphView(
  records: MemoryRecord[],
  entities: Entity[],
  relations: GraphEdge[],
  problems: ProblemSets,
  options: GraphViewOptions = {},
): GraphViewResult {
  const clusterThreshold = options.clusterThreshold ?? DEFAULT_CLUSTER_THRESHOLD;
  const hardCap = options.hardCap ?? DEFAULT_HARD_CAP;

  const matching = filterRecordsForView(records, options, problems);
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const nodeIds = new Set<string>();

  function addNode(node: KgNode) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  // subject hubs — group matching records by subject so a multi-person
  // memory (e.g. family members) shows more than one center, but a
  // single-subject memory (the common case) reads as one hub.
  const subjectOf = new Map<string, string>(); // recordId -> subjectNodeId
  for (const record of matching) {
    const key = subjectKey(record);
    const subjectId = `subject:${key}`;
    subjectOf.set(record.id, subjectId);
    if (!nodeIds.has(subjectId)) {
      addNode({ id: subjectId, kind: "subject", label: record.subject?.text || key });
    }
  }

  const shouldCluster = !options.namespace && matching.length > clusterThreshold;

  if (shouldCluster) {
    const countsByNsSubject = new Map<string, { namespace: string; subjectId: string; count: number }>();
    for (const record of matching) {
      const subjectId = subjectOf.get(record.id)!;
      const key = `${subjectId}::${record.namespace}`;
      const entry = countsByNsSubject.get(key);
      if (entry) entry.count++;
      else countsByNsSubject.set(key, { namespace: record.namespace, subjectId, count: 1 });
    }
    for (const [key, entry] of countsByNsSubject) {
      const nsNodeId = `ns:${key}`;
      addNode({
        id: nsNodeId,
        kind: "namespace",
        label: entry.namespace,
        namespace: entry.namespace,
        count: entry.count,
      });
      edges.push({
        id: `e:subject-ns:${key}`,
        source: entry.subjectId,
        target: nsNodeId,
        kind: "subject-namespace",
      });
    }
    // Entities + entity-relation edges still render clustered (usually far
    // fewer than records) so a debugger can still see the entity graph.
    for (const entity of entities) {
      addNode({ id: `entity:${entity.id}`, kind: "entity", label: entity.canonical_name, entityId: entity.id });
    }
    for (const relation of relations) {
      if (!entityById.has(relation.source) || !entityById.has(relation.target)) continue;
      edges.push({
        id: `relation:${relation.id}`,
        source: `entity:${relation.source}`,
        target: `entity:${relation.target}`,
        kind: "entity-relation",
        status: relation.status as MemoryStatus,
        relationType: relation.relation_type,
        validFrom: relation.valid_from,
        validUntil: relation.valid_until,
      });
    }
    return {
      nodes,
      edges,
      clustered: true,
      matchingRecordCount: matching.length,
      shownRecordCount: 0,
      truncated: false,
    };
  }

  const capped = matching.slice(0, hardCap);
  const shownIds = new Set(capped.map((r) => r.id));
  const subjectNsEdgesAdded = new Set<string>();

  for (const record of capped) {
    const subjectId = subjectOf.get(record.id)!;
    const nsNodeId = `ns:${record.namespace}`;
    addNode({ id: nsNodeId, kind: "namespace", label: record.namespace, namespace: record.namespace });
    const subjectNsKey = `${subjectId}::${nsNodeId}`;
    if (!subjectNsEdgesAdded.has(subjectNsKey)) {
      subjectNsEdgesAdded.add(subjectNsKey);
      edges.push({
        id: `e:subject-ns:${subjectNsKey}`,
        source: subjectId,
        target: nsNodeId,
        kind: "subject-namespace",
      });
    }

    const recordNodeId = `record:${record.id}`;
    addNode({
      id: recordNodeId,
      kind: "record",
      label: record.predicate || record.text || record.namespace,
      status: record.status,
      recordId: record.id,
      namespace: record.namespace,
      problem:
        problems.duplicateRecordIds.has(record.id) ||
        problems.orphanRecordIds.has(record.id) ||
        problems.suspiciousRecordIds.has(record.id),
    });
    edges.push({
      id: `e:ns-record:${record.id}`,
      source: nsNodeId,
      target: recordNodeId,
      kind: "namespace-record",
      status: statusEdgeStyle(record.status),
    });

    for (const entityId of record.entity_ids ?? []) {
      const entity = entityById.get(entityId);
      const entityNodeId = `entity:${entityId}`;
      addNode({ id: entityNodeId, kind: "entity", label: entity?.canonical_name ?? entityId, entityId });
      edges.push({
        id: `e:record-entity:${record.id}:${entityId}`,
        source: recordNodeId,
        target: entityNodeId,
        kind: "record-entity",
      });
    }

    for (const supersededId of record.supersedes ?? []) {
      if (!shownIds.has(supersededId)) continue;
      edges.push({
        id: `e:supersede:${supersededId}:${record.id}`,
        source: `record:${supersededId}`,
        target: recordNodeId,
        kind: "supersede",
      });
    }
  }

  // entity nodes that appear only via entity-relation (no record links them
  // in this filtered view) still get a node so relations aren't dangling.
  for (const relation of relations) {
    for (const endpointId of [relation.source, relation.target]) {
      const entity = entityById.get(endpointId);
      if (!entity) continue;
      addNode({ id: `entity:${endpointId}`, kind: "entity", label: entity.canonical_name, entityId: endpointId });
    }
  }
  for (const relation of relations) {
    if (!nodeIds.has(`entity:${relation.source}`) || !nodeIds.has(`entity:${relation.target}`)) continue;
    edges.push({
      id: `relation:${relation.id}`,
      source: `entity:${relation.source}`,
      target: `entity:${relation.target}`,
      kind: "entity-relation",
      status: relation.status as MemoryStatus,
      relationType: relation.relation_type,
      validFrom: relation.valid_from,
      validUntil: relation.valid_until,
    });
  }

  return {
    nodes,
    edges,
    clustered: false,
    matchingRecordCount: matching.length,
    shownRecordCount: capped.length,
    truncated: matching.length > capped.length,
  };
}

export { subjectKey as _subjectKeyForTest };
