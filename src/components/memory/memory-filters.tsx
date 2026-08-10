// components/memory/memory-filters.tsx — MemoryFilters (§5, §8-11,
// MUI-0007). Left rail; every control writes the URL via
// lib/memory-filters-url.ts (the ONE codec every control shares) — a
// reload/deep-link restores EXACTLY (UI-25). No control computes/holds
// authoritative state itself; each is a thin view over the URL.
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/memory/permission-gate";
import { BroadForgetDialog } from "@/components/memory/mutations/broad-forget-dialog";
import type {
  MemoryStatus,
  MemoryType,
  SourceType,
} from "@/services/memory-engine-service";
import {
  DEFAULT_MEMORY_FILTERS,
  applyMemoryFilterChange,
  browseModeIgnoredFilters,
  isDefaultFilters,
  parseMemoryFiltersFromParams,
  type MemoryFiltersState,
} from "@/lib/memory-filters-url";

const TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "preference", label: "Preference" },
  { value: "semantic", label: "Semantic" },
  { value: "relationship", label: "Relationship" },
  { value: "episodic", label: "Episode" },
  { value: "procedural", label: "Procedure" },
];

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "user_explicit", label: "Explicit user" },
  { value: "user_observed", label: "User observed" },
  { value: "tool_verified", label: "Tool verified" },
  { value: "document_verified", label: "Document verified" },
  { value: "agent_inference", label: "Agent inference" },
  { value: "episode_consolidation", label: "Episode consolidation" },
  { value: "system", label: "System" },
];

const STATUS_OPTIONS: { value: MemoryStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "superseded", label: "Superseded" },
  { value: "disputed", label: "Disputed" },
  { value: "expired", label: "Expired" },
  { value: "deleted", label: "Deleted" },
];

function CheckboxGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-semibold text-foreground">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <input
            type="checkbox"
            className="size-3.5 rounded border-border/60"
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function MemoryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseMemoryFiltersFromParams(searchParams);
  const [namespaceInput, setNamespaceInput] = useState(filters.namespace);
  const [broadForgetOpen, setBroadForgetOpen] = useState(false);

  useEffect(() => {
    setNamespaceInput(filters.namespace);
  }, [filters.namespace]);

  function patch(change: Partial<MemoryFiltersState>) {
    setSearchParams(applyMemoryFilterChange(searchParams, change), { replace: true });
  }

  function commitNamespace() {
    patch({ namespace: namespaceInput.trim() });
  }

  function clearAll() {
    setSearchParams(
      applyMemoryFilterChange(searchParams, DEFAULT_MEMORY_FILTERS),
      { replace: true },
    );
  }

  const browseIgnored = filters.sort === "browse" ? browseModeIgnoredFilters(filters) : [];

  return (
    <aside
      className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border/60 p-4"
      aria-label="Memory filters"
      data-testid="memory-filters"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {!isDefaultFilters(filters) && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>

      {browseIgnored.length > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          Browse (unranked) mode doesn&apos;t apply: {browseIgnored.join(", ")}.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memory-filter-domain" className="text-xs font-semibold">
          Domain
        </Label>
        <Input
          id="memory-filter-domain"
          value={namespaceInput}
          onChange={(e) => setNamespaceInput(e.target.value)}
          onBlur={commitNamespace}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNamespace();
          }}
          placeholder="All domains"
          className="h-8 text-xs"
        />
      </div>

      {filters.namespace.trim() !== "" && (
        <PermissionGate perm="memory.forget">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => setBroadForgetOpen(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Forget all in "{filters.namespace.trim()}"…
          </Button>
          <BroadForgetDialog
            open={broadForgetOpen}
            onOpenChange={setBroadForgetOpen}
            filter={{ namespace: filters.namespace.trim() }}
            scopeLabel={filters.namespace.trim()}
            onForgotten={() => {
              // re-run the browser by touching the URL (same params)
              setSearchParams(new URLSearchParams(searchParams), { replace: true });
            }}
          />
        </PermissionGate>
      )}

      <CheckboxGroup
        legend="Memory type"
        options={TYPE_OPTIONS}
        selected={filters.types}
        onChange={(types) => patch({ types })}
      />

      <CheckboxGroup
        legend="Source"
        options={SOURCE_OPTIONS}
        selected={filters.sources}
        onChange={(sources) => patch({ sources })}
      />

      <CheckboxGroup
        legend="Status"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(statuses) => patch({ statuses })}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memory-filter-confidence" className="text-xs font-semibold">
          Confidence
        </Label>
        <select
          id="memory-filter-confidence"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={filters.minConfidence}
          onChange={(e) => patch({ minConfidence: e.target.value as MemoryFiltersState["minConfidence"] })}
        >
          <option value="">Any confidence</option>
          <option value="0.7">Medium and above (&ge; 0.70)</option>
          <option value="0.9">High only (&ge; 0.90)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memory-filter-authority" className="text-xs font-semibold">
          Authority
        </Label>
        <select
          id="memory-filter-authority"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={filters.minAuthority}
          onChange={(e) => patch({ minAuthority: e.target.value as MemoryFiltersState["minAuthority"] })}
        >
          <option value="">Any authority</option>
          <option value="0.5">&ge; 0.50</option>
          <option value="0.8">&ge; 0.80</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold">Created date</span>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="memory-filter-created-after" className="sr-only">
            Created after
          </Label>
          <Input
            id="memory-filter-created-after"
            type="date"
            value={filters.createdAfter}
            onChange={(e) => patch({ createdAfter: e.target.value })}
            className="h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Label htmlFor="memory-filter-created-before" className="sr-only">
            Created before
          </Label>
          <Input
            id="memory-filter-created-before"
            type="date"
            value={filters.createdBefore}
            onChange={(e) => patch({ createdBefore: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memory-filter-valid-at" className="text-xs font-semibold">
          Valid as of
        </Label>
        <Input
          id="memory-filter-valid-at"
          type="date"
          value={filters.validAt}
          onChange={(e) => patch({ validAt: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memory-filter-entity" className="text-xs font-semibold">
          Entity
        </Label>
        <Input
          id="memory-filter-entity"
          value={filters.entityId}
          onChange={(e) => patch({ entityId: e.target.value })}
          placeholder="Entity id"
          className="h-8 text-xs"
        />
      </div>
    </aside>
  );
}
