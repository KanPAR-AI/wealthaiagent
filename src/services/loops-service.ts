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
