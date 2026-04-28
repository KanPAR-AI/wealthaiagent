// hooks/use-auth.ts
// Primary auth hook — replaces use-jwt-token.ts

import { useCallback } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";

/** Detect whether we should use redirect-based Google sign-in instead of popup.
 *
 * `signInWithPopup` is unreliable on mobile browsers (iOS Safari opens a new
 * tab whose auth completion doesn't propagate to the original tab's
 * `onAuthStateChanged` listener — user appears stuck as anonymous even after
 * Google sign-in succeeds). `signInWithRedirect` is the canonical fix:
 * full-page redirect to Google, Google redirects back, app calls
 * `getRedirectResult()` on mount to pick up the auth state.
 */
function shouldUseRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Standard mobile UA matchers (iOS, Android, IE/Edge mobile, Opera mini).
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // Coarse pointer = touch device (covers most tablets too).
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
  // Narrow viewport — phones in portrait.
  if (window.innerWidth < 768) return true;
  return false;
}

export function useAuth() {
  const { user, idToken, isAuthLoading, anonymousMessageCount } =
    useAuthStore();

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    if (shouldUseRedirect()) {
      // On mobile: full-page redirect. The user leaves this page; on return
      // the AuthProvider's getRedirectResult() in useEffect picks up the
      // auth state. The promise below resolves before the redirect actually
      // happens, so callers should treat it as fire-and-forget.
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    useAuthStore.getState().signOut();
    // Wipe in-memory chat state so the next user (anon or signed-in)
    // doesn't inherit the previous user's open chat, pending message,
    // or agent selection. The chat list re-fetches from the backend
    // (filtered by the new Firebase UID) on the next render.
    useChatStore.getState().reset();
  }, []);

  // Always returns a fresh token (auto-refreshes if expired)
  const getToken = useCallback(async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return currentUser.getIdToken();
  }, []);

  const isSignedIn = !!user && !user.isAnonymous;
  const isAnonymous = !!user?.isAnonymous;
  const isAdmin = !!user?.isAdmin;
  const needsSignIn = isAnonymous && anonymousMessageCount >= 3;

  return {
    user,
    idToken,
    isAuthLoading,
    isSignedIn,
    isAnonymous,
    isAdmin,
    needsSignIn,
    anonymousMessageCount,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    getToken,
  };
}
