// React hook over Firebase auth state — the mobile counterpart of the web
// app's use-auth. Deliberately minimal for Phase 2: user + tier flags.
// (The anonymous-message-count gating from web's auth store arrives with
// the chat screens in Phase 3, alongside the async-storage hydration
// design that the web store's sync localStorage reads couldn't share.)

import { onAuthStateChanged, type User } from 'firebase/auth';
import { getPlatform, useChatStore } from '@wealthai/core';
import { useEffect, useState } from 'react';

import { auth } from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  /** True until the first onAuthStateChanged fires — gate splash/redirects on this. */
  isAuthLoading: boolean;
  isSignedIn: boolean;
  isAnonymous: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
      // The agent pinned for this user on the server (owner, 2026-10-26):
      // read once per sign-in from /auth/me, into the shared chat store.
      // A failure leaves whatever the store had — never a blocked start.
      if (u) {
        u.getIdToken()
          .then((token) =>
            getPlatform().fetch(getPlatform().getApiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } }),
          )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && 'pinnedAgent' in data) useChatStore.getState().setPinnedAgent(data.pinnedAgent ?? null);
          })
          .catch(() => {});
      } else {
        useChatStore.getState().setPinnedAgent(null);
      }
    });
    return unsubscribe;
  }, []);

  return {
    user,
    isAuthLoading,
    isSignedIn: !!user && !user.isAnonymous,
    isAnonymous: !!user?.isAnonymous,
  };
}
