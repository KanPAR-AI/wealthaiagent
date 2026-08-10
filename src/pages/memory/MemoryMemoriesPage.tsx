// pages/memory/MemoryMemoriesPage.tsx — UI-0 SCOPE.
//
// This is deliberately NOT the full MemoryBrowser (MemoryFilters,
// MemoryList virtualization, MemoryCard, MemoryInspector — all UI-1/UI-2).
// It exists in this slice to do exactly one thing honestly: prove the
// "no-mock production path" (IMPLEMENTATION_PLAN UI-0 acceptance — "a raw
// search round-trips against the real engine") using the real
// `useMemorySearch` hook / `memory-engine-service.ts` client, with real
// loading/empty/error states and the real badge components. Also serves as
// the deep-link target for `/memory/memories/:id` (ROUTES.md) — the id is
// acknowledged, not yet resolved into an open Inspector (UI-2).
import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMemorySearch } from "@/hooks/memory/use-memory-search";
import { toMemoryCardView } from "@/services/memory-engine-service";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { EmptyState } from "@/components/memory/empty-state";
import { ErrorState } from "@/components/memory/error-state";
import { StatusBadge } from "@/components/memory/status-badge";
import { SourceBadge } from "@/components/memory/source-badge";
import { ConfidenceIndicator } from "@/components/memory/confidence-indicator";
import { trackMemoryEvent, MEMORY_TELEMETRY_EVENTS } from "@/lib/memory-telemetry";

export default function MemoryMemoriesPage() {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id?: string }>();

  const q = searchParams.get("q") ?? "";
  const namespace = searchParams.get("namespace") ?? "";
  const status = searchParams.get("status") ?? "";

  const { status: fetchStatus, data, error, refetch } = useMemorySearch({
    text: q,
    namespaces: namespace ? [namespace] : undefined,
    limit: 8,
  });

  useEffect(() => {
    trackMemoryEvent(MEMORY_TELEMETRY_EVENTS.VIEW_OPENED, { screen: "memories" });
  }, []);

  const rows = data ? [...data.pinned, ...data.results] : [];

  return (
    <div className="flex flex-col gap-4">
      {id && (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Deep link to memory <code className="font-mono">{id}</code> — the Inspector drawer ships in UI-2
          (ROUTES.md deep-link contract).
        </div>
      )}

      {status && (
        <p className="text-xs text-muted-foreground">
          The status filter (<span className="font-medium">{status}</span>) isn&apos;t applied to results yet —
          the structured filter set (source/status/confidence/authority/dates/entity) lands in UI-1
          (API_MAPPING MUI-1001 gap).
        </p>
      )}

      {fetchStatus === "loading" || fetchStatus === "idle" ? (
        <LoadingSkeleton rows={4} />
      ) : fetchStatus === "error" ? (
        <ErrorState message={error ?? undefined} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No memories found"
          description={q ? `No results for "${q}".` : "Nothing remembered yet in this scope."}
        />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="memory-search-results">
          {rows.map((row) => {
            const card = toMemoryCardView(row.memory);
            return (
              <li
                key={card.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3"
              >
                <span className="text-sm font-medium">{card.label}</span>
                <StatusBadge status={card.status} />
                <SourceBadge source={card.source} />
                <ConfidenceIndicator confidence={card.confidence} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
