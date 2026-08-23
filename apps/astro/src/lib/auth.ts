// Auth for the astrology app.
//
// ANONYMOUS-FIRST, and that shapes everything here. A first-time user gets a
// reading before they are asked for anything, so by the time they choose to
// sign in they ALREADY have an account with chats, slots, memory and a credit
// balance hanging off an anonymous uid.
//
// Which is why signing in LINKS rather than replaces. `signInWithCredential`
// on an anonymous user silently swaps the uid, and everything the user did
// before that moment becomes unreachable — a silent data loss they only notice
// later, when their history is missing. `linkWithCredential` keeps the uid and
// attaches the provider to it. The one case it cannot cover is a credential
// that already belongs to another account: Firebase raises
// `credential-already-in-use`, there is nothing to merge into, and we fall
// back to a plain sign-in — reported honestly rather than swallowed.

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  signInAnonymously as fbSignInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { identify, track } from './analytics';
import { ensureCoreInitialized } from './core-adapter';
import { FIREBASE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from './env';
import { auth } from './firebase';

ensureCoreInitialized();

export interface Account {
  uid: string;
  /** True while the user is still on the throwaway account. */
  anonymous: boolean;
  email: string | null;
  displayName: string | null;
  /** 'google.com' | 'apple.com' | 'password' | null while anonymous. */
  provider: string | null;
}

function describe(user: User | null): Account | null {
  if (!user) return null;
  return {
    uid: user.uid,
    anonymous: user.isAnonymous,
    email: user.email,
    displayName: user.displayName,
    provider: user.providerData[0]?.providerId ?? null,
  };
}

/** Resolves once Firebase has restored (or failed to restore) persisted auth
 *  state — `auth.currentUser` is null until then, even for a signed-in user,
 *  so reading it before this settles reports a false signed-out. */
function authReady(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
  });
}

/** Watch the signed-in account. Fires immediately with the current value. */
export function subscribeToAccount(fn: (a: Account | null) => void): () => void {
  return auth.onAuthStateChanged((u) => fn(describe(u)));
}

export async function currentAccount(): Promise<Account | null> {
  await authReady();
  return describe(auth.currentUser);
}

/** The app's JWT for chatservice, signing in anonymously on first launch.
 *  Firebase refreshes the ID token itself; getIdToken() returns a cached one
 *  until it is close to expiry. */
export async function getToken(): Promise<string> {
  await authReady();
  const user = auth.currentUser ?? (await fbSignInAnonymously(auth)).user;
  // The analytics stream and the backend agree on who this is: GA4's user id
  // is the Firebase uid, which is what chatservice hangs chats and memory off.
  identify(user.uid);
  return user.getIdToken();
}

/** Link the credential onto the current (anonymous) account so nothing the
 *  user already did is stranded; sign in plainly when there is no account to
 *  upgrade, or when the credential already belongs to someone. */
async function attach(credential: AuthCredential, how: string): Promise<Account> {
  const existing = auth.currentUser;
  if (existing?.isAnonymous) {
    try {
      const linked = await linkWithCredential(existing, credential);
      track('sign_in', { how, upgraded: 1 });
      identify(linked.user.uid);
      return describe(linked.user)!;
    } catch (e: any) {
      // The only expected failure: this Google/Apple account already exists.
      // Signing in is right, but the anonymous history does NOT come along —
      // say so at the call site rather than pretending it was seamless.
      if (e?.code !== 'auth/credential-already-in-use') throw e;
      track('sign_in_link_conflict', { how });
    }
  }
  const signedIn = await signInWithCredential(auth, credential);
  track('sign_in', { how, upgraded: 0 });
  identify(signedIn.user.uid);
  return describe(signedIn.user)!;
}

export function isGoogleSignInAvailable(): boolean {
  return GOOGLE_IOS_CLIENT_ID !== null;
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios';
}

export async function signInWithGoogle(): Promise<Account> {
  // Dynamic import: the native module exists only in a dev/release build, and
  // only needs to load if the button is actually pressed.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    // webClientId controls the ID token's `aud`; it must be the Firebase web
    // client or Firebase rejects the credential.
    webClientId: FIREBASE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID ?? undefined,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google sign-in returned no ID token');
  return attach(GoogleAuthProvider.credential(idToken), 'google');
}

export async function signInWithApple(): Promise<Account> {
  const AppleAuthentication = await import('expo-apple-authentication');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token');
  const provider = new OAuthProvider('apple.com');
  return attach(provider.credential({ idToken: credential.identityToken }), 'apple');
}

export async function signInWithEmail(email: string, password: string): Promise<Account> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  track('sign_in', { how: 'email', upgraded: 0 });
  identify(cred.user.uid);
  return describe(cred.user)!;
}

export async function signUpWithEmail(email: string, password: string): Promise<Account> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  // Best-effort: a verification email must not block account creation.
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn('[auth] could not send verification email', e);
  }
  track('sign_up', { how: 'email' });
  identify(cred.user.uid);
  return describe(cred.user)!;
}

/** Sign out, then straight back in anonymously — this app always has an
 *  account, because a signed-out state would just be a chat screen that
 *  refuses to answer. */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
  track('sign_out');
  await fbSignInAnonymously(auth);
}
