// hooks/memory/use-memory-search.ts — base data-fetching hook for the
// Memory OS UI (COMPONENT_MODEL "data-flow rule": every component gets its
// data from a hooks/memory/* hook that calls memory-engine-service.ts; no
// component fetches directly). This is the UI-0 "raw search round-trips
// against the real engine" surface (IMPLEMENTATION_PLAN UI-0 acceptance) —
// later slices (UI-1) build MemoryBrowser/MemoryFilters on top of this same
// hook, they do not replace it.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MemoryEngineError,
  searchMemories,
  type SearchQuery,
  type SearchResult,
} from "@/services/memory-engine-service";

export type MemorySearchStatus = "idle" | "loading" | "success" | "error";

export interface UseMemorySearchResult {
  status: MemorySearchStatus;
  data: SearchResult | null;
  error: string | null;
  refetch: () => void;
}

/** Debounced-safe: only the LATEST in-flight request can ever commit state
 *  (a stale earlier response arriving after a newer query must not clobber
 *  it). No client-side ranking/filtering of the response — it is rendered
 *  as-is (STATE_MODEL "what the client must not compute"). */
export function useMemorySearch(query: SearchQuery): UseMemorySearchResult {
  const [status, setStatus] = useState<MemorySearchStatus>("idle");
  const [data, setData] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const queryKey = JSON.stringify(query);

  const run = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);
    searchMemories(JSON.parse(queryKey))
      .then((result) => {
        if (requestIdRef.current !== requestId) return; // superseded
        setData(result);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return; // superseded
        const message =
          err instanceof MemoryEngineError
            ? err.message
            : "Failed to reach the Memory Engine.";
        setError(message);
        setStatus("error");
      });
     
  }, [queryKey]);

  useEffect(() => {
    run();
  }, [run]);

  return { status, data, error, refetch: run };
}
