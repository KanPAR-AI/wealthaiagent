// Environment for the KneeFit app.
//
// Same rules as apps/astro/src/lib/env.ts: EXPO_PUBLIC_* vars are inlined at
// bundle time; defaults target production so a plain `npx expo start` talks
// to the real backend; override in .env.local for device-against-local-docker
// testing. ONE backend — this app talks to the same chatservice as the rest
// of the platform; only the client is separate.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://chatbackend.yourfinadvisor.com';

export const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION ?? 'v1';

// Firebase CLIENT config for project aiagentapi. This app has no native
// Firebase modules yet (no analytics, no google-services files), so the JS
// SDK is the only consumer and the project's WEB app registration is what it
// uses — the same registration the web app ships. These are public
// identifiers, not secrets: access control lives in Firebase security rules
// and backend token verification. When this app gets its own store identity
// (docs/51 pattern: per-app registrations), this block gains per-platform
// ids the way astro's did.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBaV0-3rpmqPwwmF-DxrzOxo7RMeZGPxc0',
  appId: '1:388592327571:web:9b928ed2deb914ca35e666',
  authDomain: 'aiagentapi.firebaseapp.com',
  projectId: 'aiagentapi',
  storageBucket: 'aiagentapi.firebasestorage.app',
  messagingSenderId: '388592327571',
};

/** The product is pinned to the knee-arthritis agent, the same way Astral is
 *  pinned to astrology_ai (docs/48 D3 precedent): a single-purpose app has no
 *  use for the platform router, and the pin removes a whole class of
 *  misroutes (an X-ray image on a first turn landing on the generic agent). */
export const PINNED_AGENT = 'knee_arthritis';
