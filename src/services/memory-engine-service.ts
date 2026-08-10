// services/memory-engine-service.ts — typed client for the Memory Engine
// gateway (chatservice/services/memory/gateway.py via
// api/v1/endpoints/memories.py). This is the ONLY place the Memory OS UI
// talks to the network for memory data (COMPONENT_MODEL.md "data-flow
// rule": every component gets data from a hooks/memory/* hook that calls
// this service — no component fetches directly).
//
// Hard rule (memory-spec / STATE_MODEL): this file NEVER computes
// ranking, authority, temporal validity, or "used vs retrieved" — it only
// shapes the engine's own to_dict() payloads into typed TS. Confidence
// bucketing / status color / source ordering are PRESENTATION concerns
// that live in components (ConfidenceIndicator, StatusBadge, SourceBadge),
// not here.
//
// BUILD endpoints (evidence, usage, entities-list, graph, timeline,
// inbox, debug-retrieve, run-memory — API_MAPPING.md MUI-1007..1016) do
// NOT exist on the backend yet. They are deliberately NOT stubbed here —
// no function, no mock shape — so a later slice can add them against the
// real endpoint without anyone accidentally shipping fake data on a
// production path. See docs/memory-ui/IMPLEMENTATION_PLAN.md UI-1..UI-9.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

// ── enums (mirror services/memory/records.py — string enums, not guessed) ──

export type MemoryType =
  | "semantic"
  | "preference"
  | "episodic"
  | "procedural"
  | "profile"
  | "relationship";

export type MemoryStatus =
  | "active"
  | "superseded"
  | "expired"
  | "disputed"
  | "deleted";

export type SourceType =
  | "user_explicit"
  | "user_observed"
  | "tool_verified"
  | "document_verified"
  | "agent_inference"
  | "episode_consolidation"
  | "system";

export type OwnerType = "user" | "agent" | "project" | "organization";

export type MemoryEventType =
  | "created"
  | "reinforced"
  | "updated"
  | "superseded"
  | "disputed"
  | "expired"
  | "forgotten"
  | "restored";

export type EvidenceType =
  | "message"
  | "document"
  | "tool_result"
  | "run_trace"
  | "human_feedback";

// ── canonical envelope (records.py MemoryRecord.to_dict) ───────────────────

export interface EntityReference {
  kind: "entity" | "literal";
  entity_id: string | null;
  text: string;
}

/** The engine's canonical record, verbatim (MemoryRecord.to_dict shape).
 *  Every field the backend serializes is typed here — UI components read
 *  off this or the derived MemoryCardView, never a partial/guessed shape. */
