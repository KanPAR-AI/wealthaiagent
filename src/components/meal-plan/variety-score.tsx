import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { VarietyScore } from "@/types/meal-plan";

interface VarietyScoreCardProps {
  varietyScore: VarietyScore;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function SubBar({ label, value, note }: { label: string; value: number; note?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">
          {pct}%{note ? ` (${note})` : ""}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function VarietyScoreCard({ varietyScore }: VarietyScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { score, breakdown, cuisine_skipped } = varietyScore;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-semibold text-foreground">Variety Score</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${scoreColor(score)}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>

      {/* Expandable breakdown */}
      {expanded && (
        <div className="mt-3 space-y-2 pt-3 border-t border-border">
          <SubBar label="Template Uniqueness" value={breakdown.template_uniqueness} />
          <SubBar
            label="Cuisine Spread"
            value={breakdown.cuisine_spread}
            note={cuisine_skipped ? "skipped" : undefined}
          />
          <SubBar label="Protein Diversity" value={breakdown.protein_diversity} />
          <SubBar label="Ingredient Coverage" value={breakdown.ingredient_coverage} />
          {cuisine_skipped && (
            <p className="text-xs text-muted-foreground mt-1">
              Cuisine spread scored at 100% (single cuisine selected).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
