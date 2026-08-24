import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ensureAstralHostInstalled } from '@/lib/astral-host';
import { ensureCoreInitialized } from '@/lib/core-adapter';

// Install this app's PlatformAdapter into @wealthai/core before any screen
// imports the shared chat client.
ensureCoreInitialized();
// ...and this app's capabilities into the shared React Native astral binding,
// so the chart wheel and the input widget render from ONE implementation
// rather than a copy (docs/49 ASTRAL-99).
ensureAstralHostInstalled();

// Hold the native splash until the display serif is loaded — a first frame
// in the fallback face is a brand flash nobody designed (F26).
SplashScreen.preventAutoHideAsync();

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
  const [fontsLoaded] = useFonts({
    // Static asset reference: Metro needs the literal require, and the lint
    // rule is right for everything except font/image assets.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    PlayfairDisplay: require('../../assets/fonts/PlayfairDisplay.ttf'),
  });
  useEffect(() => {
    // Loaded or failed: either way the app shows. A font error must never
    // hold the splash forever — the fallback face is worse than no app.
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);
  useEffect(() => {
    const t = setTimeout(() => void SplashScreen.hideAsync(), 3000);
    return () => clearTimeout(t);
  }, []);
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
