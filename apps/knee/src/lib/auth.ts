// Auth for KneeFit — apps/astro's anonymous-first auth, trimmed to the
// providers this build actually ships (see that file for the full linking
// rationale). No native Google/Apple modules yet, so those flows are simply
// not here — the settings screen offers what exists: guest by default, email
// to keep your history across devices.

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInAnonymously as fbSignInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { ensureCoreInitialized } from './core-adapter';
import { FIREBASE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from './env';
import { auth } from './firebase';

ensureCoreInitialized();

export interface Account {
  uid: string;
  anonymous: boolean;
  email: string | null;
  displayName: string | null;
}

function describe(user: User | null): Account | null {
  if (!user) return null;
  return {
    uid: user.uid,
    anonymous: user.isAnonymous,
    email: user.email,
    displayName: user.displayName,
  };
}

function authReady(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
  });
}

export function subscribeToAccount(fn: (a: Account | null) => void): () => void {
  return auth.onAuthStateChanged((u) => fn(describe(u)));
}

export async function currentAccount(): Promise<Account | null> {
  await authReady();
  return describe(auth.currentUser);
}

/** The app's JWT for chatservice, signing in anonymously on first launch. */
export async function getToken(): Promise<string> {
  await authReady();
  const user = auth.currentUser ?? (await fbSignInAnonymously(auth)).user;
  return user.getIdToken();
}

/** Link onto the anonymous account so the guest's chats survive the upgrade;
 *  fall back to a plain sign-in when the credential already has an owner. */
async function attach(credential: AuthCredential): Promise<Account> {
  const existing = auth.currentUser;
  if (existing?.isAnonymous) {
    try {
      const linked = await linkWithCredential(existing, credential);
      return describe(linked.user)!;
    } catch (e: any) {
      if (e?.code !== 'auth/credential-already-in-use') throw e;
    }
  }
  const signedIn = await signInWithCredential(auth, credential);
  return describe(signedIn.user)!;
}

export function isGoogleSignInAvailable(): boolean {
  // Android needs only the web client id; the iOS client id gates iOS alone —
  // keying both on the iOS id hid the button from Android once (astro,
  // 2026-08-28).
  if (Platform.OS === 'android') return Boolean(FIREBASE_WEB_CLIENT_ID);
  return GOOGLE_IOS_CLIENT_ID !== null;
}

export async function signInWithGoogle(): Promise<Account> {
  // Dynamic import: the native module exists only in a dev/release build.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    // webClientId controls the ID token's `aud`; it must be the Firebase web
    // client or Firebase rejects the credential.
    webClientId: FIREBASE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID ?? undefined,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Clear any half-open Play-Services session — a prior attempt that died
  // mid-flight makes the next signIn() skip the account sheet (astro,
  // measured on the first Android sideload).
  await GoogleSignin.signOut().catch(() => {});
  let result: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    result = await GoogleSignin.signIn();
  } catch (e: any) {
    const code = String(e?.code ?? '');
    if (code === 'DEVELOPER_ERROR' || /DEVELOPER_ERROR/.test(String(e?.message ?? ''))) {
      throw new Error(
        'Google sign-in is not available for this build yet — its signing ' +
        'certificate is still propagating on Google’s side. Try again in a ' +
        'few minutes, or use email sign-in.',
      );
    }
    throw e;
  }
  if (result.type === 'cancelled') {
    const cancel: any = new Error('Sign-in cancelled');
    cancel.code = 'cancelled';
    throw cancel; // the settings screen treats a cancel as a non-error
  }
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google sign-in returned no ID token');
  return attach(GoogleAuthProvider.credential(idToken));
}

function emailAuthError(e: any): Error {
  const code = String(e?.code ?? '');
  if (code === 'auth/email-already-in-use') {
    return new Error('This email already has an account — tap "Sign in" instead.');
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return new Error('That password doesn’t match this email.');
  }
  if (code === 'auth/user-not-found') {
    return new Error('No account exists for this email yet — tap "Create account".');
  }
  if (code === 'auth/invalid-email') {
    return new Error('That doesn’t look like a valid email address.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Password needs at least 6 characters.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts — wait a minute and try again.');
  }
  return e;
}

export async function signInWithEmail(email: string, password: string): Promise<Account> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return describe(cred.user)!;
  } catch (e: any) {
    throw emailAuthError(e);
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<Account> {
  try {
    return await attach(EmailAuthProvider.credential(email.trim(), password));
  } catch (e: any) {
    if (String(e?.code ?? '') === 'auth/email-already-in-use') {
      try {
        return await signInWithEmail(email, password);
      } catch {
        throw emailAuthError(e);
      }
    }
    throw emailAuthError(e);
  }
}

/** Sign out, then straight back in anonymously — this app always has an
 *  account; a signed-out state would just be a library that refuses to play. */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
  await fbSignInAnonymously(auth);
}
