import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMealPlanStore } from "@/store/meal-plan";
import { formatWeekLabel } from "./date-utils";

interface WeekNavProps {
  totalWeeks: number;
  onWeekChange: (week: number) => void;
}

export function WeekNav({ totalWeeks, onWeekChange }: WeekNavProps) {
  const { plan, currentWeek, weekLoading, planGroupCreatedAt } = useMealPlanStore();

  // Use week 1's created_at as base for date calculations
  const baseCreatedAt = planGroupCreatedAt ?? plan?.created_at;
  if (!baseCreatedAt) return null;

  const label = formatWeekLabel(baseCreatedAt, currentWeek, totalWeeks);

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button
        onClick={() => onWeekChange(currentWeek - 1)}
        disabled={currentWeek <= 1 || weekLoading}
        className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-sm font-medium text-foreground min-w-[220px] text-center">
        {weekLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating week {currentWeek}...
          </span>
        ) : (
          label
        )}
      </span>

      <button
        onClick={() => onWeekChange(currentWeek + 1)}
        disabled={currentWeek >= totalWeeks || weekLoading}
        className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
