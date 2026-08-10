// components/memory/expandable-value.tsx — ExpandableValue (§8, UI-32).
// Long memory values stay STABLE (never reflow the rest of the card
// unexpectedly) and are collapsed by default with an explicit, keyboard-
// operable toggle — never a hover-only affordance. Purely a display
// concern: this never truncates/normalizes the VALUE the engine returned
// (memory-spec: render the engine's own value, quoted/inert if untrusted —
// UntrustedText is a separate, security-critical component for evidence
// text; this component handles the memory's own structured `value`).
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSE_THRESHOLD = 140;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export interface ExpandableValueProps {
  value: unknown;
  className?: string;
}

export function ExpandableValue({ value, className }: ExpandableValueProps) {
  const [expanded, setExpanded] = useState(false);
  const text = stringifyValue(value);
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const shown = expanded || !isLong ? text : `${text.slice(0, COLLAPSE_THRESHOLD)}…`;

  return (
    <div className={cn("min-w-0", className)} data-testid="expandable-value">
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-sm",
          !expanded && isLong && "line-clamp-3",
        )}
      >
        {shown}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="size-3" aria-hidden="true" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="size-3" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
