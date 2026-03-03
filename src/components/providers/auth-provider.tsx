// components/providers/auth-provider.tsx
import { useEffect } from "react";
import { onAuthStateChanged, signInAnonymously, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth";
import { getApiUrl } from "@/config/environment";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setFirebaseUser, setUser, setIdToken, setIsAuthLoading } =
    useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);

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

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
