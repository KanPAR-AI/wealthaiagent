// components/memory/memory-browser.tsx — MemoryBrowser (§8-11, UI-1):
// canonical browser composing MemoryFilters (left rail) + MemoryToolbar
// (result count + sort) + MemoryList (MemoryCard rows). Data comes from
// ONE hook (useMemoryBrowser) — this component renders states, it never
// fetches or computes ranking itself (COMPONENT_MODEL data-flow rule).
import { useEffect } from "react";
import { useMemoryBrowser } from "@/hooks/memory/use-memory-browser";
import { MemoryFilters } from "@/components/memory/memory-filters";
import { MemoryToolbar } from "@/components/memory/memory-toolbar";
import { MemoryList } from "@/components/memory/memory-list";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { EmptyState } from "@/components/memory/empty-state";
import { ErrorState } from "@/components/memory/error-state";
import { trackMemoryEvent, MEMORY_TELEMETRY_EVENTS } from "@/lib/memory-telemetry";

export interface MemoryBrowserProps {
  devMode?: boolean;
}

export function MemoryBrowser({ devMode = false }: MemoryBrowserProps) {
  const { status, rows, error, filters, refetch } = useMemoryBrowser();

  useEffect(() => {
    trackMemoryEvent(MEMORY_TELEMETRY_EVENTS.VIEW_OPENED, { screen: "memories" });
     
  }, []);

  const loading = status === "loading" || status === "idle";

  return (
    <div className="flex h-full gap-4" data-testid="memory-browser">
      <MemoryFilters />
      <div className="flex min-w-0 flex-1 flex-col">
        <MemoryToolbar resultCount={rows.length} loading={loading} />
        {status === "error" ? (
          <ErrorState message={error ?? undefined} onRetry={refetch} />
        ) : loading ? (
          <LoadingSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No memories found"
            description={
              filters.q
                ? `No results for "${filters.q}".`
                : "Nothing remembered yet that matches these filters."
            }
          />
        ) : (
          <MemoryList rows={rows} devMode={devMode} />
        )}
      </div>
    </div>
  );
}
