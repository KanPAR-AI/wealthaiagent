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
  EmailAuthProvider,
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
  // Android needs only the web client id (always set — it is the project's
  // web client); the iOS client id gates iOS alone. Keying BOTH platforms on
  // the iOS id hid the Google button from every Android build (2026-08-28).
  if (Platform.OS === 'android') return Boolean(FIREBASE_WEB_CLIENT_ID);
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
  // Clear any half-open Play-Services session first. A prior attempt that
  // died mid-flight (or a session from before the SHA certificate was
  // registered) leaves state that makes the next signIn() report the user
  // as already signed in instead of showing the account sheet (measured on
  // the first Android sideload, 2026-08-28). Signing out of the GOOGLE
  // layer touches nothing in Firebase — the app session is not here.
  await GoogleSignin.signOut().catch(() => {});
  let result: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    result = await GoogleSignin.signIn();
  } catch (e: any) {
    // The raw native codes are developer-speak; say what the user can act on.
    const code = String(e?.code ?? '');
    if (code === 'DEVELOPER_ERROR' || /DEVELOPER_ERROR/.test(String(e?.message ?? ''))) {
      throw new Error(
        'Google sign-in is not available for this build yet — its signing ' +
        'certificate is still propagating on Google\u2019s side. Try again in a ' +
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

/** Firebase's auth codes are developer-speak; the settings screen shows
 *  `e.message` verbatim, so the translation to something a person can act
 *  on happens HERE — including the one collision this project makes easy:
 *  Arthur and Astral share a Firebase project, so an email first used with
 *  Google in either app already exists when it arrives at this form
 *  (measured on the first Android sideload, 2026-08-28:
 *  "auth/email-already-in-use", raw, at the user). */
function emailAuthError(e: any): Error {
  const code = String(e?.code ?? '');
  if (code === 'auth/email-already-in-use') {
    return new Error(
      'This email already has an account \u2014 tap "Sign in" instead. If you ' +
      'originally continued with Google (in this app or in YourFinAdvisor), ' +
      'use the Google button above.',
    );
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return new Error(
      'That password doesn\u2019t match this email. If you originally continued ' +
      'with Google, use the Google button above instead.',
    );
  }
  if (code === 'auth/user-not-found') {
    return new Error('No account exists for this email yet \u2014 tap "Create account".');
  }
  if (code === 'auth/invalid-email') {
    return new Error('That doesn\u2019t look like a valid email address.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Password needs at least 6 characters.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts \u2014 wait a minute and try again.');
  }
  return e;
}

export async function signInWithEmail(email: string, password: string): Promise<Account> {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e: any) {
    throw emailAuthError(e);
  }
  track('sign_in', { how: 'email', upgraded: 0 });
  identify(cred.user.uid);
  return describe(cred.user)!;
}

export async function signUpWithEmail(email: string, password: string): Promise<Account> {
  // Through `attach`, same as Google and Apple: creating an email account on
  // an anonymous session LINKS it, so the guest readings survive the upgrade
  // instead of stranding \u2014 the exact promise the Google path already keeps.
  try {
    const account = await attach(
      EmailAuthProvider.credential(email.trim(), password), 'email');
    // Best-effort: a verification email must not block account creation.
    try {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    } catch (e) {
      console.warn('[auth] could not send verification email', e);
    }
    track('sign_up', { how: 'email' });
    return account;
  } catch (e: any) {
    if (String(e?.code ?? '') === 'auth/email-already-in-use') {
      // The account exists. If the password they typed matches it, they
      // meant "sign in" \u2014 do that instead of lecturing them about buttons.
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
 *  account, because a signed-out state would just be a chat screen that
 *  refuses to answer. */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
  track('sign_out');
  await fbSignInAnonymously(auth);
}
