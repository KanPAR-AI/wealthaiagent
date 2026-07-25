// home-service.ts — server-configured home suggestion tiles (campaigns).
//
// Public read (/home/suggestions) used by the chat empty state, plus admin
// CRUD (/admin/home/campaigns/*) used by the Campaigns dashboard tab. Same
// hot-config discipline as the Prompt Registry: change the tiles / run a
// campaign / open one for testing with no redeploy.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export interface HomeTile {
  text: string;
  agent?: string | null; // null = smart routing; else lock the tile to an agent
}

export interface HomeSuggestions {
  tiles: HomeTile[];
  campaign_id: string | null;
  campaign_name?: string;
}

export interface Campaign {
  campaign_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  audience: "all" | "test";
  test_emails: string[];
  starts_at: string | null;
  ends_at: string | null;
  tiles: HomeTile[];
  updated_at?: string;
  updated_by?: string;
}

async function authFetch(url: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Home API error: ${res.status}`);
  }
  return res.json();
}

// --- Public: resolve tiles for the current user (campaign-aware) ---
export const getHomeSuggestions = (previewCampaignId?: string): Promise<HomeSuggestions> =>
  authFetch(
    getApiUrl(`/home/suggestions${previewCampaignId ? `?preview=${encodeURIComponent(previewCampaignId)}` : ""}`),
  );

// --- Admin: campaign CRUD ---
export const listCampaigns = (): Promise<{
  campaigns: Campaign[];
  default_template: Campaign;
}> => authFetch(getApiUrl("/admin/home/campaigns"));

export const getCampaign = (id: string): Promise<Campaign> =>
  authFetch(getApiUrl(`/admin/home/campaigns/${encodeURIComponent(id)}`));

export const saveCampaign = (id: string, patch: Partial<Campaign>): Promise<Campaign> =>
  authFetch(getApiUrl(`/admin/home/campaigns/${encodeURIComponent(id)}`), {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const deleteCampaign = (id: string): Promise<{ deleted: boolean }> =>
  authFetch(getApiUrl(`/admin/home/campaigns/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });

export const reloadCampaigns = (): Promise<{ cleared: number }> =>
  authFetch(getApiUrl("/admin/home/campaigns/reload"), { method: "POST" });
