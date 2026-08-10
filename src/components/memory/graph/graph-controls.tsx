// components/memory/graph/graph-controls.tsx — GraphControls (UI_SPEC
// §27-30, MUI-0028). Entity switcher (alias/id — resolved server-side,
// UI-15), relation-type filter (a plain inclusion filter forwarded to the
// backend, never a client re-filter), the view toggle (Canvas/Table —
// GraphTable is the a11y fallback, MUI-0030/UI-28), and the TemporalSlider
// (UI-16/TEMP-03).
import { useEffect, useState } from "react";
import { GanttChartSquare, Search, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TemporalSlider } from "@/components/memory/graph/temporal-slider";
import type { Entity } from "@/services/memory-engine-service";

export type GraphView = "canvas" | "table";

export interface GraphControlsProps {
  entityValue: string;
  onEntitySubmit: (value: string) => void;
  entitySuggestions: Entity[];
  relationTypeOptions: string[];
  selectedRelationTypes: string[];
  onToggleRelationType: (type: string) => void;
  at: string | null | undefined;
  onAtChange: (iso: string | null) => void;
  view: GraphView;
  onViewChange: (view: GraphView) => void;
  /** show/hide the Canvas/Table toggle — hidden on mobile, where the table
   *  is the ONLY view (RESPONSIVE_SPEC "mobile graph→table default"). */
  showViewToggle: boolean;
  truncated: boolean;
}

const DATALIST_ID = "graph-entity-suggestions";

export function GraphControls({
  entityValue,
  onEntitySubmit,
  entitySuggestions,
  relationTypeOptions,
  selectedRelationTypes,
  onToggleRelationType,
  at,
  onAtChange,
  view,
  onViewChange,
  showViewToggle,
  truncated,
}: GraphControlsProps) {
  const [draft, setDraft] = useState(entityValue);

  useEffect(() => {
    setDraft(entityValue);
  }, [entityValue]);

  return (
    <div className="space-y-3" data-testid="graph-controls">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="relative min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) onEntitySubmit(draft.trim());
          }}
        >
          <label htmlFor="graph-entity-input" className="mb-1 block text-xs font-medium text-muted-foreground">
            Entity
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="graph-entity-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              list={DATALIST_ID}
              placeholder="Name, alias, or entity id…"
              className="h-8 pl-8 text-sm"
              aria-label="Entity name or alias"
            />
            <datalist id={DATALIST_ID}>
              {entitySuggestions.map((e) => (
                <option key={e.id} value={e.canonical_name} />
              ))}
            </datalist>
          </div>
        </form>

        {showViewToggle && (
          <div className="flex gap-1" role="group" aria-label="Graph view">
            <Button
              type="button"
              variant={view === "canvas" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              aria-pressed={view === "canvas"}
              onClick={() => onViewChange("canvas")}
            >
              <GanttChartSquare className="size-3.5" aria-hidden="true" /> Canvas
            </Button>
            <Button
              type="button"
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
            >
              <TableIcon className="size-3.5" aria-hidden="true" /> Table
            </Button>
          </div>
        )}
      </div>

      {relationTypeOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by relation type">
          {relationTypeOptions.map((type) => {
            const active = selectedRelationTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleRelationType(type)}
                className={
                  active
                    ? "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    : "rounded-full border border-border/60 bg-transparent px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/40"
                }
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      <TemporalSlider value={at} onChange={onAtChange} className="max-w-md" />

      {truncated && (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          This entity has more relationships than shown — narrow by relation type to see the rest.
        </p>
      )}
    </div>
  );
}
