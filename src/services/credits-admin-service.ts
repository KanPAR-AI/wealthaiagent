// credits-admin-service.ts — admin credit management (chatservice /admin/credits/*)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function adminFetch(endpoint: string, options: RequestInit = {}) {
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
    throw new Error(body.detail || `Credits admin API error: ${res.status}`);
  }
  return res.json();
}

export interface CreditRequest {
  id: string;
  uid: string;
  email: string;
  amount_requested: number;
  note: string;
  status: string;
  created_at: number;
  credits_granted?: number;
}

export interface LedgerEntry {
  ts: number;
  type: string;
  credits: number;
  balance_after: number;
  meta?: Record<string, unknown>;
}

export const listCreditRequests = (status = "pending"): Promise<{ requests: CreditRequest[] }> =>
  adminFetch(`/credits/requests?status=${encodeURIComponent(status)}`);

export const resolveCreditRequest = (
  id: string, approve: boolean, credits: number,
): Promise<{ request: CreditRequest }> =>
  adminFetch(`/credits/requests/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ approve, credits }),
  });

export const getUserCredits = (
  uid: string,
): Promise<{ uid: string; balance: number; ledger: LedgerEntry[] }> =>
  adminFetch(`/credits/${encodeURIComponent(uid)}`);

export interface ResolvedUser {
  uid: string;
  email?: string | null;
  phone?: string | null;
  balance: number;
  ledger: LedgerEntry[];
}

/** Resolve an email / phone (E.164) / uid → user + credits. */
export const lookupUser = (q: string): Promise<ResolvedUser> =>
  adminFetch(`/credits/lookup?q=${encodeURIComponent(q)}`);

export const grantCredits = (
  uid: string, credits: number, reason: string,
): Promise<{ uid: string; balance: number }> =>
  adminFetch(`/credits/${encodeURIComponent(uid)}/grant`, {
    method: "POST",
    body: JSON.stringify({ credits, reason }),
  });
