// Bug-report API client — shared by web and mobile.
//
// Ported from the web app's src/services/bug-report-service.ts with the
// platform couplings hoisted to parameters:
//   - `token` is passed in (web: firebase auth.currentUser.getIdToken();
//     mobile: the same call against its own firebase init).
//   - `context` is collected by the caller (web: navigator/window/
//     import.meta; mobile: expo-device / expo-constants).
//   - `screenshot` accepts a Blob (web File) or React Native's
//     { uri, name, type } file descriptor — both are valid FormData parts
//     on their respective platforms.

import { getPlatform } from '../platform';

export type BugReportStatus = "new" | "in_progress" | "resolved" | "wont_fix";

export interface BugReportContext {
  user_agent?: string;
  url?: string;
  viewport?: string;
  build_sha?: string;
  selected_agent?: string;
}

export interface BugReportMessage {
  id: string;
  sender: string;
  content: string;
  timestamp?: string;
  attachments?: string[];
}

export interface BugReportChatSnapshot {
  chat_id: string;
  chat_title?: string;
  last_agent_type?: string;
  messages: BugReportMessage[];
}

export interface BugReport {
  id: string;
  user_id: string;
  user_email?: string;
  user_display_name?: string;
  description: string;
  chat_id?: string;
  screenshot_url?: string;
  context?: BugReportContext;
  chat_snapshot?: BugReportChatSnapshot;
  status: BugReportStatus;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

/** A set of reports sharing one root cause (bug-fix automation, Phase 1). */
export interface BugCluster {
  id: string;
  title: string;
  root_cause: string;
  report_ids: string[];
  suspected_area?: string;
  confidence: number;
}

export interface BugClusterResponse {
  clusters: BugCluster[];
  degraded: boolean;
}

// ── Batched bug-fix runner (Phase 2) ────────────────────────────────

export type FixTaskStatus = "queued" | "running" | "pr_open" | "done" | "failed";
export type FixJobStatus = "queued" | "running" | "completed" | "failed";

export interface FixTaskEvent {
  ts: string;
  kind: string;
  text: string;
}

export interface FixTask {
  cluster_id: string;
  title: string;
  root_cause: string;
  report_ids: string[];
  suspected_area?: string;
  instruction: string;
  status: FixTaskStatus;
  branch?: string;
  pr_url?: string;
  pr_urls?: string[];
  error?: string;
  events: FixTaskEvent[];
  updated_at?: string;
}

export interface FixJob {
  id: string;
  created_by: string;
  status: FixJobStatus;
  tasks: FixTask[];
  created_at: string;
  updated_at?: string;
}

/** Web passes a File/Blob; React Native passes { uri, name, type }. */
export type BugReportScreenshot = Blob | { uri: string; name: string; type: string };

export async function submitBugReportCore(
  token: string | undefined,
  input: {
    description: string;
    chatId?: string | null;
    screenshot?: BugReportScreenshot | null;
  },
  context: BugReportContext,
): Promise<BugReport> {
  const platform = getPlatform();
  const { getApiUrl } = platform;
  // Multipart: prefer the adapter's uploadFetch (RN-native {uri} parts).
  const fetch = platform.uploadFetch ?? platform.fetch;

  const form = new FormData();
  form.append("description", input.description);
  if (input.chatId) form.append("chat_id", input.chatId);
  form.append("context", JSON.stringify(context));
  // RN's FormData accepts {uri,name,type} descriptors; the DOM lib types
  // only know Blob — the cast is the documented cross-platform seam.
  if (input.screenshot) form.append("screenshot", input.screenshot as Blob);

  // Do NOT set Content-Type — the platform must set the multipart boundary.
  const res = await fetch(getApiUrl("/bug-reports"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).detail || `Report failed: ${res.status}`);
  }
  return res.json();
}

// ── Admin ──────────────────────────────────────────────────────────

async function adminFetch(token: string | undefined, path: string, options: RequestInit = {}) {
  const { fetch, getApiUrl } = getPlatform();
  const res = await fetch(getApiUrl(`/admin${path}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as any).detail || `Admin API error: ${res.status}`);
  }
  return res.json();
}

export async function listBugReportsCore(
  token: string | undefined,
  opts: { status?: BugReportStatus; limit?: number } = {},
): Promise<{ reports: BugReport[]; total: number }> {
  const q = new URLSearchParams();
  if (opts.status) q.append("status", opts.status);
  if (opts.limit) q.append("limit", String(opts.limit));
  const qs = q.toString();
  return adminFetch(token, `/bug-reports${qs ? `?${qs}` : ""}`);
}

export async function getBugReportCore(token: string | undefined, id: string): Promise<BugReport> {
  return adminFetch(token, `/bug-reports/${id}`);
}

export async function getNewBugCountCore(token: string | undefined): Promise<{ new: number }> {
  return adminFetch(token, `/bug-reports/new-count`);
}

export async function updateBugStatusCore(
  token: string | undefined,
  id: string,
  patch: { status: BugReportStatus; admin_notes?: string },
): Promise<BugReport> {
  return adminFetch(token, `/bug-reports/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Group selected reports by root cause (bug-fix automation, Phase 1).
 *  Pass explicit report_ids (the multi-selection) or an agent+status filter. */
export async function clusterBugReportsCore(
  token: string | undefined,
  input: { report_ids?: string[]; agent?: string; status?: BugReportStatus },
): Promise<BugClusterResponse> {
  return adminFetch(token, `/bug-reports/cluster`, {
    method: "POST",
    body: JSON.stringify({
      report_ids: input.report_ids ?? [],
      agent: input.agent,
      status: input.status,
    }),
  });
}

/** Cluster the selected reports and enqueue a fix job (Phase 2). */
export async function launchFixBatchCore(
  token: string | undefined,
  input: { report_ids?: string[]; agent?: string; status?: BugReportStatus },
): Promise<FixJob> {
  return adminFetch(token, `/bug-reports/fix-batch`, {
    method: "POST",
    body: JSON.stringify({
      report_ids: input.report_ids ?? [],
      agent: input.agent,
      status: input.status,
    }),
  });
}

/** Poll one fix job to attach to its live transcript (Phase 2). */
export async function getFixJobCore(token: string | undefined, id: string): Promise<FixJob> {
  return adminFetch(token, `/fix-jobs/${id}`);
}

export async function listFixJobsCore(
  token: string | undefined,
  limit = 50,
): Promise<{ jobs: FixJob[] }> {
  return adminFetch(token, `/fix-jobs?limit=${limit}`);
}
