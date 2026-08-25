// Screen 9 — Life Timeline, dasha-first (docs/astral-board/09-life-timeline.png;
// docs/49 ASTRAL-127).
//
// ── dasha-first, and what that changes ────────────────────────────────────
//
// ASTRAL-114 treated the dasha layer as a stable secondary under a transit
// headline. In the Vedic frame the dasha PERIODS are the headline — that is
// what an Indian user opens a timeline for — with the transit windows folded
// in around them. So the row containing today comes first, always, and the
// ordering lives in `timeline-view.rows()` rather than in this file's JSX,
// which is the only way it can stay true under a year filter.
//
// A time-less chart gets the transit layer with the dasha layer NAMED AS
// ABSENT in the headline slot (AMB-16(b)) — a prominent absence, honestly
// rendered. Never a quiet transit-only timeline.
//
// ── the year pills are a filter, not four queries ─────────────────────────
//
// The WHOLE computed set arrives in one response with the years it covers.
// A pill tap is `setYear`, filtering an array already in memory: the dasha
// half is a pure function of birth data and is byte-identical in 2035, so
// asking the server for a year would be asking it to recompute what cannot
// change (ASTRAL-52). There is exactly one fetch on this screen.
//
// No category on any row was decided here: `categories` arrives per period,
// computed from the chart's own house lordships (`timeline.py:categorise`).

import { router, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { track } from '@/lib/analytics';
import { fetchTimeline } from '@/lib/people';
import type { TimelineResponse } from '@/lib/people-shapes';
import { absentView, isReady, rows, yearPills, type TimelineRow } from '@/lib/timeline-view';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; res: TimelineResponse };

