// components/memory/full-graph/kg-filters.tsx — filter rail for the Full
// Knowledge Graph page: namespace, status (multi), predicate text search,
// "only problems". Controlled by the page via URL state (STATE_MODEL "the
// URL owns filter state") — this component holds no filter state itself.
import { Input } from "@/components/ui/input";
import type { MemoryStatus } from "@/services/memory-engine-service";
import type { FullGraphFiltersState } from "@/lib/full-graph-filters-url";

const STATUS_OPTIONS: { value: MemoryStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "superseded", label: "Superseded" },
  { value: "expired", label: "Expired" },
  { value: "disputed", label: "Disputed" },
];

export interface KgFiltersProps {
  filters: FullGraphFiltersState;
  namespaceOptions: string[];
  onChange: (patch: Partial<FullGraphFiltersState>) => void;
}

export function KgFilters({ filters, namespaceOptions, onChange }: KgFiltersProps) {
  function toggleStatus(status: MemoryStatus) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onChange({ statuses: next });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="kg-filters">
      <div className="flex flex-col gap-1">
        <label htmlFor="kg-namespace" className="text-xs font-medium text-muted-foreground">
          Namespace
        </label>
        <select
          id="kg-namespace"
          value={filters.namespace}
          onChange={(e) => onChange({ namespace: e.target.value })}
          className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs"
        >
          <option value="">All namespaces</option>
          {namespaceOptions.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-xs text-foreground/90">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border/60"
                checked={filters.statuses.includes(o.value)}
                onChange={() => toggleStatus(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="kg-predicate" className="text-xs font-medium text-muted-foreground">
          Predicate contains
        </label>
        <Input
          id="kg-predicate"
          value={filters.predicateQuery}
          onChange={(e) => onChange({ predicateQuery: e.target.value })}
          placeholder="e.g. diet.preference"
          className="h-8 w-44 text-xs"
        />
      </div>

      <label className="flex items-center gap-1.5 pb-1 text-xs font-medium text-foreground/90">
        <input
          type="checkbox"
          className="size-3.5 rounded border-border/60"
          checked={filters.onlyProblems}
          onChange={(e) => onChange({ onlyProblems: e.target.checked })}
        />
        Only problems
      </label>
    </div>
  );
}
