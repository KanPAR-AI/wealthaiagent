// components/memory/graph/memory-graph.tsx — MemoryGraph (UI_SPEC §27-30,
// MUI-0027). Orchestrates GraphControls (entity switch / relation filter /
// TemporalSlider / view toggle), GraphCanvas (SVG), GraphTable (a11y
// fallback + mobile default, MUI-0030), and EdgeInspector (MUI-0029) around
// ONE real backend call — GET /memories/graph (gateway.neighborhood,
// MUI-1010) — a 1-hop bounded, resolver-based, temporal neighborhood. The
// `entity`/`at`/`relation` filters are URL-backed (STATE_MODEL "Active
// filters ... URL", deep-linkable) so a reload or a shared link restores
// exactly what was on screen.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Share2 } from "lucide-react";
import {
  type GraphEdge,
  type GraphNode,
} from "@/services/memory-engine-service";
import { useMemoryGraph } from "@/hooks/memory/use-memory-graph";
import { useEntities } from "@/hooks/memory/use-entities";
import { useIsMobile } from "@/hooks/use-mobile";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { ErrorState } from "@/components/memory/error-state";
import { EmptyState } from "@/components/memory/empty-state";
import { UntrustedText } from "@/components/memory/untrusted-text";
import { GraphControls, type GraphView } from "@/components/memory/graph/graph-controls";
import { GraphCanvas } from "@/components/memory/graph/graph-canvas";
import { GraphTable } from "@/components/memory/graph/graph-table";
import { EdgeInspector } from "@/components/memory/graph/edge-inspector";
import { MEMORY_TELEMETRY_EVENTS, trackMemoryEvent } from "@/lib/memory-telemetry";

