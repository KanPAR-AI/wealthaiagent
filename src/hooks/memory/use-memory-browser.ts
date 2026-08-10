// hooks/memory/use-memory-browser.ts — data-fetching hook for the Memories
// browser (UI-1, COMPONENT_MODEL MemoryBrowser). Builds on the same
// service (memory-engine-service.ts) as UI-0's useMemorySearch but adds
// the §5 structured filter set, a debounced request (UI-02), and the two
// real request shapes ("relevance" ranked search vs "browse" unranked
// structured list — see lib/memory-filters-url.ts) behind ONE unified row
// shape so MemoryList/MemoryCard never need to know which mode produced a
// row. No client-side ranking/re-sort happens here — rows are rendered in
// exactly the order the backend returned them (STATE_MODEL).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MemoryEngineError,
  listMemories,
  searchMemories,
  type MemoryRecord,
  type RetrievedMemoryRow,
} from "@/services/memory-engine-service";
import {
  buildListQuery,
  buildSearchQuery,
  parseMemoryFiltersFromParams,
  type MemoryFiltersState,
} from "@/lib/memory-filters-url";

export type MemoryBrowserStatus = "idle" | "loading" | "success" | "error";

/** Unified row shape for both fetch modes. `score`/`retrievalReason` are
 *  null in "browse" mode (there is no ranking to report — never fabricate
 *  one client-side). */
export interface MemoryBrowserRow {
  memory: MemoryRecord;
  score: number | null;
  retrievalReason: string | null;
  channels: string[];
  pinned: boolean;
}

export interface UseMemoryBrowserResult {
  status: MemoryBrowserStatus;
  rows: MemoryBrowserRow[];
  atCap: boolean;
  error: string | null;
  filters: MemoryFiltersState;
  refetch: () => void;
}

const DEBOUNCE_MS = 300;
// Server caps (honest UI-33 disclosure — no cursor pagination yet, Role-3
// rec): ranked search is capped at 50 server-side (memories.py), browse at
// the repo default of 500. When rows hit the cap the server may hold more,
// so the toolbar shows "top N" rather than implying an exact total.
const RANKED_CAP = 50;
const BROWSE_CAP = 500;

function toRow(row: RetrievedMemoryRow, pinned: boolean): MemoryBrowserRow {
  return {
    memory: row.memory,
    score: row.score,
    retrievalReason: row.retrieval_reason,
    channels: row.channels,
    pinned,
  };
}

export function useMemoryBrowser(): UseMemoryBrowserResult {
  const [searchParams] = useSearchParams();
  const filters = useMemo(
    () => parseMemoryFiltersFromParams(searchParams),
    [searchParams],
  );
  const filtersKey = JSON.stringify(filters);

  const [status, setStatus] = useState<MemoryBrowserStatus>("idle");
  const [rows, setRows] = useState<MemoryBrowserRow[]>([]);
  const [atCap, setAtCap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const run = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const state: MemoryFiltersState = JSON.parse(filtersKey);
    setStatus("loading");
    setError(null);

    const fetchRows: Promise<MemoryBrowserRow[]> =
      state.sort === "browse"
        ? listMemories(buildListQuery(state)).then((r) =>
            r.memories.map((memory) => ({
              memory,
              score: null,
              retrievalReason: null,
              channels: [],
              pinned: false,
            })),
          )
        : searchMemories(buildSearchQuery(state)).then((r) => [
            ...r.pinned.map((row) => toRow(row, true)),
            ...r.results.map((row) => toRow(row, false)),
          ]);

    fetchRows
      .then((nextRows) => {
        if (requestIdRef.current !== requestId) return; // superseded
        setRows(nextRows);
        setAtCap(
          nextRows.length >=
            (state.sort === "browse" ? BROWSE_CAP : RANKED_CAP),
        );
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
  }, [filtersKey]);

  useEffect(() => {
    // Debounced (UI-02): rapid filter/query changes coalesce into ONE
    // request after DEBOUNCE_MS of quiet. `requestIdRef` above also guards
    // the network race so an in-flight superseded response can never
    // clobber a newer one even if two requests do land.
    const handle = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [run]);

  return { status, rows, atCap, error, filters, refetch: run };
}
