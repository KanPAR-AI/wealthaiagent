// Screen 5 — Your Birth Chart: Chart · Grahas · Dasha
// (docs/astral-board/05-birth-chart-overview.png; docs/49 ASTRAL-120,
// ASTRAL-233..238).
//
// ── what this screen is, and why it could not exist until now ─────────────
//
// The one artifact this whole product is about was reachable only inside a
// chat turn: `person_view` attaches a chart SUMMARY, and no `GET` anywhere
// returned a chart's contents (F82). So "show me my chart" was a
// conversation. `GET /people/{id}/chart` (ASTRAL-229) is the read this screen
// is the other half of, and the Home tile that used to redirect to Profile
// now lands here (F93).
//
// ── it costs nothing to open ─────────────────────────────────────────────
//
// One `GET`. No ephemeris second, no model call, no credit, and no chat turn
// (ASTRAL-135/242). There is deliberately no refresh-into-recompute control:
// no such endpoint exists, and a stale chart is drawn stale UNDER ITS CAUSE
// (ASTRAL-238) rather than quietly refreshed.
//
// ── every decision is next door ──────────────────────────────────────────
//
// `lib/chart-view.ts` is pure and unit-tested at the workspace root; this
// file renders what it returns and decides nothing. In particular it computes
// no rashi number, no navamsa sign and no dasha length — the engine labels
// every cell (ASTRAL-230), which is why there is no arithmetic below.

import { router, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { ChartDiamond } from '@wealthai/astral';
import { rnPrimitives } from '@wealthai/astral-native';

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { track } from '@/lib/analytics';
import { astroChartTheme } from '@/lib/chart-theme';
import {
  absentModels,
  birthLines,
  currentPeriod,
  columns,
  dashaRows,
  drawnCharts,
  planetRows,
  registerNotes,
  stampLine,
  surfaceState,
  tabs,
  timelessNote,
  yogaCards,
  type ChartTabId,
  type DrawnChart,
  type PlanetRow,
} from '@/lib/chart-view';
import { fetchChart, fetchSelf } from '@/lib/people';
import { routeIsLive } from '@/lib/tabs';
import type { ChartResponse } from '@/lib/people-shapes';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'absent'; reason: string }
  | { phase: 'done'; res: ChartResponse };

const HEADER_HEIGHT = 168;

/** The turn that opens the birth-details arc for a user who has none yet.
 *  A SENTENCE, never a value: nothing this app routes carries a birth fact. */
const ESTABLISH_TURN = "I'd like my birth chart.";

