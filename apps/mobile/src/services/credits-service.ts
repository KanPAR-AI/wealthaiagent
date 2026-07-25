// credits-service.ts — user credit balance + request flow (chatservice /credits/*)

import { getToken } from '@/lib/auth';
import { apiUrl } from '@/lib/server-config';

async function authFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface CreditBalance {
  balance: number;
  unlimited: boolean;
  credit_usd: number;
}

export interface LedgerEntry {
  ts: number;
  type: string;      // usage | admin_grant | welcome_grant | ...
  credits: number;   // signed
  balance_after: number;
  meta?: Record<string, unknown>;
}

export const getCreditBalance = (): Promise<CreditBalance> =>
  authFetch('/credits/balance');

export const getCreditLedger = (limit = 50): Promise<{ ledger: LedgerEntry[] }> =>
  authFetch(`/credits/ledger?limit=${limit}`);

export const requestCredits = (amount: number, note = ''): Promise<unknown> =>
  authFetch('/credits/request', {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  });
