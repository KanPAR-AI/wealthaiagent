// React hook over Firebase auth state — the mobile counterpart of the web
// app's use-auth. Deliberately minimal for Phase 2: user + tier flags.
// (The anonymous-message-count gating from web's auth store arrives with
// the chat screens in Phase 3, alongside the async-storage hydration
// design that the web store's sync localStorage reads couldn't share.)

import { onAuthStateChanged, type User } from 'firebase/auth';
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
