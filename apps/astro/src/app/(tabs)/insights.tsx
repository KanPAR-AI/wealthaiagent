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

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
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
  isPartnerDoor,
  isReady,
  itemRange,
  tabs,
  deckCards,
  focusApplies,
  focusStart,
  focusStep,
  hasAdvice,
} from '@/lib/daily-view';
import { fetchDaily } from '@/lib/people';
import type { DailyResponse, FacetItem } from '@/lib/people-shapes';
import { ChevronLeft, ChevronRight } from '@/components/glyphs';
import { GuidanceDeck } from '@/components/guidance-deck';
import { openPartnerSheet } from '@/components/partner-sheet';
import { SignInGateCard } from '@/components/sign-in-gate';
import { useReadingBlocked } from '@/lib/use-account';
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
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));

  const { blocked, resolved } = useReadingBlocked();
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  // Home's Couple card lands on the Couple tab (`?tab=couple`); a tab that
  // does not exist in the response falls back to the first, as before.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(params.tab || 'guidance');
  useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab]);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(false);

  const read = useCallback((manual = false) => {
    if (blocked) return Promise.resolve();   // the gate card is the screen
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
  // `blocked` in deps — the gate check inside must see the RESOLVED
    // value; frozen at first-render true it starved every fetch
    // (owner-reported: 'home page is not loading', 2026-09-12).
     
  }, [blocked]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (resolved && !blocked) void read(); }, [resolved, blocked]);

  const res = load.phase === 'done' ? load.res : null;
  const facets = res && isReady(res) ? tabs(res) : [];
  const active = facets.find((f) => f.id === tab) ?? facets[0] ?? null;

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
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
          {resolved && blocked ? <SignInGateCard /> : null}
          {!blocked && load.phase === 'loading' ? <ActivityIndicator color={tokens.palette.accent.interactive} /> : null}

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
                // docs/66 G-2: the deck when the engine served one (hook
                // first, swipeable, the paragraph collapsed under it); the
                // paragraph alone otherwise — an older artifact, or a
                // model answer that did not fit the shape. Never a blank.
                deckCards(res).length ? (
                  <GuidanceDeck cards={deckCards(res)} paragraph={res.narration.text} />
                ) : (
                  <View style={s.prose}>
                    <Text style={s.proseText}>{res.narration.text}</Text>
                  </View>
                )
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
                focusApplies(active.items) ? (
                  <ItemFocus key={active.id} items={active.items} onDeclared={() => void read(true)} />
                ) : (
                  active.items.map((item) => <Item key={item.id} item={item} onDeclared={() => void read(true)} />)
                )
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
/** docs/69 polish — one card under a chip row instead of a wall of cards.
 *  Tap a chip, use the arrows or swipe: the words crossfade inside a fixed
 *  frame and the page never jumps. "See all" is the old list, one tap away.
 *  Every word is an engine item rendered by the SAME `Item`; this component
 *  only chooses which one is on screen. */
function ItemFocus({ items, onDeclared }: { items: FacetItem[]; onDeclared: () => void }) {
  const [index, setIndex] = useState(() => focusStart(items));
  const [all, setAll] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const chips = useRef<ScrollView | null>(null);
  const chipX = useRef<Record<number, number>>({});

  const go = useCallback((next: number) => {
    const to = focusStep(next, 0, items.length);
    if (to === index) return;
    track('insights_focus', { to });
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setIndex(to);
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
    chips.current?.scrollTo({ x: Math.max(0, (chipX.current[to] ?? 0) - 60), animated: true });
  }, [fade, index, items.length]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) > 40) go(focusStep(index, g.dx < 0 ? 1 : -1, items.length));
    },
  }), [go, index, items.length]);

  if (all) {
    return (
      <>
        <Pressable style={s.focusAll} onPress={() => setAll(false)} accessibilityRole="button">
          <Text style={s.focusAllText}>One at a time</Text>
        </Pressable>
        {items.map((item) => <Item key={item.id} item={item} onDeclared={onDeclared} />)}
      </>
    );
  }
  const current = items[Math.min(index, items.length - 1)];
  return (
    <View style={s.focus}>
      <ScrollView
        ref={chips}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.focusChips}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            onLayout={(e) => { chipX.current[i] = e.nativeEvent.layout.x; }}
            onPress={() => go(i)}
            style={[s.focusChip, i === index && s.focusChipOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === index }}
            accessibilityLabel={item.title}
          >
            {hasAdvice(item) && i !== index ? <View style={s.focusDot} /> : null}
            <Text style={[s.focusChipText, i === index && s.focusChipTextOn]} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Animated.View style={[s.focusFrame, { opacity: fade }]} {...pan.panHandlers}>
        <Item item={current} onDeclared={onDeclared} />
      </Animated.View>
      <View style={s.focusNav}>
        <Pressable onPress={() => go(focusStep(index, -1, items.length))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous">
          <ChevronLeft size={18} color={t.palette.accent.ceremonial} />
        </Pressable>
        <Text style={s.focusCount}>{index + 1} of {items.length}</Text>
        <Pressable onPress={() => go(focusStep(index, 1, items.length))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next">
          <ChevronRight size={18} color={t.palette.accent.ceremonial} />
        </Pressable>
      </View>
      <Pressable style={s.focusAll} onPress={() => { track('insights_see_all'); setAll(true); }} accessibilityRole="button">
        <Text style={s.focusAllText}>See all {items.length}</Text>
      </Pressable>
    </View>
  );
}

