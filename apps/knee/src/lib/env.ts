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

// Firebase CLIENT config for project aiagentapi, read off THIS app's own
// registrations (created 2026-09-05 via the Firebase CLI — the astro/D10
// pattern): `apps/knee/google-services.json` and `GoogleService-Info.plist`
// are the source of truth; the same identifiers are restated here per
// platform for the JS SDK. Public identifiers, not secrets: access control
// lives in Firebase security rules and backend token verification.
import { Platform } from 'react-native';

const FIREBASE_APP = Platform.select({
  ios: {
    apiKey: 'AIzaSyDNLAQWcjvgadsk_s0lJ050TrjUrG6jSek',
    appId: '1:388592327571:ios:068b4b9154ad50d835e666',
  },
  default: {
    apiKey: 'AIzaSyC8WX337lc7VF4I-LDPYvyEjblUuPRlBas',
    appId: '1:388592327571:android:e9b1ce938288fc9335e666',
  },
});

export const FIREBASE_CONFIG = {
  ...FIREBASE_APP,
  authDomain: 'aiagentapi.firebaseapp.com',
  projectId: 'aiagentapi',
  storageBucket: 'aiagentapi.firebasestorage.app',
  messagingSenderId: '388592327571',
};

// The Firebase-managed WEB OAuth client — the audience Google ID tokens must
// carry; shared across the project's apps.
export const FIREBASE_WEB_CLIENT_ID =
  '388592327571-onpvgba3j318162sqm5h7brd4ackpl07.apps.googleusercontent.com';

// THIS app's iOS OAuth client (GoogleService-Info.plist CLIENT_ID). Its
// reversed form is the url scheme the google-signin plugin registers in
// app.json — the two must move together.
export const GOOGLE_IOS_CLIENT_ID: string | null =
  '388592327571-b2qqp1ac7n8skgenmk4ac5dke6jmsv16.apps.googleusercontent.com';

/** The product is pinned to the knee-arthritis agent, the same way Astral is
 *  pinned to astrology_ai (docs/48 D3 precedent): a single-purpose app has no
 *  use for the platform router, and the pin removes a whole class of
 *  misroutes (an X-ray image on a first turn landing on the generic agent). */
export const PINNED_AGENT = 'knee_arthritis';
