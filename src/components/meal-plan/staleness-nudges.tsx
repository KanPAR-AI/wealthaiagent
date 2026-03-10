import { AlertTriangle } from "lucide-react";
import type { StalenessNudge } from "@/types/meal-plan";

interface StalenessNudgesProps {
  nudges: StalenessNudge[];
}

export function StalenessNudges({ nudges }: StalenessNudgesProps) {
  if (!nudges.length) return null;

  return (
    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm">
          Repeated Meals
        </h3>
      </div>
      <ul className="space-y-1">
        {nudges.map((nudge) => (
          <li
            key={nudge.template_id}
            className="text-sm text-yellow-700 dark:text-yellow-300"
          >
            {nudge.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
