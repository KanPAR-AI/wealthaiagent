import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyBreakdown } from "@/services/admin-service";

export function CostChart({ data }: { data: DailyBreakdown[] }) {
  // Sort chronologically and format dates
  const chartData = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      dateLabel: d.date.slice(5), // "02-28" from "2026-02-28"
      cost: Number(d.cost_usd.toFixed(4)),
    }));

  return (
    <Card>
      <CardContent className="pt-4">
        <h4 className="text-sm font-medium mb-3">Daily Cost</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Bar
                dataKey="cost"
                fill="oklch(0.55 0.18 250)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
