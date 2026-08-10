// components/memory/status-selector.tsx — StatusSelector (§3, §5). Options
// are the engine's fixed MemoryStatus enum — real backend states, not
// invented categories.
import { useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { MemoryStatus } from "@/services/memory-engine-service";

const STATUS_OPTIONS: { value: MemoryStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "superseded", label: "Superseded" },
  { value: "disputed", label: "Disputed" },
  { value: "expired", label: "Expired" },
  { value: "deleted", label: "Deleted" },
];

export function StatusSelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get("status") || "all";

  function select(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    setSearchParams(next, { replace: true });
  }

  const label = STATUS_OPTIONS.find((o) => o.value === current)?.label ?? "All statuses";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Filter by status">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={current} onValueChange={select}>
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
