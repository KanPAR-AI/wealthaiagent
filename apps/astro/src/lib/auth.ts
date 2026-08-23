// Auth for the astrology app.
//
// This slice ships the tier every user starts in: Firebase ANONYMOUS auth,
// which needs no console configuration and gives the backend a real uid to
// hang chats, slots and memory off. Google / Apple / email sign-in — and the
// account-linking that upgrades an anonymous uid rather than stranding its
// history — are the next slice, and every call site below already takes the
// token through getToken() either way.

import { signInAnonymously as fbSignInAnonymously } from 'firebase/auth';

import { identify } from './analytics';
import { ensureCoreInitialized } from './core-adapter';
import { auth } from './firebase';

ensureCoreInitialized();

/** Resolves once Firebase has restored (or failed to restore) persisted
 *  auth state — `auth.currentUser` is null until then, even for a signed-in
 *  user, so reading it before this settles reports a false signed-out. */
function authReady(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(() => { unsub(); resolve(); });
  });
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
