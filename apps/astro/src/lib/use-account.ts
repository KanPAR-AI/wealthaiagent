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
//
// `uid` rides along for the one caller that needs to know WHICH account a
// parked turn was typed under (`lib/gated-draft.ts`, bug 29c19678): a
// sign-in that swaps the uid must not send into the old account's chat.
export function useReadingBlocked(): { blocked: boolean; resolved: boolean; uid: string | null } {
  const { account, resolved } = useAccount();
  return { blocked: readingBlocked(account), resolved, uid: account?.uid ?? null };
}