export interface MemoryRecord {
  id: string;
  tenant_id: string;
  owner_type: OwnerType;
  owner_id: string;
  owner_key?: string;
  namespace: string;
  type: MemoryType;
  subject: EntityReference;
  predicate: string | null;
  value: unknown;
  text: string;
  normalized_text: string;
  status: MemoryStatus;
  authority: number;
  confidence: number;
  importance: number;
  source_type: SourceType;
  valid_from: string | null;
  valid_until: string | null;
  observed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  version: number;
  supersedes: string[];
  superseded_by: string | null;
  entity_ids: string[];
  tags: string[];
  evidence_ids: string[];
  qualifiers: Record<string, string>;
  pinned: boolean;
  exact_tokens: string[];
  idempotency_keys: string[];
  projections_pending: string[];
  dedup_key: string;
  policy: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface MemoryEvent {
  id: string;
  memory_id: string;
  seq: number;
  event: MemoryEventType;
  actor_type: string;
  actor_id: string;
  reason: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: string;
}

export interface MemoryPolicyDecision {
  allowed: boolean;
  reason: string;
  sensitivity_class?: string | null;
  requires_consent?: boolean;
}

export interface WriteResult {
  operation:
    | "created"
    | "reinforced"
    | "superseded"
    | "rejected"
    | "duplicate"
    | "noop";
  memory: MemoryRecord | null;
  decision_reason: string;
  policy: MemoryPolicyDecision | null;
  events: string[];
}

export interface ForgetResult {
  forgotten_count: number;
  tombstone_keys: string[];
  /** UI shows success ONLY when pending.length === 0 (MUI-0023) — never
   *  fabricate "fully forgotten" from this shape. */
  projection_purges: { done: string[]; pending: string[] };
  not_found: boolean;
  truncated: boolean;
}

export interface RetrievedMemoryRow {
  memory: MemoryRecord;
  score: number;
  score_breakdown: Record<string, number>;
  retrieval_reason: string;
  channels: string[];
}

export interface AmbiguousEntity {
  reference: string;
  candidates: string[];
}

export interface SearchResult {
  results: RetrievedMemoryRow[];
  pinned: RetrievedMemoryRow[];
  plan_reason: string;
  cached: boolean;
  ambiguous_entities: AmbiguousEntity[];
}

export interface Entity {
  id: string;
  tenant_id: string;
  owner_key: string;
  canonical_name: string;
  entity_type: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  created_at: string;
}

export interface ResolveEntityResult {
  status: "resolved" | "ambiguous" | "unknown";
  entity: Entity | null;
  candidates: Entity[];
}

// ── §57 frontend data model — a display-shaped VIEW of MemoryRecord ────────
//
// This is a pure renaming/selection transform (label/value/status/type/...),
// never a semantics computation. It does NOT compute confidence buckets,
// authority ranking, or "used" — those stay as the engine's raw values for
// the component layer to bucket/label for display only (STATE_MODEL "what
// the client must not compute").

export interface MemoryCardView {
  id: string;
  label: string;
  value: unknown;
  status: MemoryStatus;
  type: MemoryType;
  namespace: string;
  source: SourceType;
  confidence: number;
  authority: number;
  validFrom?: string | null;
  validUntil?: string | null;
  /** Access/retrieval count off the canonical record. NOT the same thing
   *  as "used" (memory-spec: used ≠ retrieved) — the usage projection that
   *  backs a true used-count lands in UI-6 (MUI-1008/ADR-002). Render this
   *  as "accessed", never as "used". */
  usageCount: number;
  lastUsedAt?: string | null;
  qualifiers?: Record<string, string>;
}

function describeLabel(record: MemoryRecord): string {
  if (record.text) return record.text;
  const subject = record.subject?.text || "";
  const predicate = record.predicate || "";
  const composed = [subject, predicate].filter(Boolean).join(" ");
  return composed || record.namespace;
}

/** Pure shape transform, MemoryRecord -> MemoryCardView (§57). No new
 *  fields are invented beyond a display label composed from existing
 *  fields — see describeLabel. */
export function toMemoryCardView(record: MemoryRecord): MemoryCardView {
  return {
    id: record.id,
    label: describeLabel(record),
    value: record.value,
    status: record.status,
    type: record.type,
    namespace: record.namespace,
    source: record.source_type,
    confidence: record.confidence,
    authority: record.authority,
    validFrom: record.valid_from,
    validUntil: record.valid_until,
    usageCount: record.access_count,
    lastUsedAt: record.last_accessed_at,
    qualifiers: record.qualifiers,
  };
}

// ── HTTP plumbing (auth header from session, typed errors) ─────────────────

export class MemoryEngineError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MemoryEngineError";
    this.status = status;
  }
}

