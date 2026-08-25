// Screen 8 — Daily Guidance (docs/astral-board/08-daily-guidance.png;
// docs/49 ASTRAL-126).
//
// ── the same artifact as Home, faceted ────────────────────────────────────
//
// The four tabs — Guidance · Love · Career · Self — are a FILTER over the
// adjudicator's nine domains on ONE N1 card, not four generations. The whole
// faceted view arrives with the card in a single response, so switching a
// tab performs no request and no generation: `setTab` is the entire
// interaction. That is ASTRAL-113's requirement made structural rather than
// promised — there is no fetch on this screen outside the initial read, and
// the view model it renders through cannot make one.
//
// The domain assignment is the ENGINE's (`daily_facets.py`, over
// `adjudication.CHART_INDICATORS`). No item is filed under a tab by this
// file, and the empty state of a tab is a sentence the engine wrote naming
// that tab's own areas — a blank tab reads as a broken screen, and this way
// a quiet day reads as a quiet day.
//
// ── the panchang, and §11.2 ───────────────────────────────────────────────
//
// The panchang item names the place it is for (F31) — never a default city.
// Nothing this screen writes is fear-shaped: the narration is the engine's
// one grounded paragraph and every other line is a computed fact.

import { router, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
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
import {
  absentView,
  basisAddsAnything,
  cardDate,
  isReady,
  itemRange,
  tabs,
} from '@/lib/daily-view';
import { fetchDaily } from '@/lib/people';
import type { DailyResponse, FacetItem } from '@/lib/people-shapes';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; res: DailyResponse };

export default function Insights() {
  // Per-tab status bar, set ON FOCUS. Every tab screen stays MOUNTED, so a
  // declarative `<StatusBar style=…>` leaves whichever screen mounted last in
  // charge — measured: Home → Timeline → Home left the clock dark on the
  // night sky, where it cannot be read.
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));

  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [tab, setTab] = useState('guidance');
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(false);

  const read = useCallback((manual = false) => {
    if (manual) setRefreshing(true);
    return fetchDaily()
      .then((res) => {
        setLoad({ phase: 'done', res });
        track('guidance_shown', { state: res.state });
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
      // `load.phase` is read, not tracked: re-running this on every state
      // change is what would turn a focus effect into a fetch loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [read]),
  );

  const res = load.phase === 'done' ? load.res : null;
  const facets = res && isReady(res) ? tabs(res) : [];
  const active = facets.find((f) => f.id === tab) ?? facets[0] ?? null;

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}>
          <Text style={s.title}>Today’s Guidance</Text>
          {res && isReady(res) ? <Text style={s.date}>{cardDate(res.card)}</Text> : null}
        </View>

        {facets.length ? (
          <View style={s.tabs}>
            {facets.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  // The whole interaction. No fetch, no generation — the
                  // items for every tab are already in this component's
                  // state (ASTRAL-126).
                  setTab(f.id);
                  track('guidance_tab', { tab: f.id });
                }}
                style={[s.tab, active?.id === f.id && s.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active?.id === f.id }}
                accessibilityLabel={f.label}
              >
                <Text style={[s.tabText, active?.id === f.id && s.tabTextOn]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => read(true)} />
          }
        >
          {load.phase === 'loading' ? <ActivityIndicator color={tokens.palette.accent.interactive} /> : null}

          {load.phase === 'error' ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>We couldn’t reach your reading</Text>
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

          {res && isReady(res) && active ? (
            <>
              {/* The day's ONE narration, on the lens the board puts it on.
                  It is generated once for the day by the engine and cached
                  on the artifact — switching to Love and back costs nothing
                  and shows the same words. */}
              {active.id === 'guidance' && res.narration.available ? (
                <View style={s.prose}>
                  <Text style={s.proseText}>{res.narration.text}</Text>
                </View>
              ) : null}

              {active.items.length === 0 ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Nothing here today</Text>
                  {/* The engine's own sentence, which names the areas this
                      lens covers — so "nothing today" is checkable rather
                      than a shrug. */}
                  <Text style={s.cardBody}>{active.empty_reason}</Text>
                </View>
              ) : (
                active.items.map((item) => <Item key={item.id} item={item} />)
              )}

              {active.domains.length ? (
                <Text style={s.footnote}>
                  This lens covers {active.domains.join(', ')}.
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One faceted item, with the basis it was filed by. An item whose basis a
 *  reader cannot see is a claim; with it, it is a reading. */
function Item({ item }: { item: FacetItem }) {
  const honest = item.kind === 'absent_layer' || item.kind === 'undetermined';
  const range = itemRange(item);
  return (
    <View style={[s.item, honest && s.itemHonest]}>
      <Text style={[s.itemTitle, honest && s.itemTitleHonest]}>{item.title}</Text>
      {range ? <Text style={s.itemDetail}>{range}</Text> : null}
      {item.detail ? <Text style={s.itemDetail}>{item.detail}</Text> : null}
      {item.alternatives?.length ? (
        <Text style={s.itemBasis}>Either {item.alternatives.join(' or ')}.</Text>
      ) : null}
      {!honest && basisAddsAnything(item) ? (
        <Text style={s.itemBasis}>{item.basis}</Text>
      ) : null}
      {item.unlocked_by ? (
        <Text style={s.itemBasis}>
          Your {item.unlocked_by.replace(/_/g, ' ')} would settle this.
        </Text>
      ) : null}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  safe: { flex: 1 },
  head: { paddingHorizontal: t.space(4), paddingTop: t.space(2), alignItems: 'center', gap: 2 },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  date: { ...t.type.scale.caption, color: t.palette.ink.muted },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: t.space(4),
    paddingTop: t.space(3),
    gap: t.space(2),
  },
  tab: { flex: 1, paddingVertical: t.space(2), alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: t.palette.accent.interactive },
  tabText: { ...t.type.scale.sub, color: t.palette.ink.muted },
  tabTextOn: { color: t.palette.ink.primary, fontWeight: '700' },

  body: { padding: t.space(4), paddingBottom: t.space(10), gap: t.space(3) },
  prose: {
    backgroundColor: t.palette.cosmic.base,
    borderRadius: t.radius.card,
    padding: t.space(4),
  },
  proseText: { ...t.type.scale.body, color: t.palette.ink.onCosmic },

  item: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(3.5),
    gap: t.space(1),
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  itemHonest: { backgroundColor: 'transparent' },
  itemTitle: { ...t.type.scale.label, color: t.palette.ink.primary, fontWeight: '700' },
  itemTitleHonest: { color: t.palette.ink.secondary },
  itemDetail: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  itemBasis: { ...t.type.scale.caption, color: t.palette.ink.muted },
  footnote: { ...t.type.scale.caption, color: t.palette.ink.muted, textAlign: 'center' },

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
