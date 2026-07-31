// Admin → Latency. Per-step timing across turns and conversations.
//
// TTFT IS THE HEADLINE, not total. A turn that starts streaming in 400ms and
// finishes in 9s feels fast; one silent for 4s and done in 5s feels broken.
// "Drafting response…" is on screen for exactly the TTFT window, so it is the
// first number on the page.
//
// Every figure is a percentile. The mean is the most misleading number in a
// chat product: one 30s turn among fifty 2s turns barely moves it.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Clock, AlertTriangle } from "lucide-react";
import {
  fetchLatency,
  type LatencyDashboard,
  type StageRow,
  type Summary,
} from "@/services/latency-service";

const ms = (v: number | null) =>
  v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;

/** Colour by felt experience, not by arbitrary thresholds: under a second is
 *  imperceptible, 1–3s is noticeable, past 3s people wonder if it broke. */
const tone = (v: number | null) =>
  v === null ? "text-muted-foreground"
    : v < 1000 ? "text-emerald-600 dark:text-emerald-400"
    : v < 3000 ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";

function Percentiles({ s, label, hint }: { s: Summary; label: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">n={s.n}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {(["p50", "p95", "p99", "max"] as const).map((k) => (
          <div key={k}>
            <div className={`text-lg font-semibold ${tone(s[k])}`}>{ms(s[k])}</div>
            <div className="text-[11px] text-muted-foreground">{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageBars({ rows, title, note }: { rows: StageRow[]; title: string; note: string }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No stage timings recorded yet.</p>;
  }
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{note}</p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.stage} className="flex items-center gap-2 text-xs">
            <span className="w-44 shrink-0 font-medium truncate" title={r.stage}>
              {r.stage}
            </span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${Math.max(1, r.share_pct)}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums">{r.share_pct}%</span>
            <span className="w-16 text-right text-muted-foreground tabular-nums">
              {ms(r.max)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        * <code>model_first_token*</code> is derived — TTFT minus every measured
        stage. It is prompt assembly plus the model's own thinking time.
      </p>
    </div>
  );
}

export function LatencyView() {
  const [data, setData] = useState<LatencyDashboard | null>(null);
  const [hours, setHours] = useState(24);
  const [dimension, setDimension] = useState("agent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchLatency({ hours, dimension }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [hours, dimension]);

  useEffect(() => { void load(); }, [load]);

  const thin = !!data && data.turns < data.min_samples_for_tail;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock size={14} /> Latency
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value={1}>Last hour</option>
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {(data?.dimensions || ["agent"]).map((d) => (
              <option key={d} value={d}>group by {d}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">
              {data.turns} turns · {data.conversations} conversations · {data.error_rate}% errors
            </span>
          )}
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {thin && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-4 flex gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Not enough turns for tail percentiles</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                p95/p99 need at least {data?.min_samples_for_tail} turns in the
                window. A p99 over a handful of turns is just the slowest one
                wearing a lab coat — so those cells show “—” rather than a
                number you'd act on. <code>max</code> is always real.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <Percentiles
              s={data.ttft}
              label="Time to first token"
              hint="What the user feels — the “Drafting response…” window."
            />
          </div>
          <div className="md:col-span-1">
            <Percentiles s={data.total} label="Total turn" hint="Start to last token." />
          </div>
          <div className="md:col-span-1">
            <Percentiles
              s={data.per_conversation_ms}
              label="Per conversation"
              hint="Cumulative wait across a whole chat."
            />
          </div>
        </div>
      )}

      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap size={14} /> Where the time goes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <StageBars
              rows={data.slow_turn_stages}
              title="On the slowest turns (p95+)"
              note="Attribution over the slow tail only. The fast majority dilutes whichever stage actually causes the tail, so averaging over all turns hides it."
            />
            <StageBars
              rows={data.all_turn_stages}
              title="Across all turns"
              note="The typical shape, for comparison."
            />
          </CardContent>
        </Card>
      )}

      {data && !!data.by_dimension.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">By {data.dimension} — worst first</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 font-medium">{data.dimension}</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Turns</th>
                  <th className="text-right py-1.5 pr-3 font-medium">TTFT p50</th>
                  <th className="text-right py-1.5 pr-3 font-medium">TTFT p95</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Total p95</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Total max</th>
                  <th className="text-right py-1.5 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.by_dimension.map((r) => (
                  <tr key={r.value} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 font-medium">{r.value}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.turns}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${tone(r.ttft.p50)}`}>
                      {ms(r.ttft.p50)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${tone(r.ttft.p95)}`}>
                      {ms(r.ttft.p95)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${tone(r.total.p95)}`}>
                      {ms(r.total.p95)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {ms(r.total.max)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {r.error_rate > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {r.error_rate}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
