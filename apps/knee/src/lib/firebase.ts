// Firebase JS SDK initialization for React Native — auth only, the astro
// pattern (its file documents the scoped-import and persistence gotchas).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';

import { FIREBASE_CONFIG } from './env';

const app = initializeApp(FIREBASE_CONFIG);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
