// Mobile auth service — the Phase 2 deliverable.
//
// Sign-in methods, in the order users meet them:
//
//   Anonymous      Firebase anonymous auth — the app's default tier, same
//                  as web. Zero configuration.
//   Google         NATIVE Google Sign-In sheet → Google ID token → our
//                  backend /auth/google-token-exchange (verifies against
//                  the web client audience, mints a Firebase custom token)
//                  → signInWithCustomToken. Mirrors the web GIS path and
//                  reuses the exact same backend endpoint — no popups, no
//                  ITP, no cross-origin cookies. Requires the iOS OAuth
//                  client (see env.GOOGLE_IOS_CLIENT_ID) — until that
//                  console step is done, isGoogleSignInAvailable() is
//                  false and the login screen hides the button.
//   Apple          expo-apple-authentication → Firebase OAuthProvider
//                  credential. REQUIRED by App Store Guideline 4.8 the
//                  moment we offer Google login.
//   Email/password Firebase JS SDK, works out of the box.

import {
  createUserWithEmailAndPassword,
  OAuthProvider,
  signInAnonymously as fbSignInAnonymously,
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { getPlatform } from '@wealthai/core';

import { ensureCoreInitialized } from './core-adapter';
import { GOOGLE_IOS_CLIENT_ID, FIREBASE_WEB_CLIENT_ID } from './env';
import { auth } from './firebase';

ensureCoreInitialized();

export async function signInAnonymously(): Promise<void> {
  await fbSignInAnonymously(auth);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}

export function isGoogleSignInAvailable(): boolean {
  return GOOGLE_IOS_CLIENT_ID !== null;
}

/** Exchange a Google ID token for a Firebase custom token via our backend.
 *  Same endpoint the web GIS button uses — verified in prod 2026-07-10. */
async function signInViaServerExchange(idToken: string): Promise<void> {
  const { fetch, getApiUrl } = getPlatform();
  const res = await fetch(getApiUrl('/auth/google-token-exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }
  const { firebase_token } = await res.json();
  await signInWithCustomToken(auth, firebase_token);
}

export async function signInWithGoogle(): Promise<void> {
  if (!isGoogleSignInAvailable()) {
    throw new Error(
      'Google sign-in is not configured for this build yet (missing iOS ' +
      'OAuth client). Use email sign-in, or create the iOS client in ' +
      'Google Cloud Console and set GOOGLE_IOS_CLIENT_ID.',
    );
  }
  // Dynamic import: the native module only exists in dev/EAS builds (not
  // Expo Go), and only needs to load if the button is actually shown.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    // webClientId controls the ID token's `aud` — must be the Firebase web
    // client so the backend exchange verifies it.
    webClientId: FIREBASE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID ?? undefined,
  });

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in returned no ID token');
  }
  await signInViaServerExchange(idToken);
}

export async function signInWithApple(): Promise<void> {
  const AppleAuthentication = await import('expo-apple-authentication');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple sign-in returned no identity token');
  }
  const provider = new OAuthProvider('apple.com');
  const fbCredential = provider.credential({ idToken: credential.identityToken });
  await signInWithCredential(auth, fbCredential);
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/** Fresh backend-ready ID token (auto-refreshes if expired). */
export async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