export default function Chart() {
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));

  // ASTRAL-233: an absent capability REMOVES the route, not only the tile.
  // expo-router builds its table from the file system, so a deep link or a
  // stale push would otherwise reach a screen this build cannot serve —
  // which is the greyed affordance in its most confusing form: a whole
  // screen with nothing behind it.
  useEffect(() => {
    if (!routeIsLive('/chart')) router.replace('/home');
  }, []);

  const { width } = useWindowDimensions();
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [tab, setTab] = useState<ChartTabId>('chart');
  const [refreshing, setRefreshing] = useState(false);

  const read = useCallback((manual = false) => {
    if (manual) setRefreshing(true);
    // `self` first, because "you have no chart" and "we could not read your
    // chart" are different sentences and only the store can tell them apart.
    return fetchSelf()
      .then((self) => {
        if (!self.person) {
          setLoad({ phase: 'absent', reason: self.reason ?? '' });
          return;
        }
        return fetchChart(self.person.id).then((res) => {
          setLoad({ phase: 'done', res });
          track('chart_shown', { status: String(res.chart.status) });
        });
      })
      .catch((e: unknown) =>
        setLoad({ phase: 'error', message: String((e as Error)?.message ?? e) }))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  const res = load.phase === 'done' ? load.res : null;
  const chart = res?.chart;
  const state = useMemo(() => surfaceState(res), [res]);
  const available = useMemo(() => tabs(chart), [chart]);
  const stamp = stampLine(chart);
  const period = currentPeriod(chart);

  // A tab the chart does not have is not offered, so the selection follows
  // the SET rather than a default that might not be in it.
  const active = available.some((t) => t.id === tab)
    ? tab
    : available[0]?.id ?? 'chart';

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => read(true)}
            tintColor={tokens.palette.ink.onCosmicMuted}
          />
        }
      >
        {/* The ceremonial field scrolls WITH the header it belongs to — the
            same rule Home learned on the simulator, where a fixed sky left a
            hard seam the cards slid across. */}
        <View style={s.skyBlock}>
          <View style={s.sky} pointerEvents="none">
            <Svg width="100%" height={HEADER_HEIGHT}>
              <SkyDefs id="chart" />
              <SkyField id="chart" width={Math.max(width, 400)} height={HEADER_HEIGHT} />
              <Stars width={Math.max(width, 400)} height={HEADER_HEIGHT} until={0.6} scale={0.8} />
            </Svg>
          </View>

          <SafeAreaView edges={['top']}>
            <View style={s.navRow}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                style={s.back}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
              >
                <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
              </Pressable>
            </View>
            <View style={s.head}>
              <Text style={s.title}>Your Birth Chart</Text>
              {/* The frame, in full — five values including the node model
                  and the engine version (ASTRAL-237). A chart that cannot say
                  what it assumed is not shippable, including on a screen. */}
              {stamp ? (
                <>
                  <Text style={s.stamp}>{stamp.line}</Text>
                  {stamp.computed ? (
                    <Text style={s.stampDate}>Cast on {stamp.computed}</Text>
                  ) : null}
                </>
              ) : null}
              {period ? (
                <View style={s.periodPill}>
                  <Text style={s.periodText}>
                    {period.antardasha
                      ? `${period.mahadasha} / ${period.antardasha}`
                      : period.mahadasha}
                  </Text>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </View>

        {load.phase === 'loading' ? (
          <View style={s.card}>
            <ActivityIndicator color={tokens.palette.accent.interactive} />
          </View>
        ) : null}

        {load.phase === 'error' ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>We couldn’t reach your chart</Text>
            <Text style={s.cardBody}>{load.message}</Text>
            <Pressable style={s.cta} onPress={() => read(true)} accessibilityRole="button">
              <Text style={s.ctaText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {load.phase === 'absent' ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>No chart yet</Text>
            <Text style={s.cardBody}>
              {load.reason || 'No birth details have been established for you yet.'}
            </Text>
            <Pressable
              style={s.cta}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/birth-details', params: { opening: ESTABLISH_TURN } })}
            >
              <Text style={s.ctaText}>Add your birth details</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Not drawable: absent, unstamped or unprovable. The honest state
            and NO chart — an unstamped chart is not rendered as a chart at
            all (ASTRAL-118), because a tropical value under a sidereal
            heading is three signs and a whole reading wrong. */}
        {res && !state.drawable ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {state.state === 'absent' ? 'No chart yet' : 'This chart can’t be shown'}
            </Text>
            <Text style={s.cardBody}>{state.sentence}</Text>
            {chart?.missing_stamp?.length ? (
              <Text style={s.caption}>
                Missing from its record: {chart.missing_stamp.join(', ')}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {res && state.drawable ? (
          <>
            {/* ASTRAL-238: WHICH cause. "Your birth details changed" on an
                engine version bump is a false sentence, and it shipped. */}
            {state.state === 'stale' ? (
              <View style={s.notice}>
                <SymbolIcon
                  name="exclamationmark.triangle"
                  size={tokens.size.icon}
                  color={tokens.palette.danger}
                />
                <Text style={s.noticeText}>{state.sentence}</Text>
              </View>
            ) : null}

            <BirthBlock chart={chart} />

            {available.length > 1 ? (
              <View style={s.segment}>
                {available.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[s.segmentItem, active === t.id && s.segmentOn]}
                    onPress={() => {
                      setTab(t.id);
                      track('chart_tab', { tab: t.id });
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active === t.id }}
                    accessibilityLabel={t.label}
                  >
                    <Text style={[s.segmentText, active === t.id && s.segmentTextOn]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {active === 'chart' ? <ChartsTab chart={chart} width={width} /> : null}
            {active === 'grahas' ? <GrahasTab chart={chart} /> : null}
            {active === 'dasha' ? <DashaTab chart={chart} /> : null}

            <YogaSection chart={chart} />
            <RegisterSection chart={chart} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** The birth instant AS RECORDED, beside the zone it was pinned to
 *  (ASTRAL-245). Nothing here says a time was rounded, because the record
 *  does not say so. */
function BirthBlock({ chart }: { chart: ChartResponse['chart'] | undefined }) {
  const lines = birthLines(chart);
  if (!lines.length) return null;
  return (
    <View style={s.card}>
      {lines.map((line) => (
        <View key={line.key} style={s.kv}>
          <Text style={s.kvLabel}>{line.label}</Text>
          <Text style={s.kvValue}>{line.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** D1 · Moon · D9, each drawn from ITS OWN model by the one renderer, with
 *  the engine's own title on it (ASTRAL-234/187). A model the artifact does
 *  not carry is absent WITH ITS REASON — never an empty diamond. */
function ChartsTab({
  chart, width,
}: { chart: ChartResponse['chart'] | undefined; width: number }) {
  const drawn = drawnCharts(chart);
  const missing = absentModels(chart);
  return (
    <>
      {drawn.map((model: DrawnChart) => (
        <View key={model.key} style={s.card}>
          <Text style={s.cardTitle}>{model.title}</Text>
          <Text style={s.caption}>Lagna: {model.ascendant}</Text>
          <ChartDiamond
            ui={rnPrimitives}
            theme={astroChartTheme}
            width={width - tokens.space(8)}
            cells={model.cells}
            testID={`chart-diamond-${model.key}`}
          />
          <Text style={s.caption}>
            Each cell shows its rashi number (Aries 1 … Pisces 12). The top
            cell is this chart’s own first house, marked As.
          </Text>
        </View>
      ))}
      {missing.map((m) => (
        <View key={m.key} style={s.absentCard}>
          <Text style={s.cardTitle}>{m.key === 'MOON' ? 'Moon Chart' : m.key}</Text>
          <Text style={s.cardBody}>{m.reason}</Text>
        </View>
      ))}
    </>
  );
}

/** The planet table (ASTRAL-235). Every cell is a payload field; a column
 *  the chart does not have is ABSENT, not blank. */
function GrahasTab({ chart }: { chart: ChartResponse['chart'] | undefined }) {
  const rows = planetRows(chart);
  const cols = columns(chart);
  const note = timelessNote(chart);
  if (!rows.length) return null;
  return (
    <View style={s.card}>
      <View style={s.tableHead}>
        <Text style={[s.th, s.colPlanet]}>Graha</Text>
        <Text style={[s.th, s.colSign]}>Rashi</Text>
        {cols.degree ? <Text style={[s.th, s.colDeg]}>Degree</Text> : null}
        {cols.house ? <Text style={[s.th, s.colHouse]}>Bhava</Text> : null}
      </View>
      {rows.map((row: PlanetRow) => (
        <View key={row.planet} style={s.trBlock}>
          <View style={s.tr}>
            <View style={s.colPlanet}>
              <Text style={s.tdStrong}>
                {row.planet}
                {row.retrograde ? <Text style={s.retro}>  R</Text> : null}
              </Text>
            </View>
            <Text style={[s.td, s.colSign]}>{row.sign}</Text>
            {cols.degree ? (
              <Text style={[s.td, s.colDeg]}>{row.degree ?? ''}</Text>
            ) : null}
            {cols.house ? (
              <Text style={[s.td, s.colHouse]}>{row.house ?? ''}</Text>
            ) : null}
          </View>
          <View style={s.trSub}>
            {row.nakshatra ? (
              <Text style={s.caption}>
                {row.nakshatra}
                {cols.pada && row.pada ? ` · pada ${row.pada}` : ''}
              </Text>
            ) : null}
            {/* The ENGINE's word, including "enemy's sign" — never
                prettified here (ASTRAL-172/235). */}
            {row.dignity ? <Text style={s.dignity}>{row.dignity}</Text> : null}
          </View>
        </View>
      ))}
      {note ? <Text style={s.caption}>{note}</Text> : null}
    </View>
  );
}

/** The Vimshottari table, with the period containing today marked — decided
 *  by the ENGINE from the stored dates, never from `is_current` and never
 *  from this device's clock (ASTRAL-240). */
function DashaTab({ chart }: { chart: ChartResponse['chart'] | undefined }) {
  const rows = dashaRows(chart);
  if (!rows.length) return null;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Vimshottari Dasha</Text>
      {rows.map((row) => (
        <View key={row.id} style={[s.dashaRow, row.current && s.dashaNow]}>
          <Text style={[s.dashaPlanet, row.current && s.dashaPlanetNow]}>{row.planet}</Text>
          <Text style={s.dashaRange}>
            {[row.start, row.end].filter(Boolean).join(' – ')}
          </Text>
          {row.current ? <Text style={s.now}>Now</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** The engine's yoga strings, VERBATIM (ASTRAL-236). No regex, no split, no
 *  planet list: PH-20 made each string state its own tested configuration,
 *  and parsing a basis back out of that sentence would be inventing one. An
 *  empty list renders no section — the engine computed none, which is a
 *  different statement from "no yogas found". */
function YogaSection({ chart }: { chart: ChartResponse['chart'] | undefined }) {
  const yogas = yogaCards(chart);
  if (!yogas.length) return null;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Yogas</Text>
      {yogas.map((y) => (
        <View key={y} style={s.yoga}>
          <Text style={s.yogaText}>{y}</Text>
        </View>
      ))}
    </View>
  );
}

/** What this chart cannot say, in the register's own words (ASTRAL-79). */
function RegisterSection({ chart }: { chart: ChartResponse['chart'] | undefined }) {
  const notes = registerNotes(chart);
  if (!notes.length) return null;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>What this chart cannot say</Text>
      {notes.map((n) => (
        <View key={n.field} style={s.note}>
          <Text style={s.noteTitle}>{n.title}</Text>
          <Text style={s.cardBody}>{n.reason}</Text>
          {n.alternatives.length ? (
            <Text style={s.caption}>It is one of: {n.alternatives.join(' or ')}.</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.cosmic.base },
  scroll: { flex: 1, backgroundColor: t.palette.paper.base },
  body: { paddingBottom: t.space(10), gap: t.space(3) },

  skyBlock: { backgroundColor: t.palette.cosmic.base, marginBottom: t.space(3) },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  head: {
    paddingHorizontal: t.space(5),
    paddingBottom: t.space(5),
    alignItems: 'center',
    gap: t.space(1),
  },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  stamp: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted, textAlign: 'center' },
  stampDate: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  periodPill: {
    marginTop: t.space(2),
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.palette.accent.ceremonial,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(1),
  },
  periodText: { ...t.type.scale.caption, color: t.palette.accent.ceremonial, fontWeight: '700' },

  segment: {
    flexDirection: 'row',
    marginHorizontal: t.space(4),
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    padding: t.space(0.5),
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: t.space(2),
    borderRadius: t.radius.pill,
  },
  segmentOn: { backgroundColor: t.palette.cosmic.base },
  segmentText: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  segmentTextOn: { color: t.palette.ink.onCosmic, fontWeight: '700' },

  card: {
    marginHorizontal: t.space(4),
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    padding: t.space(4),
    gap: t.space(2),
  },
  absentCard: {
    marginHorizontal: t.space(4),
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    padding: t.space(4),
    gap: t.space(1),
  },
  cardTitle: { ...t.type.scale.lead, color: t.palette.ink.primary, fontWeight: '700' },
  cardBody: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  caption: { ...t.type.scale.caption, color: t.palette.ink.muted },

  kv: { flexDirection: 'row', alignItems: 'baseline', gap: t.space(3) },
  kvLabel: { ...t.type.scale.caption, color: t.palette.ink.muted, width: t.space(14) },
  kvValue: { ...t.type.scale.sub, color: t.palette.ink.primary, flex: 1 },

  tableHead: {
    flexDirection: 'row',
    paddingBottom: t.space(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.palette.paper.line,
  },
  th: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trBlock: {
    paddingTop: t.space(2),
    paddingBottom: t.space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.palette.paper.line,
    gap: 2,
  },
  tr: { flexDirection: 'row', alignItems: 'baseline' },
  trSub: { flexDirection: 'row', gap: t.space(3), flexWrap: 'wrap' },
  td: { ...t.type.scale.sub, color: t.palette.ink.primary },
  tdStrong: { ...t.type.scale.sub, color: t.palette.ink.primary, fontWeight: '700' },
  retro: { ...t.type.scale.caption, color: t.palette.danger, fontWeight: '700' },
  dignity: { ...t.type.scale.caption, color: t.palette.accent.interactive },
  colPlanet: { flex: 1.2 },
  colSign: { flex: 1.2 },
  colDeg: { flex: 1, textAlign: 'right' },
  colHouse: { width: t.space(12), textAlign: 'right' },

  dashaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3),
    paddingVertical: t.space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.palette.paper.line,
  },
  dashaNow: { borderBottomColor: t.palette.accent.interactive },
  dashaPlanet: { ...t.type.scale.sub, color: t.palette.ink.primary, width: t.space(20) },
  dashaPlanetNow: { fontWeight: '700', color: t.palette.accent.interactive },
  dashaRange: { ...t.type.scale.caption, color: t.palette.ink.muted, flex: 1 },
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

  yoga: {
    borderLeftWidth: 3,
    borderLeftColor: t.palette.accent.ceremonial,
    paddingLeft: t.space(3),
    paddingVertical: t.space(1),
  },
  yogaText: { ...t.type.scale.sub, color: t.palette.ink.primary },

  note: { gap: 2, paddingBottom: t.space(1) },
  noteTitle: { ...t.type.scale.label, color: t.palette.ink.primary, fontWeight: '600' },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space(3),
    marginHorizontal: t.space(4),
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderLeftWidth: 3,
    borderLeftColor: t.palette.danger,
    padding: t.space(4),
  },
  noticeText: { ...t.type.scale.sub, color: t.palette.ink.primary, flex: 1 },

  cta: {
    alignSelf: 'flex-start',
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.interactiveInk, fontWeight: '700' },
});
