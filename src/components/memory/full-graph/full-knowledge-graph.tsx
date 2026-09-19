// components/memory/full-graph/full-knowledge-graph.tsx — FullKnowledgeGraph
// (owner request 2026-09-19: "Add a page on web to check and debug the
// complete knowledge graph"). Orchestrates ONE fetch (useFullGraph: every
// record + every entity + the complete per-entity relation set) around the
// health strip, filters, Graph/Table views, and the node inspector. All
// graph-shaping logic (dedupe/duplicates/orphans/suspicious/chains/layout
// input) lives in the PURE lib/knowledge-graph-assembly.ts — this component
// only wires it to fetched data and the URL.
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Network } from "lucide-react";
import { useFullGraph } from "@/hooks/memory/use-full-graph";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { ErrorState } from "@/components/memory/error-state";
import { EmptyState } from "@/components/memory/empty-state";
import { KgHealthStrip } from "@/components/memory/full-graph/kg-health-strip";
import { KgFilters } from "@/components/memory/full-graph/kg-filters";
import { KgCanvas } from "@/components/memory/full-graph/kg-canvas";
import { KgTable } from "@/components/memory/full-graph/kg-table";
import { KgInspector } from "@/components/memory/full-graph/kg-inspector";
import {
  parseFullGraphFiltersFromParams,
  serializeFullGraphFilters,
  type FullGraphFiltersState,
} from "@/lib/full-graph-filters-url";
import {
  buildGraphView,
  buildProblemSets,
  buildSupersedeChains,
  computeHealth,
  filterRecordsForView,
  findActiveDuplicates,
  findOrphans,
  findSuspiciousValues,
  type KgNode,
} from "@/lib/knowledge-graph-assembly";
import type { Entity, MemoryRecord } from "@/services/memory-engine-service";

