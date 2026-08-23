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
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.barTitle}>Settings</Text>
        <View style={s.barSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.section}>Account</Text>
        <View style={s.card}>
          {account ? (
            <>
              <Text style={s.line}>
                {signedIn
                  ? account.email || account.displayName || 'Signed in'
                  : 'Not signed in — using a guest account'}
              </Text>
              <Text style={s.sub}>
                {signedIn
                  ? `Signed in with ${providerName(account.provider)}`
                  : 'Sign in to keep your readings if you change phone.'}
              </Text>
            </>
          ) : (
            <ActivityIndicator color="#9aa4b2" />
          )}
        </View>

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
                  placeholder="Email" placeholderTextColor="#6b7480"
                  autoCapitalize="none" keyboardType="email-address" inputMode="email" />
                <TextInput style={s.input} value={password} onChangeText={setPassword}
                  placeholder="Password" placeholderTextColor="#6b7480" secureTextEntry />
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
          <Text style={s.sub}>Astral AI {version} ({build})</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0e1116' },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222933',
  },
  back: { color: '#c9a227', fontSize: 16 },
  barTitle: { color: '#f4efe6', fontSize: 16, fontWeight: '600' },
  barSpacer: { width: 52 },
  body: { padding: 20, gap: 10, paddingBottom: 48 },
  section: { color: '#6b7480', fontSize: 12, letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' },
  card: { backgroundColor: '#161b22', borderRadius: 14, padding: 16, gap: 8 },
  line: { color: '#f4efe6', fontSize: 17 },
  sub: { color: '#9aa4b2', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  btn: { backgroundColor: '#c9a227', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#0e1116', fontSize: 15, fontWeight: '600' },
  btnGhost: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#3a4350',
  },
  btnGhostText: { color: '#e8e3da', fontSize: 15 },
  input: {
    color: '#f4efe6', fontSize: 16, backgroundColor: '#0e1116',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  notice: { color: '#c9a227', fontSize: 13, lineHeight: 19 },
  error: { color: '#e0736d', fontSize: 13, lineHeight: 19 },
});
