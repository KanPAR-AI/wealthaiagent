import { useMealPlanStore } from "@/store/meal-plan";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayTabs() {
  const { plan, selectedDay, setSelectedDay } = useMealPlanStore();
  if (!plan) return null;

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {plan.days.map((day, i) => (
        <button
          key={day.day}
          onClick={() => setSelectedDay(i)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
            ${selectedDay === i
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
            }
          `}
        >
          {DAY_SHORT[i] || day.day.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}
