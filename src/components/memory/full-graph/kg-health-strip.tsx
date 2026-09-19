// components/memory/full-graph/kg-health-strip.tsx — the health strip atop
// the Full Knowledge Graph debug page. Every number here is either a plain
// count over the already-fetched records/entities/relations, or one of the
// three CLEARLY LABELLED heuristics (duplicates/orphans/suspicious) from
// lib/knowledge-graph-assembly.ts — never a new backend truth claim.
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KgHealth } from "@/lib/knowledge-graph-assembly";

function Stat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: number;
  tone?: "warn";
  title?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[92px] flex-col gap-0.5 rounded-md border px-3 py-2",
        tone === "warn" && value > 0
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border/60 bg-muted/20",
      )}
      title={title}
      data-testid={`kg-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    >
      <span className="flex items-center gap-1 text-lg font-semibold leading-none">
        {tone === "warn" && value > 0 && (
          <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        )}
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export interface KgHealthStripProps {
  health: KgHealth;
  className?: string;
}

export function KgHealthStrip({ health, className }: KgHealthStripProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
      aria-label="Knowledge graph health"
      data-testid="kg-health-strip"
    >
      <Stat label="Records" value={health.recordCount} />
      <Stat label="Active" value={health.byStatus.active ?? 0} />
      <Stat label="Superseded" value={health.byStatus.superseded ?? 0} />
      <Stat label="Expired" value={health.byStatus.expired ?? 0} />
      <Stat label="Disputed" value={health.byStatus.disputed ?? 0} />
      <Stat label="Entities" value={health.entityCount} />
      <Stat label="Relations" value={health.relationCount} />
      <Stat
        label="Entity-linked"
        value={health.recordsWithEntityLinks}
        title="Records carrying at least one entity_ids link"
      />
      <Stat
        label="Time-bound"
        value={health.recordsWithValidUntil}
        title="Records with a valid_until"
      />
      <Stat
        label="Duplicates"
        value={health.activeDuplicateRecordCount}
        tone="warn"
        title={`${health.activeDuplicateGroupCount} group(s) of active records sharing namespace+predicate+subject that should have superseded each other (heuristic)`}
      />
      <Stat
        label="Orphans"
        value={health.orphanCount}
        tone="warn"
        title="supersedes/superseded_by pointing at an id not in this fetch — may be a genuine broken link, or a since-forgotten (tombstoned) record this page doesn't fetch (heuristic, honest limitation)"
      />
      <Stat
        label="Suspicious"
        value={health.suspiciousCount}
        tone="warn"
        title="Flagged by a small heuristic (impossible calendar dates, synthetic-looking placeholder text) — worth a human glance, not a claim of error"
      />
    </div>
  );
}
