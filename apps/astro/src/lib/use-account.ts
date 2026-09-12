// The one account subscription a gated surface needs (owner ruling,
// 2026-09-12). `resolved` separates "auth still racing on a cold start"
// from "genuinely a guest": tab surfaces show their normal spinner until
// resolved (a signed-in user must never see the gate flash), while
// action-time checks use `readingBlocked(account)` directly, which blocks
// the race window too — an unresolved send is refused, not risked.

import { useEffect, useState } from 'react';

import { subscribeToAccount, type Account } from './auth';
import { readingBlocked } from './auth-gate';

export function useAccount(): { account: Account | null; resolved: boolean } {
  const [account, setAccount] = useState<Account | null>(null);
  const [resolved, setResolved] = useState(false);
  useEffect(
    () =>
      subscribeToAccount((a) => {
        setAccount(a);
        setResolved(true);
      }),
    [],
  );
  return { account, resolved };
}

// Convenience for surfaces: blocked-or-unresolved. Action-time callers
// (a send) refuse on this; tab surfaces additionally check `resolved`
// before swapping their spinner for the gate card.
export function useReadingBlocked(): { blocked: boolean; resolved: boolean } {
  const { account, resolved } = useAccount();
  return { blocked: readingBlocked(account), resolved };
}
