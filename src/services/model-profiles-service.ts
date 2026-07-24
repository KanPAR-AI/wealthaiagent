// services/model-profiles-service.ts — Model Gateway admin API client
// (chatservice api/v1/endpoints/model_profiles.py)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export interface ModelProfile {
  task_key: string;
  primary: string;
  fallbacks: string[];
  temperature: number;
  max_tokens: number;
  tiers: Record<string, string>;
  cache: boolean;
  description: string;
  kind: string;
  is_override?: boolean;
}

async function mpFetch(endpoint: string, options: RequestInit = {}) {
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
    throw new Error(body.detail || `Model profiles API error: ${res.status}`);
  }
  return res.json();
}

export const listModelProfiles = (): Promise<{ profiles: ModelProfile[]; known_models: string[] }> =>
  mpFetch("/model-profiles");

export const saveModelProfile = (
  taskKey: string,
  patch: Partial<Pick<ModelProfile, "primary" | "fallbacks" | "temperature" | "max_tokens" | "cache" | "description">>,
): Promise<ModelProfile> =>
  mpFetch(`/model-profiles/${encodeURIComponent(taskKey)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const reloadModelProfiles = (): Promise<{ cleared: number }> =>
  mpFetch("/model-profiles/reload", { method: "POST" });
