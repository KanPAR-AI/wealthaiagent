// config/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence } from "firebase/auth";
import { isNativePlatform } from "@/lib/capacitor";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Capacitor WKWebView: use initializeAuth with localStorage persistence
// to avoid IndexedDB issues that cause auth/internal-error.
// Web: use getAuth which picks optimal defaults.
export const auth = isNativePlatform
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : getAuth(app);

export default app;
