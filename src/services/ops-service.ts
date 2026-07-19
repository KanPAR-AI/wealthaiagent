// services/ops-service.ts — Operations page API client
// (chatservice api/v1/endpoints/prompts.py + loops.py jobs view)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function opsFetch(endpoint: string, options: RequestInit = {}) {
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
    throw new Error(body.detail || `Ops API error: ${res.status}`);
  }
  return res.json();
}

export interface PromptSummary {
  prompt_id: string;
  version: number;
  description: string;
  required_variables: string[];
  updated_by: string;
  updated_at?: string;
}

export interface PromptDetail extends PromptSummary {
  text: string;
}

export const listPrompts = (): Promise<{ prompts: PromptSummary[]; cache_ttl_seconds: number }> =>
  opsFetch(`/prompts`);

export const getPrompt = (promptId: string): Promise<{ prompt: PromptDetail }> =>
  opsFetch(`/prompts/${encodeURIComponent(promptId)}`);

export const savePrompt = (promptId: string, text: string, changeNote = "") =>
  opsFetch(`/prompts/${encodeURIComponent(promptId)}`, {
    method: "PUT",
    body: JSON.stringify({ text, change_note: changeNote }),
  });

export const listPromptVersions = (promptId: string): Promise<{ versions: any[] }> =>
  opsFetch(`/prompts/${encodeURIComponent(promptId)}/versions`);

export const restorePromptVersion = (promptId: string, version: number) =>
  opsFetch(`/prompts/${encodeURIComponent(promptId)}/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });

export const reloadPrompts = (): Promise<{ cleared: number; note: string }> =>
  opsFetch(`/prompts/reload`, { method: "POST" });

export interface LoopJob {
  job_id: string;
  type: string;
  status: string;
  attempts: number;
  worker?: string;
  created_at?: string;
  finished_at?: string;
  error?: string | null;
}

export const listJobs = (): Promise<{ jobs: LoopJob[] }> => opsFetch(`/loops/jobs`);
