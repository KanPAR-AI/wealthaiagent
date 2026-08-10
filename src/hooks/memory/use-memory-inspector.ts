// hooks/memory/use-memory-inspector.ts — loads one memory + its lifecycle
// history for the Inspector (UI-2, UI_SPEC §12-14/§17). A foreign/unknown
// id surfaces the backend's 404 as an honest not-found state with NO data
// flash (UI-11 principle): status is never "success" until BOTH the record
// and history have resolved. Nothing here computes memory semantics — the
// record's status/authority/confidence and the lifecycle events are engine
// outputs displayed verbatim.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMemory,
  getMemoryHistory,
  MemoryEngineError,
  type MemoryRecord,
  type MemoryEvent,
} from "@/services/memory-engine-service";

export type InspectorStatus = "idle" | "loading" | "success" | "notfound" | "error";

export interface UseMemoryInspectorResult {
  status: InspectorStatus;
  memory: MemoryRecord | null;
  /** newest-first for display (§17); the backend returns (memory_id, seq)
   *  ascending and we sort for the timeline, never recompute lifecycle. */
  history: MemoryEvent[];
  error: string | null;
  refetch: () => void;
}

export function useMemoryInspector(memoryId: string | undefined): UseMemoryInspectorResult {
  const [status, setStatus] = useState<InspectorStatus>("idle");
  const [memory, setMemory] = useState<MemoryRecord | null>(null);
  const [history, setHistory] = useState<MemoryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const run = useCallback(() => {
    if (!memoryId) {
      setStatus("idle");
      setMemory(null);
      setHistory([]);
      setError(null);
      return;
    }
    const reqId = ++reqRef.current;
    setStatus("loading");
    setError(null);
    // Do NOT clear `memory` here — but a fresh id must not flash the old
    // record. Clear only when the id actually changed (handled by effect dep).
    Promise.all([getMemory(memoryId), getMemoryHistory(memoryId)])
      .then(([record, hist]) => {
        if (reqRef.current !== reqId) return; // superseded
        setMemory(record);
        setHistory(
          [...hist.events].sort((a, b) => b.seq - a.seq), // newest-first (§17)
        );
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (reqRef.current !== reqId) return;
        setMemory(null);
        setHistory([]);
        if (err instanceof MemoryEngineError && err.status === 404) {
          setStatus("notfound");
          return;
        }
        setError(
          err instanceof MemoryEngineError
            ? err.message
            : "Failed to reach the Memory Engine.",
        );
        setStatus("error");
      });
  }, [memoryId]);

  useEffect(() => {
    // Clear previous record immediately when the target id changes so a
    // stale record can never flash under a new id (UI-11 no-data-flash).
    setMemory(null);
    setHistory([]);
    run();
  }, [run]);

  return { status, memory, history, error, refetch: run };
}