async function memoryFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/memories${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new MemoryEngineError(
      res.status,
      body.detail || `Memory Engine API error: ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── EXISTS endpoints (API_MAPPING.md MUI-1001..1006, 1017..1020) ───────────

export interface CandidateBody {
  namespace: string;
  predicate: string;
  value: unknown;
  text?: string;
  subject?: string;
  qualifiers?: Record<string, string>;
  importance?: number;
}

export interface WriteBody {
  content?: string;
  candidate?: CandidateBody;
  namespace_hint?: string;
  session_id?: string;
  history?: Record<string, unknown>[];
}

/** MUI-1003 — explicit write. Authority/confidence are never client-set
 *  (policy engine decides, §24) — this body cannot request them. */
export async function addMemory(
  body: WriteBody,
): Promise<{ results: WriteResult[] }> {
  return memoryFetch("", { method: "POST", body: JSON.stringify(body) });
}

export interface SearchQuery {
  text?: string;
  namespaces?: string[];
  predicate?: string;
  subject?: string;
  memory_id?: string;
  at?: string;
  include_pinned?: boolean;
  limit?: number;
  // ── UI-1 structured filter set (§5, API_MAPPING MUI-1001 gap) ──────────
  // Candidate-set inclusion/exclusion ONLY, mirrored 1:1 from
  // MemoryQuery/SearchBody (chatservice) — never a new ranking. `used_by`
  // and `used_in_run` are DEFERRED to UI-6 (need the usage projection).
  source_types?: SourceType[];
  statuses?: MemoryStatus[];
  types?: MemoryType[];
  min_confidence?: number;
  min_authority?: number;
  created_after?: string;
  created_before?: string;
  entity_id?: string;
}

/** MUI-1001 — hybrid search/browse. This is the "raw search round-trips
 *  against the real engine" surface UI-0 establishes. */
export async function searchMemories(
  query: SearchQuery,
): Promise<SearchResult> {
  return memoryFetch("/search", {
    method: "POST",
    body: JSON.stringify(query),
  });
}

/** MUI-1001 (namespace list variant) — structured listing, EXISTS today. */
export async function listMemoriesByNamespace(
  namespace: string,
): Promise<{ memories: MemoryRecord[] }> {
  return memoryFetch(`?namespace=${encodeURIComponent(namespace)}`);
}

export interface ListMemoriesQuery {
  namespace?: string;
  status?: MemoryStatus[];
  type?: MemoryType[];
  source_type?: SourceType[];
}

/** MUI-1001 (UI-1 browse-without-query) — structured listing across ALL
 *  namespaces (namespace now optional server-side) with the same
 *  status/type/source candidate filters `searchMemories` accepts. This is
 *  the engine's OWN stable order (no ranking) — used by MemoryBrowser's
 *  "Browse (unranked)" sort mode, never client-resorted. */
export async function listMemories(
  query: ListMemoriesQuery = {},
): Promise<{ memories: MemoryRecord[] }> {
  const params = new URLSearchParams();
  if (query.namespace) params.set("namespace", query.namespace);
  for (const s of query.status ?? []) params.append("status", s);
  for (const t of query.type ?? []) params.append("type", t);
  for (const st of query.source_type ?? []) params.append("source_type", st);
  const qs = params.toString();
  return memoryFetch(qs ? `?${qs}` : "");
}

/** MUI-1002 — get one. Foreign/unknown id 404s (existence not leaked). */
export async function getMemory(memoryId: string): Promise<MemoryRecord> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}`);
}

export interface CorrectBody {
  value?: unknown;
  text?: string;
  session_id?: string;
}

/** MUI-1004 — correct. Creates lifecycle events server-side; never a
 *  silent rewrite. 409 on stale id/version conflict (MemoryEngineError). */
export async function correctMemory(
  memoryId: string,
  body: CorrectBody,
): Promise<WriteResult> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}/correct`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** MUI-1017 — reinforce (repeat observation strengthens authority). */
export async function reinforceMemory(memoryId: string): Promise<WriteResult> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}/reinforce`, {
    method: "POST",
  });
}

export interface ForgetBody {
  memory_id?: string;
  namespace?: string;
  subject?: string;
  predicate?: string;
  qualifiers?: Record<string, string>;
}

/** MUI-1005 — filter-shaped forget (single fact or a whole namespace).
 *  Caller MUST wait for projection_purges.pending === [] before showing
 *  success (MUI-0023) — this function only returns the backend's own
 *  authoritative result, it never infers completion. */
