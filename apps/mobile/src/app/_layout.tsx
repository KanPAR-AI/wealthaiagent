import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ensureAstralHostInstalled } from '@/lib/astral-host';
import { ensureChatHostInstalled } from '@/lib/chat-host';
import { ensureCoreInitialized } from '@/lib/core-adapter';

// Install the mobile PlatformAdapter into @wealthai/core before any screen
// imports the shared services (chat client, stores).
ensureCoreInitialized();
// ...and this app's capabilities into the shared React Native astral binding,
// which no longer reaches into `@/lib/*` for them (docs/49 ASTRAL-99).
ensureAstralHostInstalled();
// ...and this app's capabilities into the shared chat surface, which is the
// same surface apps/astro renders (docs/49 ASTRAL-105).
ensureChatHostInstalled();

SplashScreen.preventAutoHideAsync();

/**
 * Take a published update on THIS launch, not the next one.
 *
 * expo-updates' default is download-now, apply-next-launch. Nothing tells the
 * user that, so a single relaunch shows the old bundle and looks like the
 * update never shipped — which is exactly how a Settings section that had been
 * in the code for days appeared to be missing.
 *
 * So: check on launch and on return from background, and when something is
 * there, fetch it and reload straight away. `reloadAsync` never returns.
 * Failures are logged and swallowed on purpose — no connection must never be
 * a reason the app will not start.
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useApplyUpdatesPromptly();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="control-centre" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
