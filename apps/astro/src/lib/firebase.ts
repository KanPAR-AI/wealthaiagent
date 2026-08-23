// Firebase JS SDK initialization for React Native.
//
// The JS SDK is used for AUTH only; analytics goes through
// @react-native-firebase, which reads the native config files directly.
//
// The one RN-specific requirement: auth state must persist in AsyncStorage
// (there is no IndexedDB/localStorage), via initializeAuth +
// getReactNativePersistence. Without it every app launch is signed out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
// Import from @firebase/auth (scoped), NOT the 'firebase/auth' umbrella —
// firebase v12 packaging: the umbrella's export map has no react-native
// condition (fine at runtime, Metro resolves the scoped RN build one hop
// later), and the scoped package lists "types" before "react-native" so tsc
// would land on the browser d.ts, which does not declare
// getReactNativePersistence. tsconfig maps the types path to dist/rn.
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';

import { FIREBASE_CONFIG } from './env';

const app = initializeApp(FIREBASE_CONFIG);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
