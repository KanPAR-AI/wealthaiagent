// services/bug-report-service.ts
//
// Thin client for the in-app "Report an issue" feature.
// User flow: POST /api/v1/bug-reports (multipart) → 201 + BugReport.
// Admin flow: standard JSON list / get / patch endpoints under /admin.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

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

/** Submit a bug report. Screenshot is optional but strongly encouraged
 *  by the modal UX (users can drop / paste directly). */
export async function submitBugReport(input: {
  description: string;
  chatId?: string | null;
  screenshot?: File | null;
  selectedAgent?: string | null;
}): Promise<BugReport> {
  const token = await auth.currentUser?.getIdToken();

  const form = new FormData();
  form.append("description", input.description);
  if (input.chatId) form.append("chat_id", input.chatId);

  // Env context — cheap to collect, high value for repro.
  const ctx: BugReportContext = {
    user_agent: navigator.userAgent,
    url: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    selected_agent: input.selectedAgent || undefined,
    // If we later expose a build sha via import.meta.env.VITE_BUILD_SHA, plug it here.
    build_sha: (import.meta as any).env?.VITE_BUILD_SHA,
  };
  form.append("context", JSON.stringify(ctx));

  if (input.screenshot) form.append("screenshot", input.screenshot);

  // Do NOT set Content-Type — browser must set the multipart boundary.
  const res = await fetch(getApiUrl("/bug-reports"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Report failed: ${res.status}`);
  }
  return res.json();
}

// ── Admin ──────────────────────────────────────────────────────────

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
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
    throw new Error(body.detail || `Admin API error: ${res.status}`);
  }
  return res.json();
}

export async function listBugReports(opts: { status?: BugReportStatus; limit?: number } = {}): Promise<{
  reports: BugReport[];
  total: number;
}> {
  const q = new URLSearchParams();
  if (opts.status) q.append("status", opts.status);
  if (opts.limit) q.append("limit", String(opts.limit));
  const qs = q.toString();
  return adminFetch(`/bug-reports${qs ? `?${qs}` : ""}`);
}

export async function getBugReport(id: string): Promise<BugReport> {
  return adminFetch(`/bug-reports/${id}`);
}

export async function getNewBugCount(): Promise<{ new: number }> {
  return adminFetch(`/bug-reports/new-count`);
}

export async function updateBugStatus(
  id: string,
  patch: { status: BugReportStatus; admin_notes?: string },
): Promise<BugReport> {
  return adminFetch(`/bug-reports/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
