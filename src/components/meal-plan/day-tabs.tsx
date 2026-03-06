import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMealPlanStore } from "@/store/meal-plan";
import { buildDayTabInfos, type DayTabInfo } from "./date-utils";

export function DayTabs() {
  const { plan, selectedDay, setSelectedDay } = useMealPlanStore();

  const dayInfos = useMemo(() => {
    if (!plan?.created_at) return null;
    return buildDayTabInfos(plan.created_at);
  }, [plan?.created_at]);

  if (!plan || !dayInfos) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {dayInfos.map((info) => (
        <DayCell
          key={info.index}
          info={info}
          isSelected={selectedDay === info.index}
          onSelect={() => setSelectedDay(info.index)}
        />
      ))}
    </div>
  );
}

interface DayCellProps {
  info: DayTabInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function DayCell({ info, isSelected, onSelect }: DayCellProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center justify-center",
        "min-w-[3.25rem] flex-1 py-2 px-2 rounded-xl transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isSelected && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
        info.isToday && !isSelected && "ring-2 ring-primary/40 bg-primary/5",
        !isSelected && !info.isToday && "bg-muted/60 text-muted-foreground hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "text-[0.65rem] font-medium uppercase tracking-wider",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {info.dayAbbr}
      </span>

      <span
        className={cn(
          "text-lg font-bold leading-tight mt-0.5",
          isSelected && "text-primary-foreground",
          info.isToday && !isSelected && "text-primary",
          !isSelected && !info.isToday && "text-foreground",
        )}
      >
        {info.dateNum}
      </span>

      <div className="h-1.5 mt-0.5">
        {info.isToday && (
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isSelected ? "bg-primary-foreground" : "bg-primary",
            )}
          />
        )}
      </div>
    </button>
  );
}
