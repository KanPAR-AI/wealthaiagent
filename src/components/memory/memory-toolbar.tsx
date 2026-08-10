// components/memory/memory-toolbar.tsx — MemoryToolbar (§8-11): result
// count + SortSelect. Changing sort NEVER re-sorts the currently-held
// rows client-side — it writes the URL (`sort`) and the browser hook
// issues a NEW request for the chosen mode (STATE_MODEL: "what the client
// must not compute" — ranking/order is always the backend's).
import { useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import {
  applyMemoryFilterChange,
  parseMemoryFiltersFromParams,
  type SortMode,
} from "@/lib/memory-filters-url";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "browse", label: "Browse (unranked)" },
];

export interface MemoryToolbarProps {
  resultCount: number;
  atCap?: boolean;
  loading?: boolean;
}

export function MemoryToolbar({ resultCount, atCap = false, loading = false }: MemoryToolbarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseMemoryFiltersFromParams(searchParams);

  function selectSort(value: string) {
    setSearchParams(
      applyMemoryFilterChange(searchParams, { sort: value as SortMode }),
      { replace: true },
    );
  }

  const label = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? "Best match";

  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <p className="text-sm text-muted-foreground" data-testid="memory-result-count" aria-live="polite">
        {loading
          ? "Searching…"
          : atCap
            ? `Showing top ${resultCount} — refine filters to see more`
            : `${resultCount} ${resultCount === 1 ? "memory" : "memories"}`}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Sort" className="gap-1.5">
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={filters.sort} onValueChange={selectSort}>
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
