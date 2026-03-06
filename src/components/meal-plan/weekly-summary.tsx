import type { NutrientTotals } from "@/types/meal-plan";

interface WeeklySummaryProps {
  averages: NutrientTotals;
  targets: NutrientTotals;
}

function StatusBadge({ actual, target }: { actual: number; target: number }) {
  if (target === 0) return <span className="text-muted-foreground">N/A</span>;
  const pct = Math.round((actual / target) * 100);
  let cls = "text-green-600 dark:text-green-400";
  if (pct < 85 || pct > 115) cls = "text-yellow-600 dark:text-yellow-400";
  if (pct < 70 || pct > 130) cls = "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${cls}`}>{pct}%</span>;
}

export function WeeklySummary({ averages, targets }: WeeklySummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="font-semibold text-foreground mb-3">Weekly Averages</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="pb-2 font-medium">Nutrient</th>
            <th className="pb-2 font-medium text-right">Avg</th>
            <th className="pb-2 font-medium text-right">Target</th>
            <th className="pb-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/50">
            <td className="py-1.5">Calories</td>
            <td className="py-1.5 text-right">{averages.calories}</td>
            <td className="py-1.5 text-right text-muted-foreground">{targets.calories}</td>
            <td className="py-1.5 text-right"><StatusBadge actual={averages.calories} target={targets.calories} /></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-1.5">Protein</td>
            <td className="py-1.5 text-right">{averages.protein_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right text-muted-foreground">{targets.protein_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right"><StatusBadge actual={averages.protein_g} target={targets.protein_g} /></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-1.5">Carbs</td>
            <td className="py-1.5 text-right">{averages.carbs_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right text-muted-foreground">{targets.carbs_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right"><StatusBadge actual={averages.carbs_g} target={targets.carbs_g} /></td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="py-1.5">Fat</td>
            <td className="py-1.5 text-right">{averages.fat_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right text-muted-foreground">{targets.fat_g.toFixed(1)}g</td>
            <td className="py-1.5 text-right"><StatusBadge actual={averages.fat_g} target={targets.fat_g} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
