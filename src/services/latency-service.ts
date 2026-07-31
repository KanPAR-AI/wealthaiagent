// services/latency-service.ts — per-step latency admin API client
// (chatservice api/v1/endpoints/turn_metrics.py).

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

/** p50/p95/p99 with n. Tail values are NULL when the sample is too small to
 *  support them — the UI must say "not enough data" rather than draw a
 *  confident line through noise. */
export interface Summary {
  n: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  max: number | null;
}

export interface StageRow extends Summary {
  stage: string;
  share_pct: number;
}

export interface DimensionRow {
  value: string;
  turns: number;
  ttft: Summary;
  total: Summary;
  error_rate: number;
}

export interface LatencyDashboard {
  window_hours: number;
  turns: number;
  conversations: number;
  /** Time to first token — what the user feels while "Drafting response…" is
   *  on screen. Deliberately separate from total. */
  ttft: Summary;
  total: Summary;
  per_conversation_ms: Summary;
  error_rate: number;
  dimension: string;
  by_dimension: DimensionRow[];
  /** Stage shares computed over the SLOW tail only — "p95 is 8s" is not
   *  actionable, "71% of it is retrieval" is. */
  slow_turn_stages: StageRow[];
  all_turn_stages: StageRow[];
  dimensions: string[];
  min_samples_for_tail: number;
}

export const fetchLatency = async (
  opts: { hours?: number; dimension?: string; agent?: string } = {},
): Promise<LatencyDashboard> => {
  const token = await auth.currentUser?.getIdToken();
  const q = new URLSearchParams();
  q.set("hours", String(opts.hours ?? 24));
  q.set("dimension", opts.dimension ?? "agent");
  if (opts.agent) q.set("agent", opts.agent);

  const res = await fetch(getApiUrl(`/admin/latency?${q.toString()}`), {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Latency API error: ${res.status}`);
  }
  return res.json();
};