export default function Timeline() {
  // Per-tab status bar, set ON FOCUS. Every tab screen stays MOUNTED, so a
  // declarative `<StatusBar style=…>` leaves whichever screen mounted last in
  // charge — measured: Home → Timeline → Home left the clock dark on the
  // night sky, where it cannot be read.
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));

  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [year, setYear] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(false);

  const read = useCallback((manual = false) => {
    if (manual) setRefreshing(true);
    return fetchTimeline()
      .then((res) => {
        setLoad({ phase: 'done', res });
        track('timeline_shown', { state: res.state });
      })
      .catch((e: unknown) =>
        setLoad({ phase: 'error', message: String((e as Error)?.message ?? e) }),
      )
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (asked.current && load.phase === 'done') return;   // one read a visit
      asked.current = true;
      void read();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [read]),
  );

  const res = load.phase === 'done' ? load.res : null;
  const artifact = res && isReady(res) ? res.timeline : null;
  const pills = artifact ? yearPills(artifact) : [];
  // Memoised on (artifact, year) so a pill tap re-filters rather than
  // re-deriving on every render — and so nothing on this screen can be
  // mistaken for a fetch.
  const visible: TimelineRow[] = useMemo(
    () => (artifact ? rows(artifact, year) : []),
    [artifact, year],
  );

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}>
          <Text style={s.title}>Your Timeline</Text>
          <Text style={s.sub}>Your dasha periods, and the transits around them</Text>
        </View>

        {pills.length ? (
          // A WRAPPING ROW, not a horizontal ScrollView: nested inside a
          // column the scroll view took the free height and clipped its own
          // pills in half (measured, twice, on the simulator). Five pills fit
          // a phone; a sixth wraps rather than scrolling out of sight.
          <View style={s.pills}>
            <Pill label="All" on={year === null} onPress={() => setYear(null)} />
            {pills.map((y) => (
              <Pill
                key={y}
                label={String(y)}
                on={year === y}
                onPress={() => {
                  // The entire interaction. The set is already here.
                  setYear(y);
                  track('timeline_year', { year: y });
                }}
              />
            ))}
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => read(true)} />}
        >
          {load.phase === 'loading' ? (
            <ActivityIndicator color={tokens.palette.accent.interactive} />
          ) : null}

          {load.phase === 'error' ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>We couldn’t reach your timeline</Text>
              <Text style={s.cardBody}>{load.message}</Text>
              <Pressable style={s.cta} onPress={() => read(true)}>
                <Text style={s.ctaText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {res && !isReady(res) ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>{absentView(res).title}</Text>
              <Text style={s.cardBody}>{absentView(res).body}</Text>
              {absentView(res).action ? (
                <Pressable
                  style={s.cta}
                  onPress={() => {
                    // One ask, one destination — the same decision Home
                    // makes, because it is one condition about one chart.
                    const v = absentView(res);
                    router.push(
                      v.destination === 'details'
                        ? { pathname: '/birth-details', params: { opening: v.turn! } }
                        : { pathname: '/chat', params: { pending: v.turn! } },
                    );
                  }}
                >
                  <Text style={s.ctaText}>{absentView(res).action}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {visible.map((row) => (
            <Row key={row.id} row={row} />
          ))}

          {artifact && visible.length === 0 ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Nothing in {year}</Text>
              <Text style={s.cardBody}>
                No period or transit window on your chart covers that year.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.pill, on && s.pillOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <Text style={[s.pillText, on && s.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

/**
 * One row. The CURRENT period wears the mark; an absence wears none and says
 * plainly what is not there — in a dasha-first design that absence stands
 * where the periods would be, which is where `rows()` puts it.
 */
function Row({ row }: { row: TimelineRow }) {
  const absent = row.kind === 'absence';
  return (
    <View style={[s.row, row.current && !absent && s.rowNow, absent && s.rowAbsent]}>
      <View style={s.rowHead}>
        <Text style={[s.rowTitle, absent && s.rowTitleAbsent]}>{row.title}</Text>
        {row.current && !absent ? <Text style={s.now}>Now</Text> : null}
      </View>
      {row.range ? <Text style={s.rowRange}>{row.range}</Text> : null}
      {row.subtitle ? <Text style={s.rowSub}>{row.subtitle}</Text> : null}
      {row.kind === 'transit' ? <Text style={s.rowKind}>Transit window</Text> : null}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  safe: { flex: 1 },
  head: { paddingHorizontal: t.space(4), paddingTop: t.space(2), alignItems: 'center', gap: 2 },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  sub: { ...t.type.scale.caption, color: t.palette.ink.muted },

  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
    gap: t.space(2),
    alignItems: 'center',
  },
  pill: {
    paddingVertical: t.space(1.5),
    paddingHorizontal: t.space(4),
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  pillOn: { backgroundColor: t.palette.cosmic.base, borderColor: t.palette.cosmic.base },
  pillText: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  pillTextOn: { color: t.palette.ink.onCosmic, fontWeight: '700' },

  body: { padding: t.space(4), paddingBottom: t.space(10), gap: t.space(3) },
  row: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(3.5),
    gap: t.space(1),
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  rowNow: { borderColor: t.palette.accent.interactive, borderWidth: 2 },
  rowAbsent: { backgroundColor: 'transparent' },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space(2) },
  rowTitle: { ...t.type.scale.label, color: t.palette.ink.primary, fontWeight: '700', flexShrink: 1 },
  rowTitleAbsent: { color: t.palette.ink.secondary },
  now: {
    ...t.type.scale.caption,
    color: t.palette.accent.interactiveInk,
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space(2),
    paddingVertical: 2,
    overflow: 'hidden',
    fontWeight: '700',
  },
  rowRange: { ...t.type.scale.caption, color: t.palette.ink.muted },
  rowSub: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  rowKind: { ...t.type.scale.caption, color: t.palette.ink.muted },

  card: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(4),
    gap: t.space(2),
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  cardTitle: { ...t.type.scale.lead, color: t.palette.ink.primary, fontWeight: '700' },
  cardBody: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.interactiveInk, fontWeight: '700' },
});
