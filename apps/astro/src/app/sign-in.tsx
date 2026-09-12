// The sign-in gate (owner ruling, 2026-09-12: "make sign in mandatory for
// any reading").
//
// One ceremony screen, pushed by any surface `readingBlocked` stops. The
// providers are the SAME functions Settings' account block calls
// (`lib/auth.ts` — Google links the anonymous uid via `attach`, so a
// guest's balance survives signing in; that migration discipline is
// auth.ts's, not this screen's). On success it simply goes back: the
// surface that pushed it re-checks the account and proceeds.
//
// The screen never signs anyone out and holds no state of its own beyond
// the form; every decision string lives in `lib/auth-gate.ts`, tested at
// the root.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { ChevronLeft } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { track } from '@/lib/analytics';
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeToAccount,
  type Account,
} from '@/lib/auth';
import { GATE_BODY, GATE_TITLE, readingBlocked } from '@/lib/auth-gate';
import { tokens } from '@/theme';

const HEADER_HEIGHT = 180;

export default function SignIn() {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => subscribeToAccount(setAccount), []);

  // Signed in (or already was): the gate has nothing to hold. Back to the
  // surface that pushed us — it re-reads the account and proceeds.
  useEffect(() => {
    if (account && !readingBlocked(account)) {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [account]);

  const run = useCallback(async (kind: string, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      track('gate_sign_in', { kind });
    } catch (e: any) {
      // A cancelled provider sheet is a choice, not an error to shout.
      const msg = String(e?.message ?? e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy(null);
    }
  }, []);

  const emailReady = email.trim().length > 3 && password.length >= 6;

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Svg width="100%" height={HEADER_HEIGHT}>
          <SkyDefs id="gate" />
          <SkyField id="gate" width={2000} height={HEADER_HEIGHT} />
          <Stars width={2000} height={HEADER_HEIGHT} until={0.5} scale={0.8} />
        </Svg>
      </View>
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
        </Pressable>

        <KeyboardAvoidingView
          style={s.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.title}>{GATE_TITLE}</Text>
            <Text style={s.sub}>{GATE_BODY}</Text>

            {isGoogleSignInAvailable() ? (
              <Pressable
                style={s.provider}
                onPress={() => run('google', signInWithGoogle)}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                {busy === 'google' ? (
                  <ActivityIndicator color={tokens.palette.ink.primary} />
                ) : (
                  <Text style={s.providerText}>Continue with Google</Text>
                )}
              </Pressable>
            ) : null}

            {isAppleSignInAvailable() ? (
              <Pressable
                style={s.provider}
                onPress={() => run('apple', signInWithApple)}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                {busy === 'apple' ? (
                  <ActivityIndicator color={tokens.palette.ink.primary} />
                ) : (
                  <Text style={s.providerText}>Continue with Apple</Text>
                )}
              </Pressable>
            ) : null}

            <Text style={s.divider}>or with email</Text>

            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={tokens.palette.ink.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.input}
              placeholder="Password (6+ characters)"
              placeholderTextColor={tokens.palette.ink.muted}
              secureTextEntry
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              style={[s.cta, !emailReady && s.ctaDisabled]}
              disabled={!emailReady || !!busy}
              onPress={() =>
                run('email', () =>
                  mode === 'create'
                    ? signUpWithEmail(email.trim(), password)
                    : signInWithEmail(email.trim(), password))}
              accessibilityRole="button"
              accessibilityLabel={mode === 'create' ? 'Create account' : 'Sign in'}
            >
              {busy === 'email' ? (
                <ActivityIndicator color={tokens.palette.accent.ceremonialInk} />
              ) : (
                <Text style={s.ctaText}>
                  {mode === 'create' ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setMode((m) => (m === 'create' ? 'signin' : 'create'))}
              accessibilityRole="button"
            >
              <Text style={s.switchLine}>
                {mode === 'create'
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT,
    backgroundColor: t.palette.cosmic.deep,
  },
  overlay: { flex: 1 },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: {
    paddingHorizontal: t.space(5),
    paddingTop: t.space(20),
    paddingBottom: t.space(10),
    gap: t.space(3),
  },
  title: {
    ...t.type.display, ...t.type.scale.title,
    color: t.palette.ink.primary,
  },
  sub: { ...t.type.scale.sub, color: t.palette.ink.secondary,
         marginBottom: t.space(2) },
  provider: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1, borderColor: t.palette.paper.line,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5), alignItems: 'center',
  },
  providerText: { ...t.type.scale.label, color: t.palette.ink.primary },
  divider: { ...t.type.scale.caption, color: t.palette.ink.muted,
             textAlign: 'center', marginVertical: t.space(1) },
  input: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1, borderColor: t.palette.paper.line,
    borderRadius: t.radius.input,
    paddingHorizontal: t.space(4), paddingVertical: t.space(3),
    ...t.type.scale.body, color: t.palette.ink.primary,
  },
  error: { ...t.type.scale.sub, color: t.palette.danger },
  cta: {
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5), alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.ceremonialInk },
  switchLine: { ...t.type.scale.sub, color: t.palette.accent.interactive,
                textAlign: 'center', marginTop: t.space(2) },
});
