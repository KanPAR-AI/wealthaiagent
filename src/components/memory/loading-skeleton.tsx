// components/memory/loading-skeleton.tsx — §45-46 loading state.
//
// NEVER render "0 memories" (or any empty/zero state) while a request is
// in flight (frontend-quality skill) — every data surface in the Memory OS
// UI must show this (or a screen-specific skeleton built on it) during
// load, and switch to EmptyState/ErrorState only once the request settles.
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingSkeletonProps {
  /** Number of placeholder rows/cards. */
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true" data-testid="loading-skeleton">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
