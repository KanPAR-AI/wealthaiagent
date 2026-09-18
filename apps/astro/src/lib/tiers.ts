// Astral tiers — the user's own tier, and the admin's controls (AMB-57).
//
// Owner 2026-09-18: "allow me to change user tiers for friends for more
// testing". A tier is an admin-set flag until billing exists. The admin
// routes are refused server-side for anyone else; the section that calls
// them is shown only when the credits read says this account is unlimited,
// which is how the server marks an admin.
import { getToken } from './auth';
import { apiUrl } from './core-adapter';

export type Tier = 'free' | 'pro' | 'admin';

export interface TierRow {
  uid: string;
  tier: 'free' | 'pro';
  email?: string | null;
  note?: string;
  set_at?: string;
}

export interface TierAdminView {
  tiers: TierRow[];
  limits: Record<string, number | null>;
  config: { free_reading_model: 'pro' | 'flash' };
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = String(((await res.json()) as { detail?: unknown }).detail ?? ''); } catch { /* not json */ }
    throw new Error(detail || `${method} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchTierAdmin(): Promise<TierAdminView> {
  return api<TierAdminView>('admin/astral/tiers');
}

export function setTier(who: string, tier: 'free' | 'pro'): Promise<TierRow> {
  return api<TierRow>('admin/astral/tier', 'PUT', { who: who.trim(), tier });
}

export function setFreeReadingModel(model: 'pro' | 'flash'): Promise<{ config: TierAdminView['config'] }> {
  return api('admin/astral/config', 'PUT', { free_reading_model: model });
}

export { looksLikePerson } from './tiers-view';
