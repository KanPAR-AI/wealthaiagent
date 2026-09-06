// Profile — one identity card, progressive disclosure (owner: "a lot more
// elegant … account and then connect account; now there is clutter").
//
// The rule: at rest the screen shows WHO YOU ARE and one action. Forms exist
// only after you choose a method — never three input rows and five buttons
// stacked on a first paint. Signed in, methods render as quiet chips with
// one "add" affordance; sign-out is a text action, not a competing button.

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
import Svg, { Circle, Path } from 'react-native-svg';

import { fetchBalance, requestCredits } from '@/lib/api';
import { getLang, setLang, subscribeLang, t as tr, type Lang } from '@/lib/i18n';
import {
  confirmPhoneCode,
  isGoogleSignInAvailable,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  startPhoneVerification,
  subscribeToAccount,
  type Account,
} from '@/lib/auth';
import { tokens as t } from '@/theme';

type ConnectMode = 'closed' | 'email' | 'phone' | 'phone-code';

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
  useEffect(() => subscribeToAccount(setAccount), []);

  const [mode, setMode] = useState<ConnectMode>('closed');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setEmail(''); setPassword(''); setOtp(''); setPhone('');
      setMode('closed');
    } catch (e: any) {
      if (e?.code !== 'cancelled') Alert.alert('Sign in', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, []);

  const guest = !account || account.anonymous;
  const hasGoogle = account?.providers.includes('google.com');

  const identityLine = guest
    ? (lang === 'hi' ? 'अतिथि' : 'Guest')
    : account?.displayName || account?.email || account?.phone || 'Signed in';
  const identitySub = guest
    ? (lang === 'hi'
        ? 'आपका प्रोग्राम इसी डिवाइस पर है'
        : 'Your program lives on this device')
    : [account?.email, account?.phone, hasGoogle ? 'Google' : null]
        .filter(Boolean).join(' · ');

  const connectLabel = guest
    ? (lang === 'hi' ? 'खाता जोड़ें' : 'Connect account')
    : (lang === 'hi' ? 'साइन-इन तरीक़ा जोड़ें' : 'Add a sign-in method');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{tr('tab.profile', lang)}</Text>

        {/* ── the identity card ── */}
        <View style={s.card}>
          <View style={s.idRow}>
            <View style={s.avatar}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={8} r={4} stroke={t.palette.accent.interactiveInk} strokeWidth={2} />
                <Path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"
                  stroke={t.palette.accent.interactiveInk} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.idName}>{identityLine}</Text>
              <Text style={s.idSub} numberOfLines={2}>{identitySub}</Text>
            </View>
          </View>

          {mode === 'closed' ? (
            <View style={s.connectRow}>
              <Pressable
                style={s.primary}
                disabled={busy}
                accessibilityRole="button"
                onPress={() => {
                  if (guest && isGoogleSignInAvailable()) {
                    void run(signInWithGoogle);
                  } else {
                    setMode('email');
                  }
                }}
              >
                {busy ? (
                  <ActivityIndicator color={t.palette.accent.interactiveInk} />
                ) : (
                  <Text style={s.primaryText}>
                    {guest && isGoogleSignInAvailable()
                      ? (lang === 'hi' ? 'Google से जुड़ें' : 'Continue with Google')
                      : connectLabel}
                  </Text>
                )}
              </Pressable>
              <View style={s.quietRow}>
                {guest && isGoogleSignInAvailable() ? (
                  <Pressable onPress={() => setMode('email')} accessibilityRole="button"
                    style={s.quiet} hitSlop={8}>
                    <Text style={s.quietText}>{lang === 'hi' ? 'ईमेल' : 'Email'}</Text>
                  </Pressable>
                ) : null}
                {!account?.phone ? (
                  <Pressable onPress={() => setMode('phone')} accessibilityRole="button"
                    style={s.quiet} hitSlop={8}>
                    <Text style={s.quietText}>{lang === 'hi' ? 'फ़ोन' : 'Phone'}</Text>
                  </Pressable>
                ) : null}
                {!guest && !hasGoogle && isGoogleSignInAvailable() ? (
                  <Pressable onPress={() => void run(signInWithGoogle)}
                    accessibilityRole="button" style={s.quiet} hitSlop={8}>
                    <Text style={s.quietText}>Google</Text>
                  </Pressable>
                ) : null}
                {!guest ? (
                  <Pressable onPress={() => void run(signOut)} accessibilityRole="button"
                    style={s.quiet} hitSlop={8}>
                    <Text style={[s.quietText, { color: t.palette.danger }]}>
                      {lang === 'hi' ? 'साइन आउट' : 'Sign out'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* ── email, only when chosen ── */}
          {mode === 'email' ? (
            <View style={s.form}>
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
              <View style={s.formRow}>
                <Pressable style={[s.primary, { flex: 1 }]} disabled={busy}
                  accessibilityRole="button"
                  onPress={() => void run(() => signUpWithEmail(email, password))}>
                  <Text style={s.primaryText}>{lang === 'hi' ? 'खाता बनाएँ' : 'Create account'}</Text>
                </Pressable>
                <Pressable style={[s.secondary, { flex: 1 }]} disabled={busy}
                  accessibilityRole="button"
                  onPress={() => void run(() => signInWithEmail(email, password))}>
                  <Text style={s.secondaryText}>{lang === 'hi' ? 'साइन इन' : 'Sign in'}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setMode('closed')} accessibilityRole="button"
                style={s.cancel} hitSlop={8}>
                <Text style={s.quietText}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── phone, only when chosen ── */}
          {mode === 'phone' ? (
            <View style={s.form}>
              <View style={s.formRow}>
                <TextInput
                  style={[s.input, { width: 74 }]}
                  placeholder="+91"
                  placeholderTextColor={t.palette.ink.muted}
                  keyboardType="phone-pad"
                  value={countryCode}
                  onChangeText={(v) => setCountryCode(
                    v.startsWith('+') || v === '' ? v : `+${v}`)}
                  accessibilityLabel="Country code"
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={lang === 'hi' ? 'फ़ोन नंबर' : 'Phone number'}
                  placeholderTextColor={t.palette.ink.muted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  accessibilityLabel="Phone number"
                />
              </View>
              <Pressable style={s.primary}
                disabled={busy || phone.trim().length < 6}
                accessibilityRole="button"
                onPress={() => {
                  setBusy(true);
                  startPhoneVerification(`${countryCode.trim() || '+91'}${phone.trim()}`)
                    .then((id) => { setVerificationId(id); setMode('phone-code'); })
                    .catch((e) => Alert.alert('Sign in', String(e?.message ?? e)))
                    .finally(() => setBusy(false));
                }}>
                {busy ? <ActivityIndicator color={t.palette.accent.interactiveInk} />
                      : <Text style={s.primaryText}>{lang === 'hi' ? 'कोड भेजें' : 'Send code'}</Text>}
              </Pressable>
              <Pressable onPress={() => setMode('closed')} accessibilityRole="button"
                style={s.cancel} hitSlop={8}>
                <Text style={s.quietText}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
              </Pressable>
            </View>
          ) : null}

          {mode === 'phone-code' ? (
            <View style={s.form}>
              <Text style={s.idSub}>
                {lang === 'hi'
                  ? `${countryCode}${phone} पर कोड भेजा गया`
                  : `Code sent to ${countryCode}${phone}`}
              </Text>
              <View style={s.formRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={lang === 'hi' ? '6 अंकों का कोड' : '6-digit code'}
                  placeholderTextColor={t.palette.ink.muted}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                />
                <Pressable style={s.primary}
                  disabled={busy || otp.trim().length < 4}
                  accessibilityRole="button"
                  onPress={() => void run(() => confirmPhoneCode(
                    verificationId, otp, `${countryCode.trim() || '+91'}${phone.trim()}`))}>
                  <Text style={s.primaryText}>{lang === 'hi' ? 'पुष्टि करें' : 'Verify'}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setMode('phone')} accessibilityRole="button"
                style={s.cancel} hitSlop={8}>
                <Text style={s.quietText}>{lang === 'hi' ? 'वापस' : 'Back'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* ── language ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>{tr('profile.language', lang)}</Text>
          <View style={s.formRow}>
            {([['en', 'English'], ['hi', 'हिन्दी']] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setLang(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === value }}
                style={[lang === value ? s.primary : s.secondary, { flex: 1 }]}
              >
                <Text style={lang === value ? s.primaryText : s.secondaryText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── credits ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardLabel}>{tr('profile.credits', lang)}</Text>
            <Text style={s.creditNum}>
              {unlimited ? '∞' : balance === null ? '…' : balance.toLocaleString()}
            </Text>
          </View>
          {!unlimited ? (
            requested ? (
              <Text style={s.idSub}>{tr('profile.creditsRequested', lang)}</Text>
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

        <Text style={s.about}>
          {t.wordmark} — {t.tagline}
        </Text>
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
    gap: t.space(3),
  },
  cardLabel: {
    ...t.type.scale.eyebrow,
    color: t.palette.ink.muted,
    textTransform: 'uppercase',
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: t.space(3.5) },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idName: { ...t.type.scale.label, fontSize: 18, color: t.palette.ink.primary },
  idSub: { ...t.type.scale.sub, color: t.palette.ink.muted },
  connectRow: { gap: t.space(2.5) },
  quietRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: t.space(6),
    flexWrap: 'wrap',
  },
  quiet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  quietText: { ...t.type.scale.sub, color: t.palette.accent.interactive, fontWeight: '700' },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  form: { gap: t.space(2.5) },
  formRow: { flexDirection: 'row', gap: t.space(2.5) },
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
  primary: {
    minHeight: t.size.disc,
    borderRadius: t.radius.button,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space(4),
  },
  primaryText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk },
  secondary: {
    minHeight: t.size.disc,
    borderRadius: t.radius.button,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    backgroundColor: t.palette.paper.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space(4),
  },
  secondaryText: { ...t.type.scale.label, color: t.palette.ink.primary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  creditNum: {
    fontSize: 22,
    fontWeight: '700',
    color: t.palette.ink.primary,
    fontVariant: ['tabular-nums'],
  },
  about: {
    ...t.type.scale.sub,
    color: t.palette.ink.muted,
    textAlign: 'center',
    marginTop: t.space(2),
  },
});
