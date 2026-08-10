// hooks/memory/use-memory-graph.ts — Graph data (UI-7, MUI-1010). Every
// field the component renders (nodes/edges/validity/status) is the
// engine's own `neighborhood()` output — this hook fetches and exposes it,
// it never computes ranking/temporal-validity/dedup itself (STATE_MODEL
// "what the client must not compute"; COMPONENT_MODEL data-flow rule).
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGraphNeighborhood,
  MemoryEngineError,
  type GraphNeighborhood,
  type GraphQuery,
} from "@/services/memory-engine-service";

export type MemoryGraphStatus = "idle" | "loading" | "success" | "error";

export interface UseMemoryGraphResult {
  status: MemoryGraphStatus;
  data: GraphNeighborhood | null;
  error: string | null;
  refetch: () => void;
}

/** Only the LATEST in-flight request can ever commit state — a stale
 *  response for a previous `entity`/`at`/`relationTypes` combination
 *  arriving late must not clobber a newer one (same guard as
 *  useMemorySearch). Fetches nothing while `entity` is empty. */
export function useMemoryGraph(query: GraphQuery): UseMemoryGraphResult {
  const [status, setStatus] = useState<MemoryGraphStatus>("idle");
  const [data, setData] = useState<GraphNeighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const entity = query.entity;
  const at = query.at;
  const relationKey = JSON.stringify(query.relationTypes ?? []);

  const run = useCallback(() => {
    if (!entity.trim()) {
      setStatus("idle");
      setData(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);
    getGraphNeighborhood({ entity, at, relationTypes: JSON.parse(relationKey) })
      .then((result) => {
        if (requestIdRef.current !== requestId) return; // superseded
        setData(result);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return; // superseded
        setError(err instanceof MemoryEngineError ? err.message : "Could not load the graph.");
        setStatus("error");
      });
     
  }, [entity, at, relationKey]);

  useEffect(() => {
    run();
  }, [run]);

  return { status, data, error, refetch: run };
}
