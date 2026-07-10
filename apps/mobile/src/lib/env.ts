// Environment for the mobile app.
//
// EXPO_PUBLIC_* vars are inlined at bundle time (Expo SDK 49+). Defaults
// target production so a plain `npx expo start` talks to real backends;
// override in .env.local for device-against-local-docker testing, e.g.:
//   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:8080

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://chatbackend.yourfinadvisor.com';

export const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION ?? 'v1';

// Firebase CLIENT config for project aiagentapi — identical values to the
// web app's VITE_FIREBASE_*. These are public identifiers (they ship in
// every browser bundle already), not secrets; access control lives in
// Firebase security rules and backend token verification.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBaV0-3rpmqPwwmF-DxrzOxo7RMeZGPxc0',
  authDomain: 'aiagentapi.firebaseapp.com',
  projectId: 'aiagentapi',
  storageBucket: 'aiagentapi.firebasestorage.app',
  messagingSenderId: '388592327571',
  appId: '1:388592327571:web:9b928ed2deb914ca35e666',
};

// The Firebase-managed WEB OAuth client id — the audience our backend's
// /auth/google-token-exchange verifies against. Native Google Sign-In
// passes this as webClientId so the ID token it returns has this `aud`.
export const FIREBASE_WEB_CLIENT_ID =
  '388592327571-onpvgba3j318162sqm5h7brd4ackpl07.apps.googleusercontent.com';

// iOS OAuth client id for native Google Sign-In (created in Google Cloud
// Console 2026-07-10, bundle id com.yourfinadvisor.app). Its reversed form
// is registered as a URL scheme via the google-signin config plugin in
// app.json — both must move together.
export const GOOGLE_IOS_CLIENT_ID: string | null =
  '388592327571-f23fuufpir7c1g7op9i4cearl23ihvs9.apps.googleusercontent.com';
