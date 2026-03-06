import type { MealPlanMeal } from "@/types/meal-plan";

const MEAL_TYPE_LABELS: Record<string, string> = {
  early_morning: "Early Morning",
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
};

interface MealCardProps {
  meal: MealPlanMeal;
  dayIndex: number;
  mealIndex: number;
  onSwapClick: (dayIndex: number, mealIndex: number) => void;
}

export function MealCard({ meal, dayIndex, mealIndex, onSwapClick }: MealCardProps) {
  const label = MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-medium text-primary uppercase tracking-wider">{label}</span>
          <h4 className="font-semibold text-foreground mt-0.5">{meal.name}</h4>
        </div>
        <button
          onClick={() => onSwapClick(dayIndex, mealIndex)}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-all font-medium text-muted-foreground hover:text-primary"
        >
          Swap
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="pb-1 font-medium">Item</th>
              <th className="pb-1 font-medium text-right">g</th>
              <th className="pb-1 font-medium text-right">Cal</th>
              <th className="pb-1 font-medium text-right">P</th>
              <th className="pb-1 font-medium text-right">C</th>
              <th className="pb-1 font-medium text-right">F</th>
            </tr>
          </thead>
          <tbody>
            {meal.items.map((item, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="py-1 text-foreground">
                  {item.name}
                  {item.source === "estimated" && <span className="text-muted-foreground"> ~</span>}
                </td>
                <td className="py-1 text-right text-muted-foreground">{Math.round(item.grams)}</td>
                <td className="py-1 text-right">{item.calories}</td>
                <td className="py-1 text-right">{item.protein_g.toFixed(1)}</td>
                <td className="py-1 text-right">{item.carbs_g.toFixed(1)}</td>
                <td className="py-1 text-right">{item.fat_g.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="pt-1">Total</td>
              <td className="pt-1 text-right"></td>
              <td className="pt-1 text-right">{meal.total_calories}</td>
              <td className="pt-1 text-right">{meal.total_protein_g.toFixed(1)}g</td>
              <td className="pt-1 text-right">{meal.total_carbs_g.toFixed(1)}g</td>
              <td className="pt-1 text-right">{meal.total_fat_g.toFixed(1)}g</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {meal.prep_notes && (
        <p className="mt-2 text-xs text-muted-foreground italic">{meal.prep_notes}</p>
      )}
    </div>
  );
}
