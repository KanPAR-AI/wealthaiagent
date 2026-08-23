/** Credits.
 *
 *  The welcome grant is NOT automatic on sign-up: `ensure_welcome` runs inside
 *  `GET /credits/balance` (chatservice `api/v1/endpoints/credits.py:34`) and
 *  nowhere else. A client that never asks for the balance leaves its users on
 *  zero, and the first turn is refused by the out-of-credits gate
 *  (`chats.py:999`) with a message telling them to visit a Settings screen.
 *  So this call is not decoration — it is how an account becomes usable.
 */
import { track } from './analytics';
import { getToken } from './auth';
import { apiUrl } from './core-adapter';

export interface Balance {
  balance: number;
  /** Admins are never charged; the UI shows "Unlimited" rather than a number. */
  unlimited: boolean;
}

export async function fetchBalance(): Promise<Balance> {
  const token = await getToken();
  const res = await fetch(apiUrl('credits/balance'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`balance failed: ${res.status}`);
  const data = await res.json();
  const out = {
    balance: Number(data.balance ?? 0),
    unlimited: Boolean(data.unlimited),
  };
  track('credits_balance', { balance: out.balance, unlimited: out.unlimited ? 1 : 0 });
  return out;
}