export async function forgetByFilter(body: ForgetBody): Promise<ForgetResult> {
  return memoryFetch("/forget", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** MUI-1020 — forget a single memory by id (DELETE). Same completeness
 *  rule as forgetByFilter applies to the caller. */
export async function forgetMemory(memoryId: string): Promise<ForgetResult> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}`, {
    method: "DELETE",
  });
}

/** Q8 (RESOLVED)/UI-2 — broad-forget dry-run preview. The response shape
 *  is DELIBERATELY different from ForgetResult (no `projection_purges`
 *  key) so a caller can never mistake a preview for a completed forget —
 *  the backend enforces this at the route (memories.py forget_by_filter).
 *  Mutates NOTHING; safe to call before the user confirms. */
export interface ForgetDryRunResult {
  affected_count: number;
  tombstone_keys_preview: string[];
}

export async function forgetDryRun(
  body: ForgetBody,
): Promise<ForgetDryRunResult> {
  return memoryFetch("/forget", {
    method: "POST",
    body: JSON.stringify({ ...body, dry_run: true }),
  });
}

/** MUI-1006 — lifecycle history, newest-first is a UI concern (the
 *  backend returns (memory_id, seq) order; callers sort for display). */
export async function getMemoryHistory(
  memoryId: string,
): Promise<{ events: MemoryEvent[] }> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}/history`);
}

/** MUI-1007 — evidence behind a memory (§15). Excerpts are UNTRUSTED data
 *  (render inert). A `withheld` row means the server redacted a sensitive
 *  excerpt (UI-35) — the UI shows "protected", never the content. */
export interface EvidenceRow {
  id: string;
  type: string;
  source_id: string;
  excerpt: string;
  withheld: boolean;
  observed_at: string | null;
}

export interface MemoryOverview {
  active_count: number;
  inferred_count: number;
  shadow_count: number;
  superseded_count: number;
  disputed_count: number;
  new_this_week: number;
  by_status: Record<string, number>;
  by_namespace: Record<string, number>;
  recent_changes: Array<{
    id: string;
    predicate: string | null;
    value: unknown;
    namespace: string;
    status: MemoryStatus;
    source_type: SourceType;
    updated_at: string | null;
  }>;
}

/** MUI-1008-adjacent — Overview aggregates (UI-4). Real counts over the
 *  caller's own memory; the backend does the aggregation (no client compute).
 *  'used' is intentionally absent until the UI-6 usage projection. */
export async function getOverview(): Promise<MemoryOverview> {
  return memoryFetch("/overview");
}

export interface TimelineSpan {
  id: string;
  value: unknown;
  text: string;
  status: MemoryStatus;
  source_type: SourceType;
  valid_from: string | null;
  valid_until: string | null;
}

/** MUI-1011 — temporal value-history of one fact slot (UI-5). Spans with
 *  their validity windows, oldest→newest, from the engine's supersession
 *  lineage. The client renders them; it never computes validity. */
export async function getTimeline(
  namespace: string,
  predicate: string,
  subject = "user",
): Promise<{ spans: TimelineSpan[] }> {
  const qs = new URLSearchParams({ namespace, predicate, subject });
  return memoryFetch(`/timeline?${qs.toString()}`);
}

