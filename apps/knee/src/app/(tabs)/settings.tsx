// Profile — account state and sign-out. Deliberately small: rows exist only
// for what this build can do (capabilities.ts is the authority), and the
// email upgrade keeps the anonymous history by LINKING (lib/auth.ts).

import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBalance, requestCredits } from '@/lib/api';
import { getLang, setLang, subscribeLang, t as tr, type Lang } from '@/lib/i18n';
import {
  isGoogleSignInAvailable,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAccount,
  type Account,
} from '@/lib/auth';
import { tokens as t } from '@/theme';

export default function Settings() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));

  const [account, setAccount] = useState<Account | null>(null);
  const [lang, setLangState] = useState<Lang>(getLang());
  useEffect(() => subscribeLang(setLangState), []);
  const [balance, setBalance] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    fetchBalance().then((b) => { setBalance(b.balance); setUnlimited(b.unlimited); })
      .catch(() => {});
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToAccount(setAccount), []);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setEmail('');
      setPassword('');
    } catch (e: any) {
      Alert.alert('Sign in', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Profile</Text>

        <View style={s.card}>
          <Text style={s.cardLabel}>Account</Text>
          <Text style={s.body}>
            {account
              ? account.anonymous
                ? 'Guest — your program lives on this device’s account.'
                : account.email ?? account.uid
              : 'Signing in…'}
          </Text>
        </View>

        {account?.anonymous ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>Keep your history</Text>
            <Text style={s.bodyMuted}>
              Sign in so your conversations and, later, your progress survive
              a new phone.
            </Text>
            {isGoogleSignInAvailable() ? (
              <Pressable
                style={s.primary}
                disabled={busy}
                accessibilityRole="button"
                onPress={() => void run(async () => {
                  try {
                    await signInWithGoogle();
                  } catch (e: any) {
                    if (e?.code === 'cancelled') return; // not an error
                    throw e;
                  }
                })}
              >
                <Text style={s.primaryText}>Continue with Google</Text>
              </Pressable>
            ) : null}
            <Text style={s.bodyMuted}>or with email:</Text>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={t.palette.ink.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor={t.palette.ink.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={s.buttonRow}>
              <Pressable
                style={s.primary}
                disabled={busy}
                accessibilityRole="button"
                onPress={() => void run(() => signUpWithEmail(email, password))}
              >
                {busy ? (
                  <ActivityIndicator color={t.palette.accent.interactiveInk} />
                ) : (
                  <Text style={s.primaryText}>Create account</Text>
                )}
              </Pressable>
              <Pressable
                style={s.secondary}
                disabled={busy}
                accessibilityRole="button"
                onPress={() => void run(() => signInWithEmail(email, password))}
              >
                <Text style={s.secondaryText}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={s.secondary}
            accessibilityRole="button"
            onPress={() => void run(signOut)}
          >
            <Text style={s.secondaryText}>Sign out</Text>
          </Pressable>
        )}

        <View style={s.card}>
          <Text style={s.cardLabel}>{tr('profile.language', lang)}</Text>
          <View style={s.buttonRow}>
            {([['en', 'English'], ['hi', 'हिन्दी']] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setLang(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === value }}
                style={lang === value ? s.primary : s.secondary}
              >
                <Text style={lang === value ? s.primaryText : s.secondaryText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.bodyMuted}>
            {lang === 'hi'
              ? 'सब कुछ हिन्दी में — आवाज़, गिनती, और वीडियो हिन्दी ट्रैक पर।'
              : 'Everything follows: labels, the counting voice, and videos open on the Hindi track.'}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>{tr('profile.credits', lang)}</Text>
          <Text style={s.body}>
            {unlimited ? 'Unlimited' : balance === null ? '…' : balance.toLocaleString()}
          </Text>
          {!unlimited ? (
            requested ? (
              <Text style={s.bodyMuted}>{tr('profile.creditsRequested', lang)}</Text>
            ) : (
              <Pressable
                style={s.secondary}
                accessibilityRole="button"
                onPress={() => void requestCredits('KneeFit user request')
                  .then(() => setRequested(true))
                  .catch(() => setRequested(true))}
              >
                <Text style={s.secondaryText}>{tr('profile.requestCredits', lang)}</Text>
              </Pressable>
            )
          ) : null}
        </View>

        <View style={s.card}>
          <Text style={s.cardLabel}>About</Text>
          <Text style={s.bodyMuted}>
            {t.wordmark} — {t.tagline} The program and its videos come from the
            same coach library the chat answers from.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  scroll: { padding: t.space(6), gap: t.space(3.5), paddingBottom: t.space(10) },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  card: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.card,
    padding: t.space(4.5),
    gap: t.space(2),
  },
  cardLabel: {
    ...t.type.scale.eyebrow,
    color: t.palette.ink.muted,
    textTransform: 'uppercase',
  },
  body: { ...t.type.scale.body, color: t.palette.ink.primary },
  bodyMuted: { ...t.type.scale.sub, color: t.palette.ink.muted },
  input: {
    minHeight: t.size.disc,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.button,
    paddingHorizontal: t.space(4),
    ...t.type.scale.body,
    color: t.palette.ink.primary,
    backgroundColor: t.palette.paper.base,
  },
  buttonRow: { flexDirection: 'row', gap: t.space(2.5) },
  primary: {
    flex: 1,
    minHeight: t.size.disc,
    borderRadius: t.radius.button,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk },
  secondary: {
    flex: 1,
    minHeight: t.size.disc,
    borderRadius: t.radius.button,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    backgroundColor: t.palette.paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...t.type.scale.label, color: t.palette.ink.primary },
});
