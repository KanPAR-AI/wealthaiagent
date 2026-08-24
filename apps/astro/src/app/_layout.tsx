import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ensureCoreInitialized } from '@/lib/core-adapter';

// Install this app's PlatformAdapter into @wealthai/core before any screen
// imports the shared chat client.
ensureCoreInitialized();

/**
 * Take a published update on THIS launch, not the next one.
 *
 * expo-updates' default is download-now, apply-next-launch, and nothing tells
 * the user that: a single relaunch shows the old bundle and looks like the
 * update never shipped. Failures are logged and swallowed on purpose — no
 * connection must never be a reason the app will not start.
 * (Same fix as apps/mobile; the default bit both apps.)
 */
function useApplyUpdatesPromptly() {
  useEffect(() => {
    if (__DEV__) return; // updates are disabled in a dev build
    let running = false;
    const apply = async () => {
      if (running) return;
      running = true;
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch (e: any) {
        console.warn('[updates]', String(e?.message ?? e));
      } finally {
        running = false;
      }
    };
    void apply();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void apply();
    });
    return () => sub.remove();
  }, []);
}

/** Root layout for the standalone astrology app (docs/49 ASTRAL-68). */
export default function RootLayout() {
  useApplyUpdatesPromptly();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        {/* No StatusBar here on purpose: one global `style="light"` put white
            time-and-battery over screen 4's and 12's paper surfaces, where it
            is invisible. The bar belongs to whatever is UNDER it, so each
            screen declares its own (docs/49 ASTRAL-124 — the light/ceremonial
            split is per surface). */}
        <Stack screenOptions={{ headerShown: false }} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
