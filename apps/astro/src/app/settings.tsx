// Settings — who you are, what you have, and how to become someone.
//
// The out-of-credits message the backend sends points at "Settings → Credits"
// (chatservice `chats.py:1001`). Until this screen existed, that instruction
// named a place that did not exist in this app.

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAccount,
  type Account,
} from '@/lib/auth';
import { fetchBalance } from '@/lib/credits';
import { tokens } from '@/theme';

export default function Settings() {
  const [account, setAccount] = useState<Account | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => subscribeToAccount(setAccount), []);

  const refreshCredits = useCallback(() => {
    fetchBalance()
      .then((b) => { setCredits(b.balance); setUnlimited(b.unlimited); })
      .catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);

  // Re-read after any account change: credits belong to the uid, and signing
  // in can change which uid that is.
  useEffect(refreshCredits, [refreshCredits, account?.uid]);

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const before = account?.uid;
      const result: any = await fn();
      if (before && result?.uid && result.uid !== before && account?.anonymous) {
        // Honest about the one case linking cannot cover.
        setNotice(
          'Signed in to an existing account. Readings from before this ' +
          'sign-in stay on the earlier anonymous account.',
        );
      }
    } catch (e: any) {
      const code = String(e?.code ?? '');
      if (code.includes('cancel') || /cancel/i.test(String(e?.message ?? ''))) {
        setBusy(null);
        return; // a cancelled sheet is not an error
      }
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }, [account]);

  const signedIn = account && !account.anonymous;
  const version = Constants.expoConfig?.version ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '—';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.cosmicHeader}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={s.back}>‹ Back</Text>
          </Pressable>
          <Text style={s.barTitle}>Profile</Text>
          <View style={s.barSpacer} />
        </View>
        {account ? (
          <View style={s.identity}>
            <Text style={s.identityName}>
              {signedIn
                ? account.displayName || account.email || 'Signed in'
                : 'Guest'}
            </Text>
            <Text style={s.identitySub}>
              {signedIn
                ? account.email && account.displayName
                  ? account.email
                  : `Signed in with ${providerName(account.provider)}`
                : 'Sign in to keep your readings if you change phone.'}
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={tokens.palette.ink.onCosmicMuted} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.body}>

        <Text style={s.section}>Credits</Text>
        <View style={s.card}>
          <Text style={s.line}>
            {credits === null ? '—' : unlimited ? 'Unlimited' : credits.toLocaleString()}
          </Text>
          <Text style={s.sub}>
            Each reading spends credits. New accounts start with a free balance.
          </Text>
        </View>

        {!signedIn ? (
          <>
            <Text style={s.section}>Sign in</Text>
            {isAppleSignInAvailable() ? (
              <Pressable style={s.btn} disabled={!!busy}
                onPress={() => run('apple', signInWithApple)}>
                <Text style={s.btnText}>
                  {busy === 'apple' ? 'Signing in…' : 'Continue with Apple'}
                </Text>
              </Pressable>
            ) : null}
            {isGoogleSignInAvailable() ? (
              <Pressable style={s.btn} disabled={!!busy}
                onPress={() => run('google', signInWithGoogle)}>
                <Text style={s.btnText}>
                  {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={s.btnGhost} onPress={() => setShowEmail((v) => !v)}>
              <Text style={s.btnGhostText}>
                {showEmail ? 'Hide email sign-in' : 'Use email instead'}
              </Text>
            </Pressable>

            {showEmail ? (
              <View style={s.card}>
                <TextInput style={s.input} value={email} onChangeText={setEmail}
                  placeholder="Email" placeholderTextColor={tokens.palette.ink.muted}
                  autoCapitalize="none" keyboardType="email-address" inputMode="email" />
                <TextInput style={s.input} value={password} onChangeText={setPassword}
                  placeholder="Password" placeholderTextColor={tokens.palette.ink.muted} secureTextEntry />
                <View style={s.row}>
                  <Pressable style={[s.btn, s.grow]} disabled={!!busy}
                    onPress={() => run('email', () => signInWithEmail(email, password))}>
                    <Text style={s.btnText}>
                      {busy === 'email' ? 'Signing in…' : 'Sign in'}
                    </Text>
                  </Pressable>
                  <Pressable style={[s.btnGhost, s.grow]} disabled={!!busy}
                    onPress={() => run('signup', () => signUpWithEmail(email, password))}>
                    <Text style={s.btnGhostText}>
                      {busy === 'signup' ? 'Creating…' : 'Create account'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <Pressable style={s.btnGhost} disabled={!!busy}
            onPress={() => run('signout', signOut)}>
            <Text style={s.btnGhostText}>
              {busy === 'signout' ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        )}

        {notice ? <Text style={s.notice}>{notice}</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        <Text style={s.section}>Build</Text>
        <View style={s.card}>
          <Text style={s.sub}>{tokens.wordmark} {version} ({build})</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function providerName(id: string | null): string {
  if (id === 'google.com') return 'Google';
  if (id === 'apple.com') return 'Apple';
  if (id === 'password') return 'email';
  return 'a linked account';
}

const t = tokens;
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  cosmicHeader: {
    backgroundColor: t.palette.cosmic.base,
    paddingBottom: t.space(6),
    gap: t.space(3),
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: t.space(4), paddingVertical: t.space(3),
  },
  back: { ...t.type.scale.body, color: t.palette.accent.ceremonial },
  barTitle: { ...t.type.scale.body, color: t.palette.ink.onCosmic, fontWeight: '600' },
  barSpacer: { width: 52 },
  identity: { alignItems: 'center', gap: t.space(1), paddingHorizontal: t.space(6) },
  identityName: {
    ...t.type.scale.title,
    ...t.type.display,
    color: t.palette.ink.onCosmic,
  },
  identitySub: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted, textAlign: 'center' },
  body: { padding: t.space(5), gap: t.space(2.5), paddingBottom: t.space(12) },
  section: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1, marginTop: t.space(3.5), textTransform: 'uppercase',
  },
  card: {
    backgroundColor: t.palette.paper.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.palette.paper.line,
    borderRadius: t.radius.card, padding: t.space(4), gap: t.space(2),
  },
  line: { ...t.type.scale.lead, color: t.palette.ink.primary },
  sub: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  row: { flexDirection: 'row', gap: t.space(2.5) },
  grow: { flex: 1 },
  btn: {
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button, paddingVertical: t.space(3.5), alignItems: 'center',
  },
  btnText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '600' },
  btnGhost: {
    borderRadius: t.radius.button, paddingVertical: t.space(3.5), alignItems: 'center',
    borderWidth: 1, borderColor: t.palette.paper.line, backgroundColor: t.palette.paper.card,
  },
  btnGhostText: { ...t.type.scale.label, color: t.palette.ink.primary },
  input: {
    ...t.type.scale.body,
    color: t.palette.ink.primary,
    backgroundColor: t.palette.paper.base,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.palette.paper.line,
    borderRadius: t.radius.chip, paddingHorizontal: t.space(3.5), paddingVertical: t.space(3),
  },
  notice: { ...t.type.scale.sub, color: t.palette.accent.interactive },
  error: { ...t.type.scale.sub, color: t.palette.danger },
});
