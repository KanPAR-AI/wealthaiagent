import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fixMealPlan } from "@/services/meal-plan-service";
import type { NutrientTotals, FixPlanSummary } from "@/types/meal-plan";

interface WeeklySummaryProps {
  averages: NutrientTotals;
  targets: NutrientTotals;
  chatId?: string;
  planId?: string;
  onFixComplete?: (plan: unknown, summary: FixPlanSummary) => void;
}

function StatusBadge({ actual, target }: { actual: number; target: number }) {
  if (target === 0) return <span className="text-muted-foreground">N/A</span>;
  const pct = Math.round((actual / target) * 100);
  let cls = "text-green-600 dark:text-green-400";
  if (pct < 85 || pct > 115) cls = "text-yellow-600 dark:text-yellow-400";
  if (pct < 70 || pct > 130) cls = "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${cls}`}>{pct}%</span>;
}

function needsFix(averages: NutrientTotals, targets: NutrientTotals): string[] {
  const issues: string[] = [];
  const check = (label: string, actual: number, target: number) => {
    if (target === 0) return;
    const pct = Math.round((actual / target) * 100);
    if (pct < 85) issues.push(`${label} is ${100 - pct}% below target`);
    else if (pct > 115) issues.push(`${label} is ${pct - 100}% above target`);
  };
  check("Protein", averages.protein_g, targets.protein_g);
  check("Carbs", averages.carbs_g, targets.carbs_g);
  check("Fat", averages.fat_g, targets.fat_g);
  check("Calories", averages.calories, targets.calories);
  return issues;
}

export function WeeklySummary({ averages, targets, chatId, planId, onFixComplete }: WeeklySummaryProps) {
  const { idToken } = useAuth();
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<FixPlanSummary | null>(null);

  const issues = needsFix(averages, targets);
  const showFixButton = issues.length > 0 && chatId && planId && onFixComplete;

  const handleFix = async () => {
    if (!idToken || !chatId || !planId || !onFixComplete) return;
    setFixing(true);
    setFixError(null);
    setLastSummary(null);
    try {
      const result = await fixMealPlan(idToken, chatId, planId);
      setLastSummary(result.fix_summary);
      onFixComplete(result.plan, result.fix_summary);
    } catch (err) {
      setFixError(err instanceof Error ? err.message : "Fix failed");
    } finally {
      setFixing(false);
    }
  };

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

      {/* Fix Plan section */}
      {showFixButton && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
            {issues.map((issue, i) => (
              <p key={i}>{issue}</p>
            ))}
          </div>
          <button
            onClick={handleFix}
            disabled={fixing}
            className="w-full text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
          >
            {fixing ? "Fixing plan..." : "Fix Plan"}
          </button>
        </div>
      )}

      {/* Fix error */}
      {fixError && (
        <p className="mt-2 text-xs text-destructive">{fixError}</p>
      )}

      {/* Fix summary */}
      {lastSummary && lastSummary.days_fixed.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-xs space-y-1">
          <p className="font-medium text-foreground">
            Fixed {lastSummary.days_fixed.length} day{lastSummary.days_fixed.length > 1 ? "s" : ""}
          </p>
          {Object.entries(lastSummary.nutrient_gaps).map(([key, info]) => {
            const label = key.replace("_g", "").charAt(0).toUpperCase() + key.replace("_g", "").slice(1);
            const beforePct = typeof info === "object" && "before_pct" in info ? Math.round(info.before_pct) : 0;
            const afterPct = typeof info === "object" && "after_pct" in info ? Math.round(info.after_pct) : 0;
            const status = typeof info === "object" && "status" in info ? info.status : "unchanged";
            if (status === "unchanged") return null;
            return (
              <p key={key} className="text-muted-foreground">
                {label}: {beforePct}% → {afterPct}%
                {status === "fixed" && <span className="text-green-600 dark:text-green-400 ml-1">fixed</span>}
                {status === "improved" && <span className="text-yellow-600 dark:text-yellow-400 ml-1">improved</span>}
              </p>
            );
          })}
          {lastSummary.supplements_suggested.length > 0 && (
            <div className="mt-1">
              <p className="font-medium text-foreground">Supplement suggestions:</p>
              {lastSummary.supplements_suggested.map((s, i) => (
                <p key={i} className="text-muted-foreground">{s}</p>
              ))}
            </div>
          )}
          {lastSummary.medical_notes.length > 0 && (
            <div className="mt-1">
              {lastSummary.medical_notes.map((n, i) => (
                <p key={i} className="text-muted-foreground italic">{n}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
