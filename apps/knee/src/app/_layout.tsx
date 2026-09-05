import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ensureChatHostInstalled } from '@/lib/chat-host';
import { initLang } from '@/lib/i18n';
import { ensureCoreInitialized } from '@/lib/core-adapter';
import { tokens } from '@/theme';

// Install this app's PlatformAdapter and chat capabilities before any screen
// imports the shared chat client (the astro boot order).
ensureCoreInitialized();
ensureChatHostInstalled();
initLang();

/** Take a published update on THIS launch — same fix as apps/astro and
 *  apps/mobile; expo-updates' apply-next-launch default bit both. */
function useApplyUpdatesPromptly() {
  useEffect(() => {
    if (__DEV__) return;
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
  useApplyUpdatesPromptly();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.palette.paper.base },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="player" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
