// components/providers/auth-provider.tsx
import { useEffect } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  getRedirectResult,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth";
import { getApiUrl } from "@/config/environment";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setFirebaseUser, setUser, setIdToken, setIsAuthLoading, resetAnonymousMessageCount } =
    useAuthStore();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // Safety timeout: if auth doesn't resolve in 8s, stop the loading
    // state. Slightly longer than before because getRedirectResult on a
    // slow mobile connection can take 2-4s on its own.
    const timeout = setTimeout(() => {
      if (!cancelled) setIsAuthLoading(false);
    }, 8000);

    // CRITICAL: process any pending redirect FIRST, awaiting it before we
    // subscribe to onAuthStateChanged. Without this, the listener fires
    // synchronously with `null` (because the SDK hasn't yet parsed the
    // redirect token from the URL hash), our `else` branch triggers
    // signInAnonymously, and the Google user is silently overwritten by
    // the new anonymous session — exactly the "still anonymous after
    // Google sign-in on mobile" symptom the user is seeing.
    const setupAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.info(
            "[auth] redirect sign-in completed for",
            result.user.email || result.user.uid,
          );
        }
      } catch (err: any) {
        // Surface this as error (not debug) so it shows up in mobile
        // remote-debug consoles. Common causes: unauthorized domain
        // (`auth/unauthorized-domain`), invalid OAuth client config,
        // third-party-cookie blocked (Safari ITP). The page continues
        // — onAuthStateChanged will fall through to anonymous below.
        console.error(
          "[auth] redirect result error:",
          err?.code || err?.message || err,
        );
      }

      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      clearTimeout(timeout);
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);

        // Reset anonymous message counter when user signs in (non-anonymous)
        if (!firebaseUser.isAnonymous) {
          resetAnonymousMessageCount();
        }

        // Get ID token
        const token = await firebaseUser.getIdToken();
        setIdToken(token);

        // Fetch user info + admin status from backend
        try {
          const res = await fetch(getApiUrl("/auth/me"), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || data.email,
              phoneNumber: firebaseUser.phoneNumber || data.phoneNumber || null,
              // Prefer Firebase's profile (has real Google name/photo)
              displayName: firebaseUser.displayName || data.displayName,
              photoURL: firebaseUser.photoURL || data.photoURL,
              // Trust Firebase's isAnonymous (backend SKIP_AUTH returns false for all)
              isAnonymous: firebaseUser.isAnonymous || data.isAnonymous,
              isAdmin: firebaseUser.isAnonymous ? false : data.isAdmin,
            });
          } else {
            // Backend rejected — set basic user from Firebase
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              phoneNumber: firebaseUser.phoneNumber,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              isAnonymous: firebaseUser.isAnonymous,
              isAdmin: false,
            });
          }
        } catch {
          // Network error — set basic user from Firebase
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            phoneNumber: firebaseUser.phoneNumber,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            isAnonymous: firebaseUser.isAnonymous,
            isAdmin: false,
          });
        }
      } else {
        // No user — sign in anonymously for the 3-message trial
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with anonymous user
        } catch (err) {
          console.error("Anonymous sign-in failed:", err);
          setFirebaseUser(null);
          setUser(null);
          setIdToken(null);
        }
      }
      setIsAuthLoading(false);
    });
    };

    setupAuth();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
