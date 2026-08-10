// components/memory/confidence-indicator.tsx — ConfidenceIndicator
// (COMPONENT_MODEL's "ConfidenceBadge", §8, MUI-0013).
//
// Buckets are FIXED thresholds from the spec (High >=.90, Medium .70-.89,
// Low <.70) — a pure presentation bucketing of the engine's own
// `confidence` float, never a recomputation of confidence itself
// (STATE_MODEL "what the client must not compute"). The raw number is
// developer-mode only, behind an explicit prop the caller derives from
// `memory.read_raw` (dev/admin) — never shown by default.
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfidenceBucket = "high" | "medium" | "low";

export function bucketConfidence(confidence: number): ConfidenceBucket {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

const BUCKET_META: Record<ConfidenceBucket, { label: string; className: string }> = {
  high: { label: "High", className: "text-emerald-600 dark:text-emerald-400" },
  medium: { label: "Medium", className: "text-amber-600 dark:text-amber-400" },
  low: { label: "Low", className: "text-red-600 dark:text-red-400" },
};

export interface ConfidenceIndicatorProps {
  confidence: number;
  /** Dev-mode raw number display. Caller gates this on `memory.read_raw`
   *  (or an explicit dev toggle) — this component never reads permissions
   *  itself, it only renders what it's told. */
  devMode?: boolean;
  className?: string;
}

export function ConfidenceIndicator({ confidence, devMode = false, className }: ConfidenceIndicatorProps) {
  const bucket = bucketConfidence(confidence);
  const meta = BUCKET_META[bucket];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.className, className)}
      data-testid="confidence-indicator"
      data-bucket={bucket}
    >
      <Circle className="size-2 fill-current" aria-hidden="true" />
      <span>
        {meta.label} confidence
        {devMode ? ` (${confidence.toFixed(2)})` : ""}
      </span>
    </span>
  );
}
