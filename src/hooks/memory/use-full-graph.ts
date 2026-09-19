// hooks/memory/use-full-graph.ts — data for the Full Knowledge Graph debug
// page. There is no list-all-relations endpoint (API_MAPPING gap, reported
// rather than worked around by adding one — HARD constraint: frontend-only
// changes) so the complete relation set is assembled by calling the
// EXISTING GET /memories/graph once per entity (bounded concurrency),
// deduped by relation id (lib/knowledge-graph-assembly.ts). This hook does
// no ranking/validity/semantics computation itself — it only orchestrates
// three already-real reads and reports which one failed.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGraphNeighborhood,
  listMemories,
  listEntities,
  MemoryEngineError,
  type Entity,
  type GraphEdge,
  type MemoryRecord,
  type MemoryStatus,
} from "@/services/memory-engine-service";
import { dedupeRelations } from "@/lib/knowledge-graph-assembly";

export type FullGraphStatus = "loading" | "success" | "error";

export interface FullGraphError {
  call: "records" | "entities" | "relations";
  message: string;
}

export interface FullGraphData {
  records: MemoryRecord[];
  entities: Entity[];
  relations: GraphEdge[];
  /** entities whose 1-hop neighborhood call failed — the rest of the graph
   *  is still shown; this is surfaced so the debugger knows it's partial. */
  failedEntityIds: string[];
}

export interface UseFullGraphResult {
  status: FullGraphStatus;
  data: FullGraphData | null;
  error: FullGraphError | null;
  refetch: () => void;
}

// Every non-deleted status — "every record" per the requirement (deleted
// tombstones are a separate lifecycle state the engine doesn't expose a
// public list-shape for here).
const ALL_STATUSES: MemoryStatus[] = ["active", "superseded", "expired", "disputed"];

const RELATION_FETCH_CONCURRENCY = 5;

async function fetchAllRelations(
  entities: Entity[],
): Promise<{ relations: GraphEdge[]; failedEntityIds: string[] }> {
  const edgeLists: GraphEdge[][] = [];
  const failedEntityIds: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < entities.length) {
      const i = cursor++;
      const entity = entities[i];
      try {
        const neighborhood = await getGraphNeighborhood({ entity: entity.id });
        if (neighborhood.status === "resolved") edgeLists.push(neighborhood.edges);
      } catch {
        failedEntityIds.push(entity.id);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(RELATION_FETCH_CONCURRENCY, entities.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return { relations: dedupeRelations(edgeLists), failedEntityIds };
}

/** Fetches every memory record (all non-deleted statuses), every entity,
 *  and the complete relation set (per-entity 1-hop calls, deduped). Only
 *  the LATEST call can commit state. */
export function useFullGraph(): UseFullGraphResult {
  const [status, setStatus] = useState<FullGraphStatus>("loading");
  const [data, setData] = useState<FullGraphData | null>(null);
  const [error, setError] = useState<FullGraphError | null>(null);
  const requestIdRef = useRef(0);

  const run = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);

    (async () => {
      let records: MemoryRecord[];
      try {
        const res = await listMemories({ status: ALL_STATUSES });
        records = res.memories;
      } catch (err: unknown) {
        if (requestIdRef.current !== requestId) return;
        setError({
          call: "records",
          message: err instanceof MemoryEngineError ? err.message : "Could not load memory records.",
        });
        setStatus("error");
        return;
      }

      let entities: Entity[];
      try {
        const res = await listEntities();
        entities = res.entities;
      } catch (err: unknown) {
        if (requestIdRef.current !== requestId) return;
        setError({
          call: "entities",
          message: err instanceof MemoryEngineError ? err.message : "Could not load entities.",
        });
        setStatus("error");
        return;
      }

      if (entities.length === 0) {
        if (requestIdRef.current !== requestId) return;
        setData({ records, entities, relations: [], failedEntityIds: [] });
        setStatus("success");
        return;
      }

      const { relations, failedEntityIds } = await fetchAllRelations(entities);
      if (requestIdRef.current !== requestId) return;
      if (relations.length === 0 && failedEntityIds.length === entities.length) {
        setError({ call: "relations", message: "Could not load any entity relationships." });
        setStatus("error");
        return;
      }
      setData({ records, entities, relations, failedEntityIds });
      setStatus("success");
    })();
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { status, data, error, refetch: run };
}
