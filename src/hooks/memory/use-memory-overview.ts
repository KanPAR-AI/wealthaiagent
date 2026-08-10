// hooks/memory/use-memory-overview.ts — Overview data (UI-4). One real
// backend call (GET /memory/overview); the backend does the aggregation so
// the client computes no counts/semantics. Honest loading/error states.
import { useEffect, useState } from "react";
import {
  getOverview,
  MemoryEngineError,
  type MemoryOverview,
} from "@/services/memory-engine-service";

export type OverviewStatus = "loading" | "success" | "error";

export function useMemoryOverview() {
  const [status, setStatus] = useState<OverviewStatus>("loading");
  const [data, setData] = useState<MemoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getOverview()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof MemoryEngineError ? err.message : "Could not load the overview.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  return { status, data, error, refetch: () => setReloadKey((k) => k + 1) };
}
