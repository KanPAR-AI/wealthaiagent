// services/bug-report-service.ts — WEB SHIM over @wealthai/core.
//
// The API client moved to packages/core/src/services/bug-report-service.ts
// (shared with the Expo mobile app). This module keeps the exact public
// surface the web app has always had, and supplies the two web-only
// ingredients core deliberately takes as parameters:
//   - the Firebase ID token (web firebase init)
//   - the environment context (navigator / window / import.meta.env)

import {
  submitBugReportCore,
  listBugReportsCore,
  getBugReportCore,
  getNewBugCountCore,
  updateBugStatusCore,
  clusterBugReportsCore,
  type BugReport,
  type BugReportContext,
  type BugReportStatus,
  type BugClusterResponse,
} from '@wealthai/core';
import { ensureCoreInitialized } from '@/lib/core-adapter';
import { auth } from '@/config/firebase';

ensureCoreInitialized();

export type {
  BugReport,
  BugReportStatus,
  BugReportContext,
  BugReportMessage,
  BugReportChatSnapshot,
} from '@wealthai/core';

/** Submit a bug report. Screenshot is optional but strongly encouraged
 *  by the modal UX (users can drop / paste directly). */
export async function submitBugReport(input: {
  description: string;
  chatId?: string | null;
  screenshot?: File | null;
  selectedAgent?: string | null;
}): Promise<BugReport> {
  const token = await auth.currentUser?.getIdToken();

  // Env context — cheap to collect, high value for repro.
  const ctx: BugReportContext = {
    user_agent: navigator.userAgent,
    url: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    selected_agent: input.selectedAgent || undefined,
    // If we later expose a build sha via import.meta.env.VITE_BUILD_SHA, plug it here.
    build_sha: (import.meta as any).env?.VITE_BUILD_SHA,
  };

  return submitBugReportCore(
    token,
    {
      description: input.description,
      chatId: input.chatId,
      screenshot: input.screenshot,
    },
    ctx,
  );
}

// ── Admin ──────────────────────────────────────────────────────────

async function getToken(): Promise<string | undefined> {
  return auth.currentUser?.getIdToken();
}

export async function listBugReports(opts: { status?: BugReportStatus; limit?: number } = {}): Promise<{
  reports: BugReport[];
  total: number;
}> {
  return listBugReportsCore(await getToken(), opts);
}

export async function getBugReport(id: string): Promise<BugReport> {
  return getBugReportCore(await getToken(), id);
}

export async function getNewBugCount(): Promise<{ new: number }> {
  return getNewBugCountCore(await getToken());
}

export async function updateBugStatus(
  id: string,
  patch: { status: BugReportStatus; admin_notes?: string },
): Promise<BugReport> {
  return updateBugStatusCore(await getToken(), id, patch);
}

export async function clusterBugReports(input: {
  report_ids?: string[];
  agent?: string;
  status?: BugReportStatus;
}): Promise<BugClusterResponse> {
  return clusterBugReportsCore(await getToken(), input);
}

export type { BugCluster, BugClusterResponse } from '@wealthai/core';
