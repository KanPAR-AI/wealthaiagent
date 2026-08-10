// components/memory/memory-list.tsx — MemoryList (§8-11, UI-33).
//
// UI-33 asks for "virtualized/paginated" at thousands-of-memories scale.
// This repo has no windowing library in its dependency set (package.json)
// and ADR-004 forbids introducing a competing library without an ADR, and
// hand-rolled scroll-position virtualization is unreliable to test under
// jsdom (no real layout/scrollTop). We therefore take the PAGINATE arm of
// "virtualize OR paginate" (IMPLEMENTATION_PLAN UI-1): only a bounded
// window of rows is ever mounted, growing by PAGE_SIZE on demand via an
// explicit, keyboard-operable "Show more" control — never a hover-only or
// scroll-only affordance (accessibility skill). This is a client-side
// reveal over the ALREADY-fetched `rows` array; it never re-fetches, never
// re-sorts, and never re-orders — only how much of the server's own order
// is currently mounted.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MemoryCard } from "@/components/memory/memory-card";
import type { MemoryBrowserRow } from "@/hooks/memory/use-memory-browser";

const PAGE_SIZE = 40;

export interface MemoryListProps {
  rows: MemoryBrowserRow[];
  devMode?: boolean;
}

export function MemoryList({ rows, devMode = false }: MemoryListProps) {
  const [visibleCount, setVisibleCount] = useState(Math.min(PAGE_SIZE, rows.length));

  // A new result set (new query/filters) resets the window back to the
  // first page — never keeps a stale count around from a previous query.
  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, rows.length));
  }, [rows]);

  const visible = rows.slice(0, visibleCount);
  const remaining = rows.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" data-testid="memory-list">
        {visible.map((row) => (
          <MemoryCard key={row.memory.id} row={row} devMode={devMode} />
        ))}
      </ul>
      {remaining > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center"
          onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, rows.length))}
        >
          Show {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
        </Button>
      )}
    </div>
  );
}
