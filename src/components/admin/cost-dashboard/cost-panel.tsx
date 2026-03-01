import { useEffect, useCallback } from "react";
import { DollarSign, MessageSquare, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAdminStore } from "@/store/admin";
import { fetchCosts } from "@/services/admin-service";
import { toast } from "sonner";
import { CostChart } from "./cost-chart";

export function CostPanel({ agentId }: { agentId: string }) {
  const { costData, costPeriod, setCostData, setCostPeriod, loading, setLoading } =
    useAdminStore();

  const loadCosts = useCallback(async () => {
    setLoading("costs", true);
    try {
      const data = await fetchCosts(agentId, costPeriod);
      setCostData(data);
    } catch (err: unknown) {
      toast.error("Failed to load cost data", { description: (err as Error).message });
    } finally {
      setLoading("costs", false);
    }
  }, [agentId, costPeriod, setCostData, setLoading]);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  const periods = [
    { label: "1 Day", value: "1d" as const },
    { label: "7 Days", value: "7d" as const },
    { label: "30 Days", value: "30d" as const },
  ];

  const summary = costData?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cost Dashboard</h3>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setCostPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                costPeriod === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {loading["costs"] ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare size={14} />
                <span className="text-xs font-medium">Requests</span>
              </div>
              <p className="text-2xl font-bold">
                {summary?.total_requests.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap size={14} />
                <span className="text-xs font-medium">Tokens</span>
              </div>
              <p className="text-2xl font-bold">
                {summary?.total_tokens
                  ? (summary.total_tokens / 1000).toFixed(1) + "K"
                  : "0"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign size={14} />
                <span className="text-xs font-medium">Cost</span>
              </div>
              <p className="text-2xl font-bold">
                ${summary?.total_cost_usd?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Model breakdown */}
      {summary?.by_model && Object.keys(summary.by_model).length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-medium mb-3">Cost by Model</h4>
            <div className="space-y-2">
              {Object.entries(summary.by_model).map(([model, stats]) => (
                <div
                  key={model}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {model}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {stats.requests} req
                    </span>
                    <span className="font-medium">
                      ${stats.cost_usd.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily chart */}
      {costData?.daily_breakdown && costData.daily_breakdown.length > 0 && (
        <CostChart data={costData.daily_breakdown} />
      )}
    </div>
  );
}