export function MemoryGraph() {
  const [params, setParams] = useSearchParams();
  const entity = params.get("entity") ?? "";
  const at = params.get("at") ?? undefined;
  const relationTypes = params.getAll("relation");
  const isMobile = useIsMobile();

  const [view, setView] = useState<GraphView>("canvas");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [discoveredTypes, setDiscoveredTypes] = useState<string[]>([]);

  const { status, data, error, refetch } = useMemoryGraph({ entity, at, relationTypes });
  const { entities: entitySuggestions } = useEntities();

  // Effective view: the table is the ONLY option on mobile, regardless of
  // any prior desktop selection (RESPONSIVE_SPEC "mobile graph→table
  // default").
  const effectiveView: GraphView = isMobile ? "table" : view;

  useEffect(() => {
    // Discover the relation types touching this entity from an UNFILTERED
    // load (so toggling a filter off later still has something to toggle
    // back on) — a plain reflection of data already returned, not a new
    // backend query.
    if (status === "success" && data?.status === "resolved" && relationTypes.length === 0) {
      const types = Array.from(new Set(data.edges.map((e) => e.relation_type))).sort();
      setDiscoveredTypes(types);
    }
  }, [status, data, relationTypes.length]);

  useEffect(() => {
    setDiscoveredTypes([]);
    setSelectedEdgeId(null);
  }, [entity]);

  useEffect(() => {
    if (status === "success" && data?.status === "resolved" && data.center) {
      trackMemoryEvent(MEMORY_TELEMETRY_EVENTS.GRAPH_OPENED, {
        entity_id: data.center.id,
        node_count: data.nodes.length,
        edge_count: data.edges.length,
        truncated: data.truncated,
      });
    }
    // fire once per resolved response, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of data?.nodes ?? []) map.set(n.entity_id, n);
    return map;
  }, [data]);

  const selectedEdge: GraphEdge | null = useMemo(
    () => data?.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [data, selectedEdgeId],
  );

  function goToEntity(value: string) {
    const next = new URLSearchParams(params);
    next.set("entity", value);
    setParams(next);
  }

  function setAt(iso: string | null) {
    const next = new URLSearchParams(params);
    if (iso) next.set("at", iso);
    else next.delete("at");
    setParams(next);
  }

  function toggleRelationType(type: string) {
    const next = new URLSearchParams(params);
    next.delete("relation");
    const current = new Set(relationTypes);
    if (current.has(type)) current.delete(type);
    else current.add(type);
    for (const t of current) next.append("relation", t);
    setParams(next);
  }

  if (!entity.trim()) {
    return (
      <div className="space-y-4 p-4">
        <GraphControls
          entityValue={entity}
          onEntitySubmit={goToEntity}
          entitySuggestions={entitySuggestions}
          relationTypeOptions={[]}
          selectedRelationTypes={[]}
          onToggleRelationType={() => undefined}
          at={at}
          onAtChange={setAt}
          view={effectiveView}
          onViewChange={setView}
          showViewToggle={!isMobile}
          truncated={false}
        />
        <EmptyState
          icon={Share2}
          title="Pick an entity to see its relationships"
          description="Type a name or alias above, or open a memory and use a linked entity, to see its bounded 1-hop neighborhood."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" data-testid="memory-graph">
      <GraphControls
        entityValue={entity}
        onEntitySubmit={goToEntity}
        entitySuggestions={entitySuggestions}
        relationTypeOptions={discoveredTypes}
        selectedRelationTypes={relationTypes}
        onToggleRelationType={toggleRelationType}
        at={at}
        onAtChange={setAt}
        view={effectiveView}
        onViewChange={setView}
        showViewToggle={!isMobile}
        truncated={data?.truncated ?? false}
      />

      {status === "loading" && <LoadingSkeleton rows={4} />}

      {status === "error" && <ErrorState message={error ?? undefined} onRetry={refetch} />}

      {status === "success" && data?.status === "ambiguous" && (
        <div className="space-y-3">
          <EmptyState
            title="Which one did you mean?"
            description={`"${entity}" matches more than one entity — pick one to see its graph.`}
          />
          <ul className="flex flex-wrap gap-2" data-testid="graph-ambiguous-candidates">
            {data.candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted/40"
                  onClick={() => goToEntity(c.id)}
                >
                  <UntrustedText inline>{c.canonical_name}</UntrustedText>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "success" && data?.status === "unknown" && (
        <EmptyState
          title="No entity found"
          description={`"${entity}" doesn't match any entity in your memory. Check the spelling, or pick one from the field above.`}
        />
      )}

      {status === "success" && data?.status === "resolved" && (
        <>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <UntrustedText inline>{data.center?.canonical_name ?? entity}</UntrustedText>
            <span className="text-xs font-normal text-muted-foreground">
              ({data.nodes.length - 1} connection{data.nodes.length - 1 === 1 ? "" : "s"})
            </span>
          </h2>

          {data.nodes.length <= 1 ? (
            <EmptyState
              title="No relationships yet"
              description="This entity has no relations recorded within the selected time and filters."
            />
          ) : effectiveView === "canvas" ? (
            <GraphCanvas
              centerId={data.center?.id ?? null}
              nodes={data.nodes}
              edges={data.edges}
              selectedEdgeId={selectedEdgeId}
              onSelectNode={(id) => (id === data.center?.id ? undefined : goToEntity(id))}
              onSelectEdge={setSelectedEdgeId}
            />
          ) : (
            <GraphTable
              edges={data.edges}
              nodesById={nodesById}
              onSelectEdge={setSelectedEdgeId}
              onSelectEntity={(id) => (id === data.center?.id ? undefined : goToEntity(id))}
            />
          )}

          <EdgeInspector
            edge={selectedEdge}
            sourceNode={selectedEdge ? (nodesById.get(selectedEdge.source) ?? null) : null}
            targetNode={selectedEdge ? (nodesById.get(selectedEdge.target) ?? null) : null}
            open={!!selectedEdgeId}
            onClose={() => setSelectedEdgeId(null)}
          />
        </>
      )}
    </div>
  );
}