function Item({ item, onDeclared }: { item: FacetItem; onDeclared: () => void }) {
  const honest = item.kind === 'absent_layer' || item.kind === 'undetermined';
  const range = itemRange(item);
  return (
    <View style={[s.item, honest && s.itemHonest]}>
      <Text style={[s.itemTitle, honest && s.itemTitleHonest]}>{item.title}</Text>
      {range ? <Text style={s.itemDetail}>{range}</Text> : null}
      {item.detail ? <Text style={s.itemDetail}>{item.detail}</Text> : null}
      {/* facet v2: the advice line — the fact's real-world meaning, from
          the engine's curated vocabulary. Distinct style so a reader can
          always tell the computed fact from what to do about it. */}
      {(item.meaning ?? '').trim() ? (
        <Text style={s.itemMeaning}>{item.meaning}</Text>
      ) : null}
      {item.alternatives?.length ? (
        <Text style={s.itemBasis}>Either {item.alternatives.join(' or ')}.</Text>
      ) : null}
      {!honest && !isPartnerDoor(item) && basisAddsAnything(item) ? (
        <Text style={s.itemBasis}>{item.basis}</Text>
      ) : null}
      {item.kind === 'plan_ahead' && item.cue ? (
        // docs/64 W-4: the Guidance door to the ranked days — the engine's
        // own cue sentence, sent to chat as is.
        <Pressable
          style={s.doorCta}
          onPress={() => router.push({ pathname: '/chat', params: { pending: item.cue!, handoffKey: String(Date.now()) } })}
          accessibilityRole="button"
          accessibilityLabel="When should I…? — ask for the best days"
        >
          <Text style={s.doorCtaText}>When should I…?</Text>
        </Pressable>
      ) : null}
      {isPartnerDoor(item) ? (
        // facet v3: the Couple tab's add-one-partner door — the same flow
        // every birth fact rides (F24): the engine's partner ask through
        // the structured carrier into reconcile.
        <Pressable
          style={s.doorCta}
          // Owner 2026-09-17: the ONE partner sheet — people on file to
          // declare with a tap, or "Someone new…" into the details flow.
          onPress={() => void openPartnerSheet({ source: 'insights', onDeclared: onDeclared })}
          accessibilityRole="button"
          accessibilityLabel="Add your partner"
        >
          <Text style={s.doorCtaText}>Add your partner</Text>
        </Pressable>
      ) : item.unlocked_by ? (
        <Text style={s.itemBasis}>
          Your {item.unlocked_by.replace(/_/g, ' ')} would settle this.
        </Text>
      ) : null}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  // docs/69 polish: the focused card
  focus: { gap: t.space(3) },
  focusChips: { gap: t.space(2), paddingRight: t.space(4) },
  focusChip: {
    flexDirection: 'row', alignItems: 'center', gap: t.space(1.5),
    borderRadius: t.radius.pill, borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.cosmic.line,
    paddingVertical: t.space(1.5), paddingHorizontal: t.space(3),
    maxWidth: t.space(56),
  },
  focusChipOn: { backgroundColor: t.palette.accent.interactive, borderColor: t.palette.accent.interactive },
  focusChipText: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted, fontWeight: '600' },
  focusChipTextOn: { color: t.palette.accent.interactiveInk },
  focusDot: { width: t.space(1.5), height: t.space(1.5), borderRadius: t.radius.pill, backgroundColor: t.palette.accent.ceremonial },
  focusFrame: { minHeight: t.space(44) },
  focusNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.space(2) },
  focusCount: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  focusAll: { alignSelf: 'center', paddingVertical: t.space(1) },
  focusAllText: { ...t.type.scale.sub, color: t.palette.accent.ceremonial, fontWeight: '600' },

  // Owner 2026-09-17: "background on insights page is too bright and is
  // eye piercing — take inspiration from moonly." The whole screen sits
  // on the cosmic field Home's sky already uses: deep ground, translucent
  // cards, muted ink, gold where a line is advice. Same tokens, no new
  // colour.
  fill: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  safe: { flex: 1 },
  head: { paddingHorizontal: t.space(4), paddingTop: t.space(2), alignItems: 'center', gap: 2 },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  date: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: t.space(4),
    paddingTop: t.space(3),
    gap: t.space(2),
  },
  tab: { flex: 1, paddingVertical: t.space(2), alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: t.palette.accent.ceremonial },
  tabText: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  tabTextOn: { color: t.palette.ink.onCosmic, fontWeight: '700' },

  body: { padding: t.space(4), paddingBottom: t.space(10), gap: t.space(3) },
  prose: {
    backgroundColor: t.palette.cosmic.base,
    borderRadius: t.radius.card,
    padding: t.space(4),
    borderWidth: 1,
    borderColor: t.palette.cosmic.glow,
  },
  proseText: { ...t.type.scale.body, color: t.palette.ink.onCosmic },

  item: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    padding: t.space(3.5),
    gap: t.space(1),
    borderWidth: 1,
    borderColor: t.palette.cosmic.line,
  },
  itemHonest: { backgroundColor: 'transparent' },
  itemTitle: { ...t.type.scale.label, color: t.palette.ink.onCosmic, fontWeight: '700' },
  itemTitleHonest: { color: t.palette.ink.onCosmicMuted },
  itemDetail: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  itemBasis: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  doorCta: {
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3), alignItems: 'center',
    marginTop: t.space(2),
  },
  doorCtaText: { ...t.type.scale.label, color: t.palette.accent.ceremonialInk },
  itemMeaning: {
    ...t.type.scale.sub,
    color: t.palette.accent.ceremonial,
    marginTop: t.space(1),
  },
  footnote: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted, textAlign: 'center' },

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
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.ceremonialInk, fontWeight: '700' },
});
