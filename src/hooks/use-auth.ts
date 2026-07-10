// hooks/use-auth.ts
// Primary auth hook — replaces use-jwt-token.ts

import { useCallback } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { signInWithGoogleViaGIS } from "@/lib/google-identity-services";
import { getApiUrl } from "@/config/environment";

/** Google Sign-In on the web is a minefield: every browser+Firebase
 * combination has its own failure mode. We try three approaches in
 * order, falling through on the first failure:
 *
 *   1. **GIS One Tap / FedCM** — Google Identity Services. Runs as a
 *      first-party iframe under accounts.google.com, returns an ID
 *      token via JS callback, then we hand it to
 *      `signInWithCredential`. NO redirect, NO cross-origin auth-domain
 *      iframe. This is the only flow that reliably works on iOS Safari
 *      and iOS Chrome (CriOS) — they're both WebKit and ITP blocks the
 *      cross-site cookies Firebase's `authDomain` flow needs.
 *
 *   2. **signInWithPopup** — Firebase's classic popup. Works on
 *      desktop and on mobile *when* `Cross-Origin-Opener-Policy:
 *      same-origin-allow-popups` is set on the parent (we set it in
 *      both nginx prod config and the Vite dev server). On older iOS
 *      it can race the popup close — that's why GIS goes first.
 *
 *   3. **signInWithRedirect** — last resort, full-page redirect.
 *      Documented to fail silently on Safari ITP because the auth
 *      handler's session cookie on `*.firebaseapp.com` gets blocked
 *      coming back. Confirmed via prod logs:
 *      ravi.ismystery@gmail.com tried mobile sign-in repeatedly and
 *      stayed anonymous every time — getRedirectResult() returns null
 *      because Firebase can't read its own session cookie cross-site.
 */
/** Exchange a Google ID token for a Firebase custom token via our own
 * backend, then sign in with the custom token. This path is immune to
 * Safari ITP / cross-site cookie blocking because it never touches the
 * Firebase authDomain popup handler — the OAuth is done directly with
 * Google (via GIS, first-party accounts.google.com) and Firebase auth
 * happens via a same-origin call to chatbackend.yourfinadvisor.com,
 * which mints a custom token from Firebase Admin SDK. */
export async function signInViaServerExchange(idToken: string): Promise<void> {
  const res = await fetch(getApiUrl("/auth/google-token-exchange"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }
  const { firebase_token } = await res.json();
  await signInWithCustomToken(auth, firebase_token);
}

async function signInWithGoogleFallback(): Promise<"gis-exchange" | "gis-credential" | "popup" | "redirect"> {
  const provider = new GoogleAuthProvider();

  // 1. Preferred: GIS → server-side token exchange → signInWithCustomToken.
  //    Immune to ITP because nothing crosses firebaseapp.com.
  //    Fallback: try the same GIS ID token via signInWithCredential in
  //    case the backend exchange endpoint isn't deployed yet (rollout
  //    safety for the first few minutes after a chatservice deploy).
  try {
    const idToken = await signInWithGoogleViaGIS();
    if (idToken) {
      try {
        await signInViaServerExchange(idToken);
        return "gis-exchange";
      } catch (exchangeErr) {
        console.warn(
          "[AUTH] server-side exchange failed, falling back to Firebase credential:",
          exchangeErr,
        );
        const cred = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, cred);
        return "gis-credential";
      }
    }
  } catch (e) {
    console.warn("[AUTH] GIS failed, falling back to popup:", e);
  }

  // 2. Popup
  try {
    await signInWithPopup(auth, provider);
    return "popup";
  } catch (e: any) {
    // Popup blocked, COOP issue, or user closed the popup — fall
    // through to redirect.
    const code = e?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      // User intent: don't auto-fall through to redirect. Re-throw.
      throw e;
    }
    console.warn("[AUTH] popup failed, falling back to redirect:", code || e);
  }

  // 3. Redirect (rarely reached now)
  await signInWithRedirect(auth, provider);
  return "redirect";
}

export function useAuth() {
  const { user, idToken, isAuthLoading, anonymousMessageCount } =
    useAuthStore();

  const signInWithGoogle = useCallback(async () => {
    const path = await signInWithGoogleFallback();
    console.info("[AUTH] sign-in completed via:", path);
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