export async function getEvidenceForMemory(
  memoryId: string,
): Promise<{ evidence: EvidenceRow[] }> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}/evidence`);
}

// ── UI-6: usage projection (used vs retrieved) ─────────────────────────────
// The engine records what a retrieved memory ACTUALLY did in a run — 'used'
// means it drove a slot/tool/plan; 'retrieved' means it surfaced but changed
// nothing. This distinction is real trace data (ADR-002); the UI renders it
// and NEVER infers "used" from a retrieval.

export interface UsageEvent {
  memory_id: string;
  run_id: string;
  outcome: "used" | "retrieved";
  stage: string;
  slot: string | null;
  value: unknown;
  ts: string;
}

/** MUI-6 — where a memory was retrieved/used (Inspector Usage tab). Newest
 *  first. A foreign id 404s (MemoryEngineError). */
export async function getUsageForMemory(
  memoryId: string,
): Promise<{ usage: UsageEvent[] }> {
  return memoryFetch(`/${encodeURIComponent(memoryId)}/usage`);
}

export interface RunMemoryRow extends UsageEvent {
  predicate: string | null;
  current_value: unknown;
  status: string;
}

export interface RunMemory {
  run_id: string;
  used: RunMemoryRow[];
  retrieved: RunMemoryRow[];
}

/** MUI-6 — memory used vs retrieved in a single run (Run Memory view). Each
 *  row carries the memory's CURRENT label/value from the canonical store, so
 *  a since-changed memory reads honestly. Arrows are drawn from THIS data. */
export async function getRunMemory(runId: string): Promise<RunMemory> {
  return memoryFetch(`/run/${encodeURIComponent(runId)}/memory`);
}

/** MUI-1018 — alias/reference -> entity resolution. AMBIGUOUS is data,
 *  never a guess: render res.candidates, do not pick [0] for the caller. */
export async function resolveEntity(
  reference: string,
): Promise<ResolveEntityResult> {
  return memoryFetch("/entities/resolve", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

// ── UI-7: entities + graph neighborhood (API_MAPPING.md MUI-1009/1010) ─────

/** MUI-1009 — entities in the caller's own universe (graph seed + entity
 *  filter autocomplete + alias->canonical picker, UI-15). */
export async function listEntities(
  params: { q?: string; type?: string } = {},
): Promise<{ entities: Entity[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.type) qs.set("type", params.type);
  const s = qs.toString();
  return memoryFetch(`/entities${s ? `?${s}` : ""}`);
}

export interface GraphNode {
  entity_id: string;
  label: string;
  type: string;
  aliases: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  valid_from: string | null;
  valid_until: string | null;
  confidence: number;
  status: string;
  evidence_id: string | null;
}

/** MUI-1010 — the response shape of GET /memories/graph (1-hop bounded,
 *  resolver-based, temporal neighborhood). `status` mirrors
 *  ResolveEntityResult ("resolved" | "ambiguous" | "unknown") — an
 *  ambiguous alias comes back as `candidates`, never a guess (T29); an
 *  unknown/foreign reference is identical to a made-up one (no existence
 *  leak). `truncated` means a defensive server-side cap trimmed a very
 *  high-degree entity's edges — still an honest 1-hop view, just not
 *  exhaustive. Nothing here is client-computed: nodes/edges/validity all
 *  come straight from the engine. */
export interface GraphNeighborhood {
  status: "resolved" | "ambiguous" | "unknown";
  center: Entity | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  candidates: Entity[];
}

export interface GraphQuery {
  /** an entity id (exact re-center) OR an alias/free-text reference
   *  (resolved server-side, same resolver as resolveEntity — T14). */
  entity: string;
  /** ISO timestamp — the temporal slider's point-in-time (UI-16/TEMP-03).
   *  Omit for "now" (no temporal filtering). */
  at?: string;
  /** narrow the 1-hop edges to these relation types — a plain inclusion
   *  filter passed straight to the backend, never a client re-filter of
   *  an already-fetched edge set. */
  relationTypes?: string[];
}

/** MUI-1010 — 1-hop bounded, resolver-based, temporal entity neighborhood
 *  (UI-7 Graph). This NEVER returns more than one hop out of `entity`, and
 *  never the full tenant graph — "expand" in the UI means calling this
 *  again re-centered on the clicked node. */
export async function getGraphNeighborhood(query: GraphQuery): Promise<GraphNeighborhood> {
  const qs = new URLSearchParams({ entity: query.entity });
  if (query.at) qs.set("at", query.at);
  for (const rt of query.relationTypes ?? []) qs.append("relation", rt);
  return memoryFetch(`/graph?${qs.toString()}`);
}

// ── BUILD endpoints (API_MAPPING.md MUI-1012..1016) — NOT IMPLEMENTED ──────
//
// Deliberately absent. Do not add a function here that calls an endpoint
// that doesn't exist yet, and do not fake a response shape "for now" — a
// missing capability must fail loudly (a TypeScript compile error on an
// unresolved import) rather than silently return mock data. Each lands in
// its own slice:
//   getInbox / approve/reject -> UI-8 (GET/POST /memory/inbox/*)
//   debugRetrieve          -> UI-9  (POST /memory/debug/retrieve)
