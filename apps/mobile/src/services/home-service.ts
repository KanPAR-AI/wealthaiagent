// home-service.ts — server-configured home suggestion tiles (campaigns).
//
// The chat empty-state tiles come from chatservice (/home/suggestions) so we
// can change them, run a seasonal campaign, or open one for testing WITHOUT
// shipping an app update. Falls back to bundled defaults if the fetch fails.

import { getToken } from '@/lib/auth';
import { apiUrl } from '@/lib/server-config';

export interface HomeTile {
  text: string;
  agent?: string | null; // null = smart routing; else lock the tile to an agent
}

export interface HomeSuggestions {
  tiles: HomeTile[];
  campaign_id: string | null;
  campaign_name?: string;
}

// Bundled fallback — matches what the app historically shipped, so a failed
// fetch (offline / cold backend) still shows a sensible home screen.
export const DEFAULT_TILES: HomeTile[] = [
  { text: "I'm feeling overwhelmed — help me find calm 💛" },
  { text: "Should I buy this house? Let's crunch the numbers 🏠" },
  { text: 'What do the stars have in store for me? ✨' },
  { text: 'Read my palm & reveal my destiny 🔮' },
];

export async function getHomeSuggestions(): Promise<HomeSuggestions> {
  try {
    const token = await getToken();
    const res = await fetch(apiUrl('/home/suggestions'), {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`home suggestions failed (${res.status})`);
    const data = (await res.json()) as HomeSuggestions;
    if (!data?.tiles?.length) return { tiles: DEFAULT_TILES, campaign_id: null };
    return data;
  } catch {
    return { tiles: DEFAULT_TILES, campaign_id: null };
  }
}
