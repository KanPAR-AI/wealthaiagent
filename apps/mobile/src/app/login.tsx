// Login screen — Phase 2.
//
// Mirrors the web login's provider order, native-first: Apple (required by
// App Store rule 4.8 once Google exists), Google (hidden until the iOS
// OAuth client is configured — see lib/env.GOOGLE_IOS_CLIENT_ID), email,
// and anonymous ("continue without signing in") as the escape hatch.
//
// Quality-bar notes: system-native Apple button (Apple HIG requires their
// component), haptic feedback on primary actions, keyboard-safe email form.

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  isGoogleSignInAvailable,
  signInAnonymously,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';

export default function LoginScreen() {
  const { user, isAuthLoading } = useAuth();
  const rawScheme = useColorScheme();
  const scheme = rawScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  if (!isAuthLoading && user) return <Redirect href="/" />;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fn();
      // Success → useAuth flips → <Redirect> above unmounts this screen.
    } catch (e: any) {
      // Apple/Google user-cancellation isn't an error worth showing.
      const code = e?.code ?? '';
      if (code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED') return;
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}>
          {/* Brand block */}
          <ThemedView style={styles.brand}>
            <ThemedView type="backgroundElement" style={styles.logoBadge}>
              <ThemedText type="title">YF</ThemedText>
            </ThemedView>
            <ThemedText type="title" style={styles.centerText}>
              YourFinAdvisor
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              AI-powered financial guidance
            </ThemedText>
          </ThemedView>

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {!emailMode ? (
            <ThemedView style={styles.buttons}>
              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={
                    scheme === 'dark'
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={12}
                  style={styles.providerButton}
                  onPress={() => run(signInWithApple)}
                />
              )}

              {isGoogleSignInAvailable() && (
                <Pressable
                  disabled={busy}
                  onPress={() => run(signInWithGoogle)}
                  style={({ pressed }) => [
                    styles.providerButton,
                    styles.outlineButton,
                    { borderColor: colors.backgroundSelected, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <ThemedText type="smallBold">Continue with Google</ThemedText>
                </Pressable>
              )}

              <Pressable
                disabled={busy}
                onPress={() => {
                  setError(null);
                  setEmailMode(true);
                }}
                style={({ pressed }) => [
                  styles.providerButton,
                  styles.outlineButton,
                  { borderColor: colors.backgroundSelected, opacity: pressed ? 0.7 : 1 },
                ]}>
                <ThemedText type="smallBold">Continue with Email</ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                or
              </ThemedText>

              <Pressable disabled={busy} onPress={() => run(signInAnonymously)} hitSlop={8}>
                <ThemedText type="link" style={styles.centerText}>
                  Continue without signing in
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <ThemedView style={styles.buttons}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                editable={!busy}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                editable={!busy}
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
              />
              <Pressable
                disabled={busy || !email || password.length < 6}
                onPress={() =>
                  run(() => (isSignUp ? signUpWithEmail(email, password) : signInWithEmail(email, password)))
                }
                style={({ pressed }) => [
                  styles.providerButton,
                  {
                    backgroundColor: colors.text,
                    opacity: pressed || busy || !email || password.length < 6 ? 0.6 : 1,
                  },
                ]}>
                {busy ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: colors.background }}>
                    {isSignUp ? 'Create account' : 'Sign in'}
                  </ThemedText>
                )}
              </Pressable>
              <Pressable disabled={busy} onPress={() => setIsSignUp((v) => !v)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {isSignUp ? 'Have an account? Sign in' : 'New here? Create an account'}
                </ThemedText>
              </Pressable>
              <Pressable disabled={busy} onPress={() => setEmailMode(false)} hitSlop={8}>
                <ThemedText type="link" style={styles.centerText}>
                  Back
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.terms}>
            By continuing, you agree to our Terms of Service
          </ThemedText>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function friendlyAuthError(e: any): string {
  const msg: string = e?.message || String(e);
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('email-already-in-use')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (msg.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (msg.includes('network-request-failed')) {
    return 'Network error. Check your connection and try again.';
  }
  return msg;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.four,
  },
  brand: { alignItems: 'center', gap: Spacing.two },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  centerText: { textAlign: 'center' },
  buttons: { gap: Spacing.three },
  providerButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: { borderWidth: StyleSheet.hairlineWidth * 2 },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: { color: '#e5484d', textAlign: 'center' },
  terms: { textAlign: 'center' },
});
