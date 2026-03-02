// store/auth.ts
// Zustand store for Firebase auth state

import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  isAdmin: boolean;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  idToken: string | null;
  isAuthLoading: boolean;
  anonymousMessageCount: number;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: AppUser | null) => void;
  setIdToken: (token: string | null) => void;
  setIsAuthLoading: (loading: boolean) => void;
  incrementAnonymousMessageCount: () => number;
  resetAnonymousMessageCount: () => void;
  signOut: () => void;
}

const ANON_MSG_COUNT_KEY = "anon_message_count";

function getStoredAnonCount(): number {
  try {
    return parseInt(localStorage.getItem(ANON_MSG_COUNT_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  user: null,
  idToken: null,
  isAuthLoading: true,
  anonymousMessageCount: getStoredAnonCount(),

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUser: (user) => set({ user }),
  setIdToken: (token) => set({ idToken: token }),
  setIsAuthLoading: (loading) => set({ isAuthLoading: loading }),

  incrementAnonymousMessageCount: () => {
    const newCount = get().anonymousMessageCount + 1;
    localStorage.setItem(ANON_MSG_COUNT_KEY, String(newCount));
    set({ anonymousMessageCount: newCount });
    return newCount;
  },

  resetAnonymousMessageCount: () => {
    localStorage.removeItem(ANON_MSG_COUNT_KEY);
    set({ anonymousMessageCount: 0 });
  },

  signOut: () => {
    set({
      firebaseUser: null,
      user: null,
      idToken: null,
    });
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("jwt_token_expiry");
  },
}));
