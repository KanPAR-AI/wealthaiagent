// docs/64 W-1 (owner, 2026-09-17: "How to view the prediction for two days
// later"). ONE day's card, opened from a dot on Home's week strip. The
// same read Home uses with a date the STRIP supplied (`GET /people/self/
// daily?date=…`, bounded server-side); the same view module renders it.
// Nothing here is computed: the date, the weekday, the band, the reasons,
// the clocks and the couple's bands all arrive from the engine.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import {
  absences, cardDate, coupleCard, dayView, isReady, panchangLine, transitLines,
  type DayView,
} from '@/lib/daily-view';
import { maskedPlaceName } from '@/lib/birth-privacy-view';
import { useBirthPrivacy } from '@/lib/birth-privacy';
import { fetchDaily } from '@/lib/people';
import type { DailyResponse } from '@/lib/people-shapes';
import { routeIsLive } from '@/lib/tabs';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; res: DailyResponse };

export default function Day() {
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));
  useEffect(() => { if (!routeIsLive('/day')) router.replace('/home'); }, []);
  const { date } = useLocalSearchParams<{ date?: string }>();
  // The one app-wide unlock (owner 2026-09-19) — this screen names the place
  // the day was scored for, twice.
  const birthRevealed = useBirthPrivacy((st) => st.revealed());
  const [load, setLoad] = useState<Load>({ phase: 'loading' });

  useEffect(() => {
    if (!date) { setLoad({ phase: 'error', message: 'No day was asked for.' }); return; }
    track('day_open', { date });
    setLoad({ phase: 'loading' });
    fetchDaily(date)
      .then((res) => setLoad({ phase: 'done', res }))
      .catch((e: unknown) => setLoad({ phase: 'error', message: String((e as Error)?.message ?? e) }));
  }, [date]);

  const res = load.phase === 'done' ? load.res : null;
  const view: DayView | null = res && isReady(res) ? dayView(res.card) : null;
  const couple = res && isReady(res) ? coupleCard(res) : null;

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.fill} edges={['top']}>
        <View style={s.navRow}>
          <Pressable style={s.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
          </Pressable>
          <Text style={s.navTitle}>{res && isReady(res) ? cardDate(res.card) : 'That day'}</Text>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {load.phase === 'loading' ? <ActivityIndicator color={tokens.palette.accent.interactive} /> : null}
          {load.phase === 'error' ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>We couldn’t reach that day</Text>
              <Text style={s.cardBody}>{load.message}</Text>
            </View>
          ) : null}
          {res && !isReady(res) ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>No card for that day</Text>
              <Text style={s.cardBody}>Your chart has to be on file first — Home explains what is missing.</Text>
            </View>
          ) : null}

          {res && isReady(res) && view ? (
            <>
              <View style={s.card}>
                <View style={s.bandRow}>
                  <View style={[s.bandPill, { backgroundColor: tokens.palette.day[view.band] }]}>
                    <Text style={[s.bandPillText, { color: tokens.palette.day[`${view.band}Ink`] }]}>{view.label}</Text>
                  </View>
                  {res.is_today ? <Text style={s.caption}>today</Text> : null}
                </View>
                <Text style={s.cardBody}>{view.line}</Text>
                {/* Owner 2026-09-19: the birth place is a locked fact
                    wherever it is named. The card's own `basis` decides
                    (`maskedPlaceName`); a city the user set stays. */}
                {view.place ? (
                  <Text style={s.caption}>
                    scored for {maskedPlaceName(
                      { name: view.place, basis: view.placeBasis }, birthRevealed,
                    )}, from your Moon
                  </Text>
                ) : null}
                {view.notYours ? <Text style={s.caption}>{view.notYours}.</Text> : null}
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>Why</Text>
                {view.reasons.map((r) => <Text key={r} style={s.bullet}>• {r}</Text>)}
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>The clock</Text>
                {view.rahuKaal ? <Text style={s.bullet}>• Rahu Kaal {view.rahuKaal} — keep beginnings out of it</Text> : null}
                {view.rahuKaalAbsent ? <Text style={s.bullet}>• Rahu Kaal not stated: {view.rahuKaalAbsent}</Text> : null}
                {view.golden.length ? <Text style={s.bullet}>• Golden {view.golden.join(' · ')} — the big ask goes here</Text>
                  : view.momentsAbsent ? null : <Text style={s.bullet}>• No golden window — that is the day, not a gap</Text>}
                {view.silence.length ? <Text style={s.bullet}>• Silence {view.silence.join(' · ')} — lie low</Text> : null}
                {view.momentsAbsent ? <Text style={s.bullet}>• Moments not stated: {view.momentsAbsent}</Text> : null}
              </View>

              {couple && couple.mode === 'couple' ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>{couple.title}</Text>
                  {couple.body ? <Text style={s.cardBody}>{couple.body}</Text> : null}
                  {couple.lines.map((line) => <Text key={line} style={s.bullet}>• {line}</Text>)}
                </View>
              ) : null}

              {transitLines(res.card).length ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>The sky that day</Text>
                  {transitLines(res.card).map((line) => (
                    <Text key={line.id} style={s.bullet}><Text style={s.lead}>{line.label}</Text> {line.value}</Text>
                  ))}
                  {panchangLine(res.card) ? (
                    <Text style={s.caption}>
                      {panchangLine(res.card)!.value} · for{' '}
                      {maskedPlaceName(res.card.panchang?.panchang_place, birthRevealed)
                        ?? panchangLine(res.card)!.place}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {absences(res.card).map((entry) => (
                <View key={entry.layer} style={s.absence}>
                  <Text style={s.absenceTitle}>{entry.layer[0].toUpperCase() + entry.layer.slice(1)} — not shown</Text>
                  <Text style={s.caption}>{entry.reason}.</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: t.space(2), paddingRight: t.space(4) },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  navTitle: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  body: { padding: t.space(4), paddingBottom: t.space(10), gap: t.space(3) },
  card: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    padding: t.space(4),
    gap: t.space(2),
    borderWidth: 1,
    borderColor: t.palette.cosmic.line,
  },
  cardTitle: { ...t.type.scale.lead, color: t.palette.ink.onCosmic, fontWeight: '700' },
  cardBody: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  caption: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  bullet: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  lead: { fontWeight: '700', color: t.palette.ink.onCosmic },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: t.space(2) },
  bandPill: { borderRadius: t.radius.pill, paddingVertical: t.space(1), paddingHorizontal: t.space(2.5) },
  bandPillText: { ...t.type.scale.caption, fontWeight: '700' },
  absence: { borderRadius: t.radius.card, padding: t.space(3.5), gap: t.space(1), borderWidth: 1, borderColor: t.palette.cosmic.line },
  absenceTitle: { ...t.type.scale.label, color: t.palette.ink.onCosmicMuted, fontWeight: '700' },
});
