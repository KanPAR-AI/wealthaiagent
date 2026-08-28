// Screen 12 — Profile / Settings, as the board draws it (docs/astral-board/
// 12-profile-settings.png; docs/49 ASTRAL-109): the cosmic header with the
// avatar, name and email; the light sheet riding up over it with rounded
// corners; and the rows.
//
// The rows are DERIVED from `lib/capabilities.ts`, not typed out here. Four
// of ASTRAL-109's five "ships" rows render; Birth Details is declared and
// absent, because ASTRAL-67's reconcile-routed editor does not exist and a
// capability marked absent REMOVES a row rather than greying it.
//
// What must NOT be here, and is not: the "Premium Member · Renews …" bar,
// Subscription & Billing (AMB-1/AMB-2 open, no entitlement backend),
// Notifications (FR-019 has no transport to a phone) and Saved Readings
// (ASTRAL-66's store does not exist). The board draws all four. They are the
// three-plus-one this row explicitly forbids.
//
// The credits view stays: it is what the out-of-credits message points at
// ("Settings → Credits", chatservice `chats.py:1001`) and, per ASTRAL-109, the
// interim honest surface in place of a billing row.

import { router, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
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
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, ChevronRight, SymbolIcon } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
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
import { useReportProblem } from '@/lib/bug-report';
import { visibleRows, type SettingsRow } from '@/lib/settings-rows';
import { tokens } from '@/theme';

const HEADER_HEIGHT = 260;

