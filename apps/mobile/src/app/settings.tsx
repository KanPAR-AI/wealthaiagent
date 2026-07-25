// Settings / Account — account info, credits (balance + request + recent usage),
// and sign out. Opened from the drawer profile row.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/auth';
import {
  getCreditBalance, getCreditLedger, requestCredits,
  type CreditBalance, type LedgerEntry,
} from '@/services/credits-service';

function when(ts: number) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toLocaleDateString(); } catch { return ''; }
}

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const { user } = useAuth();

  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getCreditBalance().then(setCredits).catch(() => {}),
      getCreditLedger(30).then((d) => setLedger(d.ledger)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRequest = async () => {
    setRequesting(true);
    try {
      await requestCredits(0, 'Requested from settings');
      Alert.alert('Request sent', 'An admin will review your credit request shortly.');
    } catch (e: any) {
      Alert.alert('Could not request', e?.message ?? 'Try again later.');
    } finally { setRequesting(false); }
  };

  const onSignOut = () => {
    Alert.alert('Sign out', 'Sign out of YourFinAdvisor?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  };

  const usageThisMonth = ledger
    .filter((e) => e.type === 'usage')
    .reduce((s, e) => s + Math.abs(e.credits), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ThemedText type="title" style={styles.back}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Settings</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Account */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>ACCOUNT</ThemedText>
          <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <Row label="Name" value={user?.displayName || (user?.isAnonymous ? 'Guest' : '—')} colors={colors} />
            <Row label="Email" value={user?.email || '—'} colors={colors} />
            <Row label="Phone" value={(user as any)?.phoneNumber || '—'} colors={colors} last />
          </View>

          {/* Credits */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>CREDITS</ThemedText>
          <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.balanceRow}>
              <View>
                <ThemedText type="title">
                  {credits ? (credits.unlimited ? 'Unlimited' : credits.balance.toLocaleString()) : '—'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  credits{!credits?.unlimited && usageThisMonth > 0 ? ` · ${usageThisMonth.toLocaleString()} used recently` : ''}
                </ThemedText>
              </View>
              {!credits?.unlimited && (
                <Pressable
                  onPress={onRequest} disabled={requesting}
                  style={[styles.requestBtn, { borderColor: colors.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: colors.text }}>
                    {requesting ? 'Requesting…' : '＋ Request more'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {/* Recent usage */}
          {ledger.length > 0 && (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>RECENT ACTIVITY</ThemedText>
              <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                {ledger.slice(0, 12).map((e, i) => (
                  <View key={i} style={[styles.usageRow, i < 11 && ledger.length > i + 1 && styles.usageBorder, { borderBottomColor: colors.backgroundSelected }]}>
                    <ThemedText type="small" themeColor="textSecondary">{when(e.ts)} · {e.type.replace(/_/g, ' ')}</ThemedText>
                    <ThemedText type="small" style={{ color: e.credits >= 0 ? '#22a06b' : colors.textSecondary }}>
                      {e.credits >= 0 ? '+' : ''}{e.credits.toLocaleString()}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}

          {loading && <ActivityIndicator color={colors.textSecondary} style={{ marginTop: 12 }} />}

          <Pressable onPress={onSignOut} style={[styles.signOut, { borderColor: colors.backgroundSelected }]}>
            <ThemedText style={{ color: '#e5484d' }}>Sign out</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Row({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="small" numberOfLines={1} style={{ maxWidth: '65%' }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { fontSize: 30, lineHeight: 30 },
  body: { padding: 16, gap: 4, paddingBottom: 40 },
  sectionLabel: { marginTop: 16, marginBottom: 6, letterSpacing: 0.5 },
  card: { borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  requestBtn: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  usageBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  signOut: { marginTop: 24, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
});
