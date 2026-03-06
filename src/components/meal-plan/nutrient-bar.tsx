interface NutrientBarProps {
  label: string;
  actual: number;
  target: number;
  unit?: string;
}

export function NutrientBar({ label, actual, target, unit = "" }: NutrientBarProps) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 150) : 0;
  const displayPct = target > 0 ? Math.round((actual / target) * 100) : 0;

  let barColor = "bg-green-500";
  if (pct < 80) barColor = "bg-yellow-500";
  if (pct < 60) barColor = "bg-red-500";
  if (pct > 120) barColor = "bg-orange-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {actual}{unit} / {target}{unit} ({displayPct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
