// Environment for the standalone astrology app.
//
// EXPO_PUBLIC_* vars are inlined at bundle time. Defaults target production
// so a plain `npx expo start` talks to the real backend; override in
// .env.local for device-against-local-docker testing, e.g.:
//   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:8080
//
// ONE backend (docs/48 D2): this app talks to the same chatservice as the
// rest of the platform. Only the client is separate.

import { Platform } from 'react-native';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://chatbackend.yourfinadvisor.com';

export const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION ?? 'v1';

// Firebase CLIENT config for project aiagentapi, read off THIS app's own
// registrations (docs/49 ASTRAL-68 D10) — GoogleService-Info.plist on iOS,
// google-services.json on Android — rather than borrowing apps/mobile's.
// Native Firebase (analytics) reads those files directly; the JS SDK does
// not, so the same identifiers are restated here per platform. They are
// public identifiers, not secrets: access control lives in Firebase
// security rules and backend token verification.
//
// Keep in step with the two files above; they are the source of truth and
// a mismatch shows up as an auth failure, not a build error.
const FIREBASE_APP = Platform.select({
  ios: {
    apiKey: 'AIzaSyDNLAQWcjvgadsk_s0lJ050TrjUrG6jSek',
    appId: '1:388592327571:ios:ff0c10351b23025a35e666',
  },
  default: {
    apiKey: 'AIzaSyC8WX337lc7VF4I-LDPYvyEjblUuPRlBas',
    appId: '1:388592327571:android:c64860be2fa2c7f635e666',
  },
});

export const FIREBASE_CONFIG = {
  ...FIREBASE_APP,
  authDomain: 'aiagentapi.firebaseapp.com',
  projectId: 'aiagentapi',
  storageBucket: 'aiagentapi.firebasestorage.app',
  messagingSenderId: '388592327571',
};

/** docs/48 D3 — the product is pinned to the astrology agent.
 *
 *  A single-purpose app has no use for the platform router, and pinning
 *  removes an entire live defect class: an image-bearing FIRST turn (a palm
 *  photo with birth details in the caption) is routed to the generic agent
 *  by the classifier before the astrology graph ever runs — DC-1 in the
 *  eval ledger, three failing cases, unfixable from inside the graph.
 *  With the agent forced, that path cannot occur.
 *
 *  F4 is the caveat: the pin removes the router, not the ToolExecutor
 *  pre-check. Making the pin authoritative above that check is ASTRAL-62.
 */
export const PINNED_AGENT = 'astrology_ai';
