// components/memory/memory-card.tsx — MemoryCard (§8, MUI-0011).
// Fields: display label, value, status, type, namespace/domain, source,
// confidence, validity, usage count, last used, context qualifiers,
// [Inspect →]. Every field is rendered straight from the engine's
// MemoryCardView/row — this component computes no ranking/authority/
// temporal truth, only display transforms (labels, date formatting).
import { Link } from "react-router-dom";
import { ArrowRight, Pin, Tag } from "lucide-react";
import { toMemoryCardView } from "@/services/memory-engine-service";
import type { MemoryBrowserRow } from "@/hooks/memory/use-memory-browser";
import { StatusBadge } from "@/components/memory/status-badge";
import { SourceBadge } from "@/components/memory/source-badge";
import { ConfidenceIndicator } from "@/components/memory/confidence-indicator";
import { ValidityRange } from "@/components/memory/validity-range";
import { ExpandableValue } from "@/components/memory/expandable-value";
import { memoryMatchReasonLabel } from "@/lib/memory-match-reason";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  semantic: "Semantic",
  preference: "Preference",
  episodic: "Episode",
  procedural: "Procedure",
  profile: "Profile",
  relationship: "Relationship",
};

function formatLastUsed(iso: string | null | undefined): string {
  if (!iso) return "Never accessed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never accessed";
  return `Last accessed ${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

export interface MemoryCardProps {
  row: MemoryBrowserRow;
  devMode?: boolean;
  className?: string;
}

export function MemoryCard({ row, devMode = false, className }: MemoryCardProps) {
  const card = toMemoryCardView(row.memory);
  const matchReason = memoryMatchReasonLabel(row.channels, row.retrievalReason);
  const qualifierEntries = Object.entries(card.qualifiers ?? {});

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/60 p-4",
        className,
      )}
      data-testid="memory-card"
      data-memory-id={card.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {row.pinned && (
            <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />
          )}
          <h3 className="truncate text-sm font-semibold" title={card.label}>
            {card.label}
          </h3>
        </div>
        <Link
          to={`/memory/memories/${encodeURIComponent(card.id)}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Inspect <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <ExpandableValue value={card.value} />

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={card.status} />
        <SourceBadge source={card.source} />
        <ConfidenceIndicator confidence={card.confidence} devMode={devMode} />
        <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {TYPE_LABEL[card.type] ?? card.type}
        </span>
        <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {card.namespace}
        </span>
        {matchReason && (
          <span
            className="inline-flex items-center rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-xs font-medium text-primary"
            data-testid="match-reason"
          >
            Matched: {matchReason}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <ValidityRange validFrom={card.validFrom} validUntil={card.validUntil} />
        <span>·</span>
        <span data-testid="usage-count">{card.usageCount} accesses</span>
        <span>·</span>
        <span>{formatLastUsed(card.lastUsedAt)}</span>
      </div>

      {qualifierEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="qualifiers">
          <Tag className="size-3 text-muted-foreground" aria-hidden="true" />
          {qualifierEntries.map(([k, v]) => (
            <span
              key={k}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
