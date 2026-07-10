// Firebase JS SDK initialization for React Native.
//
// Uses the same Firebase project + client config as the web app. The one
// RN-specific requirement: auth state must persist in AsyncStorage
// (there's no IndexedDB/localStorage), via initializeAuth +
// getReactNativePersistence. Without it every app launch is signed out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
// Import from @firebase/auth (scoped), NOT the 'firebase/auth' umbrella.
// Two layers of firebase v12 packaging weirdness handled here:
//   1. The umbrella's export map has no react-native condition at all —
//      but at runtime that's fine: its entry is a bare
//      `export * from '@firebase/auth'`, and Metro's react-native
//      condition picks the scoped package's dist/rn build on that hop.
//   2. The scoped package's export map lists its top-level "types"
//      condition BEFORE "react-native", so tsc always lands on the
//      browser d.ts, which doesn't declare getReactNativePersistence.
//      tsconfig maps @firebase/auth to dist/rn/index.rn.d.ts (types-only
//      paths override) so tsc sees the same surface Metro executes.
// @firebase/auth is pinned in package.json to the exact version the
// umbrella depends on, so only one copy ever exists.
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';

import { FIREBASE_CONFIG } from './env';

const app = initializeApp(FIREBASE_CONFIG);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
