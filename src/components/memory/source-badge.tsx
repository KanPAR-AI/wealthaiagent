// components/memory/source-badge.tsx — SourceBadge (§8, MUI-0012).
//
// Maps the engine's SourceType enum to the six display categories UI_SPEC
// §8 names (Explicit/Verified/Observed/Inferred/Consolidated/System). This
// is a presentation-only relabeling — provenance itself (which source_type
// a record actually has) is an engine field, never computed here.
//
// "Explicit must visually outrank inferred" (memory-ui skill): Explicit
// renders as a solid, filled badge; Inferred renders as a muted outline —
// same tooltip affordance, visibly different weight. Every variant pairs
// its color with an icon AND text (never color-only).
import {
  BadgeCheck, Eye, FileCheck2, Layers, Server, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SourceType } from "@/services/memory-engine-service";

type SourceCategory = "explicit" | "verified" | "observed" | "inferred" | "consolidated" | "system";

const CATEGORY_OF: Record<SourceType, SourceCategory> = {
  user_explicit: "explicit",
  user_observed: "observed",
  tool_verified: "verified",
  document_verified: "verified",
  agent_inference: "inferred",
  episode_consolidation: "consolidated",
  system: "system",
};

const CATEGORY_META: Record<
  SourceCategory,
  { label: string; Icon: typeof BadgeCheck; className: string; tooltip: string }
> = {
  explicit: {
    label: "Explicit",
    Icon: BadgeCheck,
    // Solid/filled — the highest-authority visual weight in the set.
    className: "border-primary bg-primary text-primary-foreground",
    tooltip: "The user stated this directly.",
  },
  verified: {
    label: "Verified",
    Icon: FileCheck2,
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    tooltip: "Confirmed by a tool result or a document, not stated directly.",
  },
  observed: {
    label: "Observed",
    Icon: Eye,
    className: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-400",
    tooltip: "Noticed from the user's behavior, not stated directly.",
  },
  consolidated: {
    label: "Consolidated",
    Icon: Layers,
    className: "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-400",
    tooltip: "Summarized from a completed episode/run.",
  },
  inferred: {
    label: "Inferred",
    Icon: Sparkles,
    // Muted outline — deliberately lower visual weight than Explicit.
    className: "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground",
    tooltip: "The system's best guess — not confirmed by the user.",
  },
  system: {
    label: "System",
    Icon: Server,
    className: "border-border bg-muted text-muted-foreground",
    tooltip: "Set by the platform, not attributed to the user.",
  },
};

/** Per-source_type tooltip detail, one level more specific than the
 *  category tooltip (e.g. distinguishing Tool- vs Document-verified). */
const SOURCE_DETAIL: Record<SourceType, string> = {
  user_explicit: "The user stated this directly.",
  user_observed: "Noticed from the user's behavior, not stated directly.",
  tool_verified: "Confirmed by a tool result (e.g. a booking, a calculation).",
  document_verified: "Confirmed by an uploaded document.",
  agent_inference: "The system's best guess — not confirmed by the user.",
  episode_consolidation: "Summarized from a completed episode/run.",
  system: "Set by the platform, not attributed to the user.",
};

export interface SourceBadgeProps {
  source: SourceType;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const category = CATEGORY_OF[source];
  const meta = CATEGORY_META[category];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              meta.className,
              className,
            )}
            data-testid="source-badge"
            data-source={source}
            data-category={category}
            tabIndex={0}
          >
            <meta.Icon className="size-3" aria-hidden="true" />
            <span>{meta.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{SOURCE_DETAIL[source]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