export default function Settings() {
  // Per-tab status bar, set ON FOCUS. Every tab screen stays MOUNTED, so a
  // declarative `<StatusBar style=…>` leaves whichever screen mounted last in
  // charge — measured: Home → Timeline → Home left the clock dark on the
  // night sky, where it cannot be read.
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));

  const [account, setAccount] = useState<Account | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

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
          'Done — you\u2019re signed in to your existing account. (Guest ' +
          'readings made on this device before signing in stay with the ' +
          'guest session.)',
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

  const reportProblem = useReportProblem();
  const signedIn = account && !account.anonymous;
  const name = signedIn ? account.displayName || account.email || 'Signed in' : 'Guest';
  const rows = visibleRows();

  const press = (row: SettingsRow) => {
    if (row.action.kind === 'expand') setOpenRow((v) => (v === row.id ? null : row.id));
    // The sheet photographs THIS screen before it opens, which is why the row
    // raises it in place rather than routing anywhere (docs/49 ASTRAL-163).
    else if (row.action.kind === 'report') reportProblem();
    else router.push(row.action.to as never);
  };

  return (
    <View style={s.fill}>
      <StatusBar style="light" />

      <View style={s.header}>
        <Svg width="100%" height={HEADER_HEIGHT}>
          <SkyDefs id="profile" />
          <SkyField id="profile" width={2000} height={HEADER_HEIGHT} />
          <Stars width={2000} height={HEADER_HEIGHT} until={0.45} scale={0.8} />
        </Svg>
      </View>

      <SafeAreaView style={s.overlay} edges={['top']}>
        {/* Cream, not gold, and no title: the "‹ Back · Profile" bar that
            shipped was invented — frame 12 has neither, and gold belongs to
            ceremony rather than to chrome. */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
        </Pressable>

        <View style={s.identity}>
          {account ? (
            <>
              {/* The board's photograph, without a photograph: the account's
                  own initial on a violet disc inside a light ring. There is
                  no avatar upload in this build, and a grey silhouette would
                  be an affordance pointing at nothing. */}
              <View style={s.avatar}>
                <Text style={s.avatarInitial}>{initialOf(name)}</Text>
              </View>
              <Text style={s.name}>{name}</Text>
              <Text style={s.email}>
                {signedIn
                  ? account.email && account.displayName
                    ? account.email
                    : `Signed in with ${providerName(account.provider)}`
                  : 'Sign in to keep your readings if you change phone.'}
              </Text>
            </>
          ) : (
            <ActivityIndicator color={tokens.palette.ink.onCosmicMuted} />
          )}
        </View>

        <ScrollView style={s.sheet} contentContainerStyle={s.body}>
          <View style={s.card}>
            {rows.map((row, i) => (
              <View key={row.id}>
                <Pressable
                  style={s.row}
                  onPress={() => press(row)}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                >
                  <SymbolIcon name={row.icon} color={tokens.palette.accent.interactive} />
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <ChevronRight size={tokens.size.icon} color={tokens.palette.ink.muted} />
                </Pressable>

                {openRow === row.id && row.id === 'account' ? (
                  <View style={s.expanded}>
                    {!signedIn ? (
                      <>
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
                          <>
                            <TextInput style={s.input} value={email} onChangeText={setEmail}
                              placeholder="Email" placeholderTextColor={tokens.palette.ink.muted}
                              autoCapitalize="none" keyboardType="email-address" inputMode="email" />
                            <TextInput style={s.input} value={password} onChangeText={setPassword}
                              placeholder="Password" placeholderTextColor={tokens.palette.ink.muted}
                              secureTextEntry />
                            <View style={s.split}>
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
                          </>
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
                  </View>
                ) : null}

                {i < rows.length - 1 ? <View style={s.divider} /> : null}
              </View>
            ))}
          </View>

          <Text style={s.section}>Credits</Text>
          <View style={s.card}>
            <View style={s.creditsBody}>
              <Text style={s.creditsValue}>
                {credits === null ? '—' : unlimited ? 'Unlimited' : credits.toLocaleString()}
              </Text>
              <Text style={s.creditsNote}>
                Each reading spends credits. New accounts start with a free balance.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function initialOf(name: string): string {
  const first = name.trim()[0];
  return first ? first.toUpperCase() : '★';
}

function providerName(id: string | null): string {
  if (id === 'google.com') return 'Google';
  if (id === 'apple.com') return 'Apple';
  if (id === 'password') return 'email';
  return 'a linked account';
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  // Transparent on purpose: this layer rides over the absolute cosmic
  // header, and a paper background here erases the sky (sim pass, defect B).
  overlay: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT,
    backgroundColor: t.palette.cosmic.deep,
    overflow: 'hidden',
  },
  back: { paddingHorizontal: t.space(3), paddingVertical: t.space(2), alignSelf: 'flex-start' },
  identity: { alignItems: 'center', gap: t.space(1.5), paddingHorizontal: t.space(6) },
  avatar: {
    width: t.size.avatar,
    height: t.size.avatar,
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive,
    borderWidth: 2,
    borderColor: t.palette.ink.onCosmic,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.space(1),
  },
  avatarInitial: {
    ...t.type.scale.hero,
    ...t.type.display,
    color: t.palette.ink.onCosmic,
  },
  // Bold SANS: the serif is the wordmark's face, and a person's name set in
  // it read as a second logo.
  name: { ...t.type.scale.title, color: t.palette.ink.onCosmic, fontWeight: '700' },
  email: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted, textAlign: 'center' },
  sheet: {
    flex: 1,
    // the light sheet rides UP over the cosmic header, as frame 12 draws it
    marginTop: t.space(5),
    backgroundColor: t.palette.paper.base,
    borderTopLeftRadius: t.space(6),
    borderTopRightRadius: t.space(6),
  },
  body: { padding: t.space(4), paddingBottom: t.space(12), gap: t.space(2.5) },
  card: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3),
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3.5),
  },
  rowLabel: { ...t.type.scale.label, color: t.palette.ink.primary, flex: 1 },
  /** inset divider — starts past the icon, as the board draws it */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.palette.paper.line,
    marginLeft: t.space(11),
  },
  expanded: { paddingHorizontal: t.space(4), paddingBottom: t.space(4), gap: t.space(2.5) },
  section: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1, marginTop: t.space(3.5), textTransform: 'uppercase',
  },
  creditsBody: { padding: t.space(4), gap: t.space(2) },
  creditsValue: { ...t.type.scale.lead, color: t.palette.ink.primary },
  creditsNote: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  split: { flexDirection: 'row', gap: t.space(2.5) },
  grow: { flex: 1 },
  btn: {
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button, paddingVertical: t.space(3.5), alignItems: 'center',
  },
  btnText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '600' },
  btnGhost: {
    borderRadius: t.radius.button, paddingVertical: t.space(3.5), alignItems: 'center',
    borderWidth: 1, borderColor: t.palette.paper.line, backgroundColor: t.palette.paper.base,
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
