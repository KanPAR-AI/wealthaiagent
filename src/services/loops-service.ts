// services/loops-service.ts — Verified Procedures admin API client
// (chatservice api/v1/endpoints/loops.py)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function loopsFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Loops API error: ${res.status}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

export interface LoopSummary {
  loop_id: string;
  name: string;
  status: "draft" | "active" | "archived";
  version: number;
  trigger: string;
  updated_at?: string;
}

export interface LoopDetail {
  loop: Record<string, any>;
  problems: string[];
}

export interface RunSummary {
  run_id: string;
  status: string;
  exit_reason?: string | null;
  iteration: number;
  cost_usd: number;
  trigger: string;
  dry_run: boolean;
  created_at?: string;
  finished_at?: string | null;
}

export const compileSop = (sop: string) =>
  loopsFetch("/loops/compile", { method: "POST", body: JSON.stringify({ sop }) });

export const createLoop = (spec: Record<string, any>) =>
  loopsFetch("/loops", { method: "POST", body: JSON.stringify({ spec }) });

export const listLoops = (): Promise<{ loops: LoopSummary[] }> =>
  loopsFetch("/loops");

export const getLoop = (loopId: string): Promise<LoopDetail> =>
  loopsFetch(`/loops/${loopId}`);

export const updateLoopSpec = (
  loopId: string,
  spec: Record<string, any>,
  changeNote = "",
): Promise<LoopDetail> =>
  loopsFetch(`/loops/${loopId}/spec`, {
    method: "PUT",
    body: JSON.stringify({ spec, change_note: changeNote }),
  });

export const setLoopStatus = (loopId: string, status: string) =>
  loopsFetch(`/loops/${loopId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const deleteLoop = (loopId: string) =>
  loopsFetch(`/loops/${loopId}`, { method: "DELETE" });

export const startRun = (loopId: string, dryRun: boolean) =>
  loopsFetch(`/loops/${loopId}/runs`, {
    method: "POST",
    body: JSON.stringify({ initial_state: {}, dry_run: dryRun }),
  });

export const listRuns = (loopId: string): Promise<{ runs: RunSummary[] }> =>
  loopsFetch(`/loops/${loopId}/runs`);

// Live per-step progress over SSE. EventSource can't do POST+auth, so we read
// the fetch body stream and parse `data:` frames ourselves. onEvent gets each
// decoded event: run_started | step | status | check | awaiting_approval | done | error.
export async function streamRun(
  loopId: string,
  dryRun: boolean,
  onEvent: (ev: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin/loops/${loopId}/runs/stream`), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ initial_state: {}, dry_run: dryRun }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() || "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try { onEvent(JSON.parse(line.slice(5).trim())); } catch { /* skip partial */ }
    }
  }
}

export const getRun = (loopId: string, runId: string) =>
  loopsFetch(`/loops/${loopId}/runs/${runId}`);

export const approveRun = (loopId: string, runId: string) =>
  loopsFetch(`/loops/${loopId}/runs/${runId}/approve`, { method: "POST" });

export const rejectRun = (loopId: string, runId: string) =>
  loopsFetch(`/loops/${loopId}/runs/${runId}/reject`, { method: "POST" });

// ── Versions ────────────────────────────────────────────────────────────

export interface LoopVersion {
  version: number;
  created_by?: string;
  change_note?: string;
  created_at?: string;
}

export const listVersions = (loopId: string): Promise<{ versions: LoopVersion[] }> =>
  loopsFetch(`/loops/${loopId}/versions`);

export const restoreVersion = (loopId: string, version: number): Promise<LoopDetail> =>
  loopsFetch(`/loops/${loopId}/versions/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });

// ── Eval suites ───────────────────────────────────────────────────────────

export interface EvalCase {
  input: Record<string, any>;
  expected: string;
  focus: string;
}

export const getSuite = (
  loopId: string,
  suiteId: string,
): Promise<{ suite: { suite_id: string; cases: EvalCase[]; trials_per_case: number; pass_threshold: number } }> =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}`);

export const addCase = (loopId: string, suiteId: string, c: EvalCase) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/cases`, {
    method: "POST",
    body: JSON.stringify(c),
  });

export const updateCase = (loopId: string, suiteId: string, index: number, c: EvalCase) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/cases/${index}`, {
    method: "PUT",
    body: JSON.stringify(c),
  });

export const deleteCase = (loopId: string, suiteId: string, index: number) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/cases/${index}`, { method: "DELETE" });

export const updateSuiteSettings = (
  loopId: string,
  suiteId: string,
  settings: { trials_per_case?: number; pass_threshold?: number },
) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });

export const createSuite = (loopId: string, cases: any[], trials = 2, threshold = 0.8) =>
  loopsFetch(`/loops/${loopId}/eval-suites`, {
    method: "POST",
    body: JSON.stringify({ cases, trials_per_case: trials, pass_threshold: threshold }),
  });

export const listSuites = (loopId: string) =>
  loopsFetch(`/loops/${loopId}/eval-suites`);

export const runSuite = (loopId: string, suiteId: string) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/run`, { method: "POST" });

