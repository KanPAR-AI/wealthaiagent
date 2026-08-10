// components/memory/status-badge.tsx — StatusPill/StatusBadge (§52, MUI-0050).
//
// Status is never color-only (accessibility skill, UI_SPEC §52-54): every
// variant pairs an icon AND a text label with the color. The status itself
// is an ENGINE output (MemoryRecord.status) — this component only maps that
// enum to a fixed presentation; it never derives or infers a status.
import { AlertTriangle, CheckCircle2, Clock, History, Trash2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { MemoryStatus } from "@/services/memory-engine-service";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        superseded: "border-zinc-400/30 bg-zinc-400/10 text-zinc-500 dark:text-zinc-400",
        disputed: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        expired: "border-zinc-400/30 bg-zinc-400/10 text-zinc-500 dark:text-zinc-400",
        deleted: "border-destructive/30 bg-destructive/10 text-destructive opacity-80",
      } satisfies Record<MemoryStatus, string>,
    },
  },
);

const STATUS_META: Record<MemoryStatus, { label: string; Icon: typeof CheckCircle2 }> = {
  active: { label: "Active", Icon: CheckCircle2 },
  superseded: { label: "Superseded", Icon: History },
  disputed: { label: "Disputed", Icon: AlertTriangle },
  expired: { label: "Expired", Icon: Clock },
  deleted: { label: "Deleted", Icon: Trash2 },
};

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  status: MemoryStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      data-testid="status-badge"
      data-status={status}
    >
      <meta.Icon className="size-3" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}
