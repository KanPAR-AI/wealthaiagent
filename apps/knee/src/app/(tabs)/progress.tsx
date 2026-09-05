// Progress — streak, the Flow-3 phase gate, and pain check-outs, every
// number computed server-side by GET /knee/progress. Live since the session
// store shipped; the empty state is a designed state, not a spinner.

import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchProgress, type WireProgress } from '@/lib/api';
import { getLang, subscribeLang, t } from '@/lib/i18n';
import { localDate } from '@/lib/session-view';
import { phaseColor, tokens as tk } from '@/theme';

export default function Progress() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);

  const [p, setP] = useState<WireProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    fetchProgress(localDate())
      .then((v) => { setP(v); setError(null); })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []));

  const accent = phaseColor('2');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t('progress.title', lang)}</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {p && p.sessions_recorded === 0 ? (
          <View style={s.card}>
            <Text style={s.body}>{t('progress.empty', lang)}</Text>
          </View>
        ) : null}

        {p && p.sessions_recorded > 0 ? (
          <>
            <View style={s.card}>
              <Text style={s.big}>
                {p.streak_days}
                <Text style={s.bigUnit}>  {t('session.streak', lang)}</Text>
              </Text>
              <Text style={s.sub}>
                {p.sessions_recorded} {t('progress.sessions', lang)}
                {p.today_done ? ` · ${t('today.done', lang)}` : ''}
              </Text>
            </View>

            <View style={[s.card, { borderColor: '#DFCFA3', backgroundColor: '#F2E9D4' }]}>
              <View style={s.rowBetween}>
                <Text style={[s.label, { color: accent }]}>{t('progress.gate', lang)}</Text>
                <Text style={[s.sub, { color: accent }]}>
                  {p.gate.pain_free_days} / {p.gate.needed} {t('progress.gateDays', lang)}
                </Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, {
                  width: `${Math.round(100 * p.gate.pain_free_days / p.gate.needed)}%`,
                  backgroundColor: accent,
                }]} />
              </View>
            </View>

            {p.pain.length ? (
              <View style={s.card}>
                <Text style={s.label}>{t('progress.painTrend', lang)}</Text>
                <View style={s.painRow}>
                  {[...p.pain].reverse().map((row) => (
                    <View key={row.date} style={s.painCol}>
                      <View style={[s.painBar, {
                        height: 6 + row.pain * 6,
                        backgroundColor: row.pain <= 2
                          ? tk.palette.success
                          : row.pain <= 5 ? accent : tk.palette.danger,
                      }]} />
                      <Text style={s.painDay}>{row.date.slice(8)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tk.palette.paper.base },
  scroll: { padding: tk.space(6), gap: tk.space(3.5), paddingBottom: tk.space(10) },
  title: { ...tk.type.scale.title, ...tk.type.display, color: tk.palette.ink.primary },
  error: { ...tk.type.scale.sub, color: tk.palette.danger },
  card: {
    backgroundColor: tk.palette.paper.card,
    borderWidth: 1,
    borderColor: tk.palette.paper.line,
    borderRadius: tk.radius.card,
    padding: tk.space(4.5),
    gap: tk.space(2.5),
  },
  body: { ...tk.type.scale.body, color: tk.palette.ink.secondary },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '700', color: tk.palette.ink.primary },
  bigUnit: { ...tk.type.scale.body, color: tk.palette.ink.muted },
  sub: { ...tk.type.scale.sub, color: tk.palette.ink.muted },
  label: {
    ...tk.type.scale.eyebrow,
    color: tk.palette.ink.muted,
    textTransform: 'uppercase',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  painRow: { flexDirection: 'row', gap: tk.space(2), alignItems: 'flex-end' },
  painCol: { alignItems: 'center', gap: 4 },
  painBar: { width: 14, borderRadius: 4 },
  painDay: { ...tk.type.scale.caption, color: tk.palette.ink.muted },
});
