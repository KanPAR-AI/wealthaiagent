import type { NutrientTotals } from "@/types/meal-plan";
import { NutrientBar } from "./nutrient-bar";

interface DailyTotalsProps {
  totals: NutrientTotals;
  targets: NutrientTotals;
  dayName: string;
}

export function DailyTotals({ totals, targets, dayName }: DailyTotalsProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="font-semibold text-foreground mb-3">{dayName} Summary</h3>
      <div className="space-y-3">
        <NutrientBar label="Calories" actual={totals.calories} target={targets.calories} unit=" kcal" />
        <NutrientBar label="Protein" actual={totals.protein_g} target={targets.protein_g} unit="g" />
        <NutrientBar label="Carbs" actual={totals.carbs_g} target={targets.carbs_g} unit="g" />
        <NutrientBar label="Fat" actual={totals.fat_g} target={targets.fat_g} unit="g" />
      </div>
    </div>
  );
}
