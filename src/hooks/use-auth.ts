// hooks/use-auth.ts
// Primary auth hook — replaces use-jwt-token.ts

import { useCallback } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, idToken, isAuthLoading, anonymousMessageCount } =
    useAuthStore();

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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