export function FullKnowledgeGraph() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFullGraphFiltersFromParams(params), [params]);

  function patchFilters(patch: Partial<FullGraphFiltersState>) {
    setParams(serializeFullGraphFilters({ ...filters, ...patch }), { replace: true });
  }

  const { status, data, error, refetch } = useFullGraph();

  const records = useMemo(() => data?.records ?? [], [data]);
  const entities = useMemo(() => data?.entities ?? [], [data]);
  const relations = useMemo(() => data?.relations ?? [], [data]);

  const recordsById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const entitiesById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const duplicates = useMemo(() => findActiveDuplicates(records), [records]);
  const orphans = useMemo(() => findOrphans(records), [records]);
  const suspicious = useMemo(() => findSuspiciousValues(records), [records]);
  const chains = useMemo(() => buildSupersedeChains(records), [records]);
  const problems = useMemo(() => buildProblemSets(duplicates, orphans, suspicious), [duplicates, orphans, suspicious]);
  const health = useMemo(
    () => computeHealth(records, entities, relations, duplicates, orphans, suspicious),
    [records, entities, relations, duplicates, orphans, suspicious],
  );

  const filterInput = {
    namespace: filters.namespace || undefined,
    statuses: filters.statuses.length ? filters.statuses : undefined,
    predicateQuery: filters.predicateQuery || undefined,
    onlyProblems: filters.onlyProblems,
  };

  const tableRows = useMemo(
    () => filterRecordsForView(records, filterInput, problems),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, problems, filters.namespace, filters.statuses, filters.predicateQuery, filters.onlyProblems],
  );

  const graphView = useMemo(
    () => buildGraphView(records, entities, relations, problems, filterInput),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, entities, relations, problems, filters.namespace, filters.statuses, filters.predicateQuery, filters.onlyProblems],
  );

  const namespaceOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.namespace))).sort(),
    [records],
  );

  const chainByRecordId = useMemo(() => {
    const map = new Map<string, (typeof chains)[number]>();
    for (const chain of chains) for (const id of chain.memberIds) map.set(id, chain);
    return map;
  }, [chains]);

  const selectedNode = resolveSelectedNode(filters.selected, graphView.nodes, recordsById, entitiesById);
  const selectedRecord =
    selectedNode?.kind === "record" && selectedNode.recordId ? (recordsById.get(selectedNode.recordId) ?? null) : null;
  const selectedChain = selectedRecord ? (chainByRecordId.get(selectedRecord.id) ?? null) : null;
  const chainRecords = selectedChain
    ? (selectedChain.memberIds.map((id) => recordsById.get(id)).filter(Boolean) as MemoryRecord[])
    : [];
  const linkedEntities = selectedRecord
    ? (selectedRecord.entity_ids.map((id) => entitiesById.get(id)).filter(Boolean) as Entity[])
    : [];
  const selectedEntity =
    selectedNode?.kind === "entity" && selectedNode.entityId ? (entitiesById.get(selectedNode.entityId) ?? null) : null;
  const namespaceCount =
    selectedNode?.kind === "namespace" && selectedNode.namespace
      ? tableRows.filter((r) => r.namespace === selectedNode.namespace).length
      : null;

  function selectNodeId(id: string | null) {
    patchFilters({ selected: id ?? "" });
  }

  if (status === "loading") {
    return (
      <div className="space-y-4 p-4">
        <LoadingSkeleton rows={2} />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4 p-4">
        <ErrorState
          message={`Could not load the knowledge graph — the ${error?.call ?? "data"} call failed: ${error?.message ?? "unknown error"}`}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <EmptyState icon={Network} title="No records" description="This memory has no records yet — nothing to graph." />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" data-testid="full-knowledge-graph">
      <KgHealthStrip health={health} />

      {entities.length === 0 && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground" data-testid="kg-no-entities-notice">
          0 entities — the entity store is empty, so there is nothing to link; records are shown around their subject.
        </div>
      )}

      {data && data.failedEntityIds.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" data-testid="kg-partial-relations-notice">
          {data.failedEntityIds.length} of {entities.length} entity relationship lookups failed — the graph below may be
          missing some relations.
        </div>
      )}

      <KgFilters filters={filters} namespaceOptions={namespaceOptions} onChange={patchFilters} />

      <div role="tablist" aria-label="Knowledge graph view" className="flex gap-1 border-b border-border/60">
        {(["graph", "table"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={filters.tab === t}
            onClick={() => patchFilters({ tab: t })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              filters.tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {graphView.clustered && (
        <p className="text-xs text-muted-foreground" data-testid="kg-clustered-notice">
          {graphView.matchingRecordCount} records match — showing namespace clusters instead of a hairball. Pick a
          namespace filter above to see its individual records.
        </p>
      )}
      {!graphView.clustered && graphView.truncated && (
        <p className="text-xs text-muted-foreground" data-testid="kg-truncated-notice">
          Showing the first {graphView.shownRecordCount} of {graphView.matchingRecordCount} matching records.
        </p>
      )}

      {filters.tab === "graph" ? (
        <KgCanvas
          nodes={graphView.nodes}
          edges={graphView.edges}
          selectedId={selectedNode?.id ?? null}
          onSelectNode={(node) => selectNodeId(node.id)}
        />
      ) : (
        <KgTable
          records={tableRows}
          problems={problems}
          selectedId={selectedRecord?.id ?? null}
          onSelectRecord={(record) => selectNodeId(`record:${record.id}`)}
        />
      )}

      <KgInspector
        node={selectedNode}
        record={selectedRecord}
        chain={selectedChain}
        chainRecords={chainRecords}
        linkedEntities={linkedEntities}
        entity={selectedEntity}
        namespaceCount={namespaceCount}
        onClose={() => selectNodeId(null)}
        onFilterNamespace={(ns) => patchFilters({ namespace: ns, selected: "" })}
      />
    </div>
  );
}

/** Resolve the URL-persisted `selected` node id back to a KgNode. Prefers
 *  the node as it exists in the CURRENT graph view (so status/label match
 *  what's on screen); falls back to reconstructing a minimal node straight
 *  from the record/entity when the current view has clustered it away
 *  (e.g. selected via the Table tab while the Graph tab is clustered) —
 *  the inspector must still work even when the node isn't drawn. */
function resolveSelectedNode(
  selectedId: string,
  graphNodes: KgNode[],
  recordsById: Map<string, MemoryRecord>,
  entitiesById: Map<string, Entity>,
): KgNode | null {
  if (!selectedId) return null;
  const inView = graphNodes.find((n) => n.id === selectedId);
  if (inView) return inView;

  if (selectedId.startsWith("record:")) {
    const id = selectedId.slice("record:".length);
    const record = recordsById.get(id);
    if (!record) return null;
    return {
      id: selectedId,
      kind: "record",
      label: record.predicate || record.text || record.namespace,
      status: record.status,
      recordId: record.id,
      namespace: record.namespace,
    };
  }
  if (selectedId.startsWith("entity:")) {
    const id = selectedId.slice("entity:".length);
    const entity = entitiesById.get(id);
    if (!entity) return null;
    return { id: selectedId, kind: "entity", label: entity.canonical_name, entityId: entity.id };
  }
  return null;
}
