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
 * `signInWithPopup` is unreliable on actual mobile browsers (iOS Safari opens
 * a new tab whose auth completion doesn't propagate back). `signInWithRedirect`
 * is the canonical fix there: full-page redirect to Google, redirected back,
 * `getRedirectResult()` picks up the credential.
 *
 * UA-based detection ONLY. Earlier heuristics (narrow viewport, coarse
 * pointer) misfired on desktop browsers — a Mac user with a narrow window
 * or Chrome DevTools "Toggle device toolbar" enabled would hit the redirect
 * path, which on localhost+third-party-iframe is fragile and silently
 * returned null from getRedirectResult. End-user symptom: full-page redirect
 * to Google, sign in, redirected back to login page still anonymous.
 */
function shouldUseRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
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
