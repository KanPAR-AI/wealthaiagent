import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ensureChatHostInstalled } from '@/lib/chat-host';
import { getLang, initLang, subscribeLang, t } from '@/lib/i18n';
import { track } from '@/lib/telemetry';
import * as updateView from '@/lib/update-view';
import { ensureCoreInitialized } from '@/lib/core-adapter';
import { tokens } from '@/theme';

// Install this app's PlatformAdapter and chat capabilities before any screen
// imports the shared chat client (the astro boot order).
ensureCoreInitialized();
ensureChatHostInstalled();
initLang();

/** Fetch a published update on launch/foreground, then ASK — a popup with
 *  "Update now / Later" — instead of the silent immediate reload this hook
 *  used to do (owner ask 2026-09-11: a reload the user didn't choose can yank
 *  the app out from under them mid-workout). "Later" applies on the next cold
 *  start, expo-updates' default for an already-fetched update. Decisions live
 *  in the pure update-view module; this is the plumbing + the modal. */
function useUpdatePrompt() {
  const [prompt, setPrompt] = useState(updateView.initialState);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (__DEV__) return;
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        const id = fetched.manifest && 'id' in fetched.manifest
          ? String(fetched.manifest.id) : null;
        idRef.current = id;
        setPrompt((s) => updateView.onFetched(s, id));
      } catch (e: any) {
        console.warn('[updates]', String(e?.message ?? e));
      } finally {
        running = false;
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, []);

  const accept = () => {
    setPrompt(updateView.onAccepted);
    void Updates.reloadAsync().catch((e: any) =>
      console.warn('[updates] reload failed', String(e?.message ?? e)));
  };
  const defer = () => setPrompt((s) => updateView.onDeferred(s, idRef.current));
  return { ready: prompt.ready, accept, defer };
}

/** The popup itself — Terra card over a scrim, no navigation dependency so it
 *  renders safely above any screen (including the session modal). */
function UpdatePopup({ ready, accept, defer }: {
  ready: boolean; accept: () => void; defer: () => void;
}) {
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);
  if (!ready) return null;
  return (
    <View style={up.scrim} pointerEvents="auto">
      <View style={up.card}>
        <Text style={up.title}>{t('update.title', lang)}</Text>
        <Text style={up.body}>{t('update.body', lang)}</Text>
        <Pressable onPress={accept} accessibilityRole="button" style={up.primary}>
          <Text style={up.primaryText}>{t('update.now', lang)}</Text>
        </Pressable>
        <Pressable onPress={defer} accessibilityRole="button" style={up.later} hitSlop={8}>
          <Text style={up.laterText}>{t('update.later', lang)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const up = StyleSheet.create({
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(32,43,34,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: tokens.space(6),
    zIndex: 1000,
  },
  card: {
    width: '100%', maxWidth: 360,
    backgroundColor: tokens.palette.paper.card,
    borderRadius: 20, padding: tokens.space(6), gap: tokens.space(3),
  },
  title: { ...tokens.type.scale.heading, ...tokens.type.display, color: tokens.palette.ink.primary },
  body: { ...tokens.type.scale.body, color: tokens.palette.ink.secondary },
  primary: {
    marginTop: tokens.space(2), height: 52, borderRadius: 14,
    backgroundColor: tokens.palette.accent.interactive,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { ...tokens.type.scale.label, color: tokens.palette.accent.interactiveInk },
  later: { alignItems: 'center', paddingVertical: tokens.space(2) },
  laterText: { ...tokens.type.scale.sub, color: tokens.palette.ink.muted, fontWeight: '700' },
});

export default function RootLayout() {
  const updatePrompt = useUpdatePrompt();
  useEffect(() => { track('app_open'); }, []);   // very basic engagement telemetry
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* statusBarTranslucent/navigationBarTranslucent: required for the
          keyboard-controller to measure the keyboard under Android
          edge-to-edge — without them the composer sits behind the keyboard
          (owner-reported: send button hidden). No effect on iOS. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
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
      <UpdatePopup {...updatePrompt} />
    </GestureHandlerRootView>
  );
}
