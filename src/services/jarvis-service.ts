// services/jarvis-service.ts — "Ask Jarvis" admin assistant API client
// (chatservice api/v1/endpoints/assistant.py)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function jarvisFetch(endpoint: string, options: RequestInit = {}) {
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
    throw new Error(body.detail || `Jarvis API error: ${res.status}`);
  }
  return res.json();
}

export interface JarvisContext {
  page?: string;
  section?: string;
  tab?: string;
  loop_id?: string | null;
  agent_id?: string | null;
  visible_problems?: string[];
}

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
}

export const askJarvis = (
  question: string,
  context: JarvisContext = {},
  history: JarvisMessage[] = [],
): Promise<{ answer: string }> =>
  jarvisFetch(`/assistant`, {
    method: "POST",
    body: JSON.stringify({ question, context, history }),
  });

export const listKbAreas = (): Promise<{
  areas: { area: string; source: string; version?: number }[];
  cache_ttl_seconds: number;
}> => jarvisFetch(`/assistant/kb`);

export const refreshKb = (): Promise<{ cleared: number; note: string }> =>
  jarvisFetch(`/assistant/kb/refresh`, { method: "POST" });
