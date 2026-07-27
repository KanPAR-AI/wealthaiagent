// services/gold-set-service.ts — judge gold-set admin API client
// (chatservice api/v1/endpoints/gold_set.py). See docs/18 §1.3.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export type Verdict = "pass" | "fail" | "unknown";

export interface Curation {
  rating: "good" | "needs_work" | "reject" | "unchecked";
  issues: string[];
  suggestions: string[];
  would_two_experts_agree: boolean;
  duplicate_of: string | null;
  error?: string;
}

export interface GoldItem {
  id: string;
  question: string;
  candidate_answer: string;
  rubric: string;
  human_verdict: Verdict;
  notes: string;
  added_by: string;
  created_at: string;
  curation?: Curation;
  judge_verdict?: Verdict | null;
}

export interface KappaResult {
  n: number;
  kappa: number | null;
  interpretation: string;
  agreement: number | null;
  judge_model: string | null;
  disagreements: { id: string; question: string; human: string; judge: string }[];
}

async function gsFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Gold set API error: ${res.status}`);
  }
  return res.json();
}

export interface GoldItemInput {
  question: string;
  candidate_answer: string;
  human_verdict: Verdict;
  rubric?: string;
  notes?: string;
}

export const listGoldItems = (): Promise<{
  items: GoldItem[]; count: number; by_verdict: Record<string, number>;
}> => gsFetch("/gold-set");

/** AI review of a proposed example. Advisory — the caller may save anyway. */
export const curateGoldItem = (body: GoldItemInput): Promise<Curation> =>
  gsFetch("/gold-set/curate", { method: "POST", body: JSON.stringify(body) });

export const addGoldItem = (
  body: GoldItemInput & { curation?: Curation | null },
): Promise<GoldItem> =>
  gsFetch("/gold-set", { method: "POST", body: JSON.stringify(body) });

export const deleteGoldItem = (id: string) =>
  gsFetch(`/gold-set/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Grades every labelled item with the real judge — costs one judge call per
 *  item, so it is an explicit button, not something the list does on load. */
export const runKappa = (): Promise<KappaResult> =>
  gsFetch("/gold-set/kappa", { method: "POST" });