export const listEvalRuns = (loopId: string, suiteId: string) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/runs`);

export const getEvalRun = (loopId: string, suiteId: string, evalRunId: string) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/runs/${evalRunId}`);

// Continue a stalled eval run from its per-case checkpoint (durable evals).
export const resumeEvalRun = (loopId: string, suiteId: string, evalRunId: string) =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/runs/${evalRunId}/resume`, {
    method: "POST",
  });

// ── Regression-gated edit flow ────────────────────────────────────────────

export interface EditReview {
  assessment: string;
  issues: string[];
  improved_text: string;
  current_text: string;
}

export const reviewEdit = (
  loopId: string,
  body: { kind: "sop" | "prompt"; step_id?: string; text: string },
): Promise<EditReview> =>
  loopsFetch(`/loops/${loopId}/edit/review`, { method: "POST", body: JSON.stringify(body) });

export const runCandidateSuite = (
  loopId: string,
  suiteId: string,
  spec: Record<string, any>,
  label = "candidate",
): Promise<{ eval_run_id: string }> =>
  loopsFetch(`/loops/${loopId}/eval-suites/${suiteId}/run-candidate`, {
    method: "POST",
    body: JSON.stringify({ spec, label }),
  });

export interface RegressionReport {
  verdict: "regression" | "improved" | "no_change";
  fixed: { case_index: number; focus: string }[];
  broke: { case_index: number; focus: string }[];
  still_passing: number;
  still_failing: number;
  baseline_summary: any;
  candidate_summary: any;
}

// ── Dashboard / flywheel / integrations ──────────────────────────────────

export interface LoopsOverview {
  loops: {
    loop_id: string; name: string; status: string; version: number; trigger: string;
    active_runs: number;
    awaiting_approval: { run_id: string; created_at?: string }[];
    recent_cost_usd: number;
    last_run: { status: string; exit_reason?: string; created_at?: string } | null;
  }[];
  totals: { awaiting_approval: number; active_runs: number; recent_cost_usd: number };
}

export const getOverview = (): Promise<LoopsOverview> => loopsFetch(`/loops/overview`);

export const addRunToSuite = (
  loopId: string,
  runId: string,
  body: { suite_id?: string; expected?: string; focus?: string } = {},
): Promise<{ suite_id: string; cases: number; focus: string }> =>
  loopsFetch(`/loops/${loopId}/runs/${runId}/add-to-suite`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// AI fixer: validator problems → corrected spec preview (apply via updateLoopSpec).
export interface FixResult {
  spec: Record<string, any>;
  changes: string[];
  remaining_problems: string[];
}

export const fixLoop = (loopId: string): Promise<FixResult> =>
  loopsFetch(`/loops/${loopId}/fix`, { method: "POST" });

// Deliver an external event to a run (event-driven resume).
export const signalEvent = (
  loopId: string, runId: string, eventKey: string, payload: Record<string, any> = {},
) =>
  loopsFetch(`/loops/${loopId}/runs/${runId}/events/${encodeURIComponent(eventKey)}`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });

export const listIntegrations = (): Promise<{
  integrations: Record<string, { url: string; has_secret: boolean; type?: string; action?: string; provider?: string }>;
  discovered?: Record<string, { used_by: string[]; example_params: Record<string, any> | null }>;
  provider_options?: Record<string, string[]>;
  org_id?: string;
}> => loopsFetch(`/loops/integrations`);

export const setIntegration = (
  tool: string, url: string, secret = "", composioAction = "", nativeProvider = "",
) =>
  loopsFetch(`/loops/integrations`, {
    method: "PUT",
    body: JSON.stringify({
      tool, url, secret,
      composio_action: composioAction, native_provider: nativeProvider,
    }),
  });

export const suggestIntegration = (tool: string): Promise<{
  transport: "composio" | "webhook"; composio_action: string;
  rationale: string; field_notes: string;
}> =>
  loopsFetch(`/loops/integrations/suggest`, {
    method: "POST", body: JSON.stringify({ tool }),
  });

export const deleteIntegration = (tool: string) =>
  loopsFetch(`/loops/integrations/${encodeURIComponent(tool)}`, { method: "DELETE" });

export const compareEvalRuns = (
  loopId: string,
  suiteId: string,
  baseline: string,
  candidate: string,
): Promise<RegressionReport> =>
  loopsFetch(
    `/loops/${loopId}/eval-suites/${suiteId}/compare?baseline=${baseline}&candidate=${candidate}`,
  );
