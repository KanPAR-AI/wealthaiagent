// Screen 3 — Home, in the Vedic frame (docs/astral-board/03-home-dashboard.png;
// docs/49 ASTRAL-125).
//
// ── the one rule this screen exists to keep ───────────────────────────────
//
// IT RENDERS ONE DATED ARTIFACT AND NOTHING ELSE. Every value on it is a
// field of the N1 card `GET /people/self/daily` returned, and the date on
// screen is the ARTIFACT's own — never the device's. There is no client-side
// composition of "today" here (the view model has no clock in it at all, and
// a test greps for one), and no model call: the narration arrives with the
// card, generated once for the day by the engine.
//
// A missing or stale chart is a DESIGNED state with its own sentence and its
// own next step, never yesterday's card rendered as today's. That is the
// silent-success class in the most visible place in the app, which is why
// `absentView` gives each state a different title rather than one apology.
//
// ── what the board draws that this does not ───────────────────────────────
//
// The bell. FR-019 has no transport to a phone — no push client either side
// — so `capabilities.notifications` is false and the affordance is ABSENT
// rather than drawn-and-inert (ASTRAL-119's negative space).
//
// The tiles come from the same capability map as the tab bar, and each one
// lands on a screen this build has: Birth Chart on /chart (screen 5, PH-27),
// Compatibility on Matches, AI Reading on chat, This Month on Timeline,
// Muhurta on /muhurta; the Palm tile is removed while `palm` is false.

import { router, useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronRight, SymbolIcon } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { track } from '@/lib/analytics';
import { CAPABILITIES } from '@/lib/capabilities';
import { openPartnerSheet } from '@/components/partner-sheet';
import { subscribeToAccount, type Account } from '@/lib/auth';
import {
  absences,
  absentView,
  cardDate,
  coupleCard,
  dashaLines,
  dayView,
  greeting,
  greetingName,
  isReady,
  panchangLine,
  ruleLines,
  transitLines,
} from '@/lib/daily-view';
import { adoptAccountNameIfUnnamed, fetchDaily, fetchSelf } from '@/lib/people';
import type { CoupleCard, DayView } from '@/lib/daily-view';
import type { DailyResponse } from '@/lib/people-shapes';
import { visibleTiles } from '@/lib/tabs';
import { SignInGateCard } from '@/components/sign-in-gate';
import { useReadingBlocked } from '@/lib/use-account';
import { tokens } from '@/theme';

const HEADER_HEIGHT = 260;
/** how many transit lines the card shows before the Insights tab takes over */
const CARD_LINES = 3;

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; res: DailyResponse };

export default function Home() {
  // Per-tab status bar, set ON FOCUS. Every tab screen stays MOUNTED, so a
  // declarative `<StatusBar style=…>` leaves whichever screen mounted last in
  // charge — measured: Home → Timeline → Home left the clock dark on the
  // night sky, where it cannot be read.
  useFocusEffect(useCallback(() => setStatusBarStyle('light'), []));

  const { width } = useWindowDimensions();
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  // docs/62 A-1: "Why is today red?" — the engine's cited reasons, shown on
  // demand. A toggle, not a fetch: the reasons are on the card already.
  const [whyOpen, setWhyOpen] = useState(false);
  const asked = useRef(false);

  // The greeting's second source. MEASURED on-sim: a `self` established
  // through the chat bridge carries an empty `display_name`, because the
  // birth-details arc asks for a date, a time and a place and never for a
  // name — so ASTRAL-125's "Hi, {name}" would read "Hi there" for every real
  // user. `greetingName` decides which of the two names wins; nothing here
  // writes the account name into the People store.
  const accountRef = useRef<Account | null>(null);
  useEffect(() => subscribeToAccount((a) => {
    accountRef.current = a;
    setAccount(a);
  }), []);

  const { blocked, resolved } = useReadingBlocked();
  const read = useCallback((manual = false) => {
    if (blocked) return Promise.resolve();   // the gate card is the screen
    if (manual) setRefreshing(true);
    return fetchDaily()
      .then((res) => {
        setLoad({ phase: 'done', res });
        track('home_shown', { state: res.state });
        // F59 (ruled): a nameless profile adopts the signed-in account's
        // name as its LABEL — store name wins forever after, never an
        // email, and only once self exists. Fire-and-forget: the greeting
        // corrects itself on the next read; a failure costs nothing.
        const _named = res.state === 'ready'
          ? res.person?.display_name : null;
        if (!_named) {
          void fetchSelf()
            .then((self) => adoptAccountNameIfUnnamed(
              self, accountRef.current?.displayName))
            .then((adopted) => { if (adopted) void read(); })
            .catch(() => {});
        }
      })
      // Named, never swallowed into an empty screen: "we could not reach the
      // server" and "you have no chart" are different sentences, and only one
      // of them is the user's to act on.
      .catch((e: unknown) =>
        setLoad({ phase: 'error', message: String((e as Error)?.message ?? e) }),
      )
      .finally(() => setRefreshing(false));
  // `blocked` in deps — the gate check inside must see the RESOLVED
    // value; frozen at first-render true it starved every fetch
    // (owner-reported: 'home page is not loading', 2026-09-12).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  // Re-read on focus, not only on mount: a user who adds their birth details
  // in chat and taps Home must not find the "your details first" state still
  // on screen. `asked` keeps the very first focus from double-fetching.
  useFocusEffect(
    useCallback(() => {
      if (!asked.current) {
        asked.current = true;
        void read();
        return;
      }
      void read();
    }, [read]),
  );
  // The moment auth resolves signed-in, the card loads without a re-focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (resolved && !blocked) void read(); }, [resolved, blocked]);

  const res = load.phase === 'done' ? load.res : null;
  const name = greetingName(
    res && 'person' in res ? res.person?.display_name : null,
    account?.displayName,
  );
  const tiles = visibleTiles();

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          // The paper ground belongs to the SCROLL VIEW, not to the content:
          // with it on the content the area below a SHORT page (an honest
          // absent state, which is exactly when the screen has least to show)
          // fell through to the cosmic fill and read as a rendering fault.
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
          {/* The ceremonial field SCROLLS WITH the block it belongs to.
              Fixed behind the scroll view it made a hard horizontal seam the
              cards slid across — measured on the first sim run — because the
              boundary between night sky and paper moved with the content
              while the sky did not. */}
          <View style={s.skyBlock}>
            <View style={s.sky} pointerEvents="none">
              <Svg width="100%" height={HEADER_HEIGHT}>
                <SkyDefs id="home" />
                <SkyField id="home" width={Math.max(width, 400)} height={HEADER_HEIGHT} />
                <Stars width={Math.max(width, 400)} height={HEADER_HEIGHT} until={0.5} scale={0.8} />
              </Svg>
            </View>

            <View style={s.greetBlock}>
              <Text style={s.greet}>{greeting(name)}</Text>
              <Text style={s.greetSub}>Here’s your day, from your own chart.</Text>
            </View>

            {resolved && blocked ? <SignInGateCard dark /> : null}

            {!blocked && load.phase === 'loading' ? (
              <View style={s.card}>
                <ActivityIndicator color={tokens.palette.accent.interactive} />
              </View>
            ) : null}

            {load.phase === 'error' ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>We couldn’t reach your reading</Text>
                <Text style={s.cardBody}>{load.message}</Text>
                <Pressable style={s.cta} onPress={() => read(true)}>
                  <Text style={s.ctaText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {res && !isReady(res) ? <AbsentCard res={res} /> : null}

            {res && isReady(res) ? (
              /* The board's "Today's Transit" block: the artifact's own date,
                 the day's leading positions, and the day's ONE narration when
                 the engine has written it. */
              <Pressable
                style={s.transitCard}
                onPress={() => router.push('/insights')}
                accessibilityRole="button"
                accessibilityLabel="Open today’s guidance"
              >
                <Text style={s.transitTitle}>Today’s transits</Text>
                <Text style={s.transitDate}>{cardDate(res.card)}</Text>

                {/* docs/62 A-1: the day's colour, from the user's own Moon —
                    the WORD travels with the colour (never colour alone).
                    Everything here is the card's `day` layer verbatim. */}
                {CAPABILITIES.dayStrip && dayView(res.card) ? (
                  <View style={s.bandRow}>
                    <View style={[s.bandPill, { backgroundColor: t.palette.day[dayView(res.card)!.band] }]}>
                      <Text style={[s.bandPillText, { color: t.palette.day[`${dayView(res.card)!.band}Ink`] }]}>
                        {dayView(res.card)!.label}
                      </Text>
                    </View>
                    <Text style={s.bandLine} numberOfLines={3}>{dayView(res.card)!.line}</Text>
                  </View>
                ) : null}

                {transitLines(res.card)
                  .slice(0, CARD_LINES)
                  .map((line) => (
                    <Text key={line.id} style={s.transitLine}>
                      <Text style={s.transitLead}>{line.label}</Text> {line.value}
                    </Text>
                  ))}

                {/* The day's narration, CLIPPED here. The board's frame 3
                    shows a short paragraph under "Tap to read more"; the
                    engine writes up to 120 words and the whole card became a
                    wall of text on the first sim run. The full text is on the
                    Insights tab — one tap, same words, no second
                    generation. */}
                {res.narration.available ? (
                  <Text style={s.transitProse} numberOfLines={4}>
                    {res.narration.text}
                  </Text>
                ) : null}

                <View style={s.more}>
                  <Text style={s.moreText}>Read today’s guidance</Text>
                  <ChevronRight size={16} color={tokens.palette.accent.ceremonial} />
                </View>
              </Pressable>
            ) : null}

            {res && isReady(res) && CAPABILITIES.dayStrip && dayView(res.card) ? (
              <WeekCard view={dayView(res.card)!} open={whyOpen} onToggle={() => {
                track('home_day_why', { open: !whyOpen, band: dayView(res.card)!.band });
                setWhyOpen((v) => !v);
              }} />
            ) : null}
          </View>

          {res && isReady(res) ? (
            <View style={s.paper}>
              {/* Owner 2026-09-17: "Add a partner … seems buried." The Couple
                  lens gets its own card on Home — the door when there is no
                  partner, both people's day when there is. Every word is the
                  Couple tab's own items; the door opens the ONE partner sheet. */}
              {coupleCard(res) ? (
                <CoupleHomeCard card={coupleCard(res)!} onDeclared={() => read(true)} />
              ) : null}

              <View style={s.tiles}>
                {tiles.map((tile) => (
                  <Pressable
                    key={tile.id}
                    style={s.tile}
                    onPress={() => {
                      track('home_tile', { tile: tile.id });
                      router.push(tile.route as never);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={tile.title}
                  >
                    <SymbolIcon name={tile.icon} color={tokens.palette.accent.interactive} />
                    <Text style={s.tileTitle}>{tile.title}</Text>
                    <Text style={s.tileSub}>{tile.subtitle}</Text>
                  </Pressable>
                ))}
              </View>

              {/* The Jyotish half the board's Western frame had no slot for:
                  the running mahadasha AND antardasha (ASTRAL-125 / F33). A
                  mahadasha alone lasts up to twenty years and is not news. */}
              {dashaLines(res.card).length ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Your periods now</Text>
                  {dashaLines(res.card).map((line) => (
                    <View key={line.id} style={s.row}>
                      <Text style={s.rowLabel}>{line.label}</Text>
                      <Text style={s.rowValue}>{line.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* ASTRAL-126 / F31: the panchang NAMES the place it is for. */}
              {panchangLine(res.card) ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Today’s panchang</Text>
                  <Text style={s.cardBody}>{panchangLine(res.card)!.value}</Text>
                  <Text style={s.caption}>for {panchangLine(res.card)!.place}</Text>
                </View>
              ) : null}

              {ruleLines(res.card).length ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Running now</Text>
                  {ruleLines(res.card).map((line) => (
                    <Text key={line.id} style={s.bullet}>
                      • {line.value}
                    </Text>
                  ))}
                </View>
              ) : null}

              {/* *Nothing was computed* must not read as *nothing happened*. */}
              {absences(res.card).map((entry) => (
                <View key={entry.layer} style={s.absence}>
                  <Text style={s.absenceTitle}>
                    {entry.layer[0].toUpperCase() + entry.layer.slice(1)} — not shown
                  </Text>
                  <Text style={s.absenceBody}>{entry.reason}.</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function CoupleHomeCard({ card, onDeclared }: { card: CoupleCard; onDeclared: () => void }) {
  const door = card.mode === 'door';
  return (
    <View style={s.coupleCard}>
      <View style={s.coupleHead}>
        <SymbolIcon name="heart" color={t.palette.accent.interactive} />
        <Text style={s.cardTitle}>{card.title}</Text>
      </View>
      {card.body ? <Text style={s.cardBody}>{card.body}</Text> : null}
      {card.lines.map((line) => (
        <Text key={line} style={s.bullet}>• {line}</Text>
      ))}
      <Pressable
        style={door ? s.cta : s.coupleOpen}
        onPress={() => {
          track(door ? 'home_couple_door' : 'home_couple_open');
          if (door) void openPartnerSheet({ source: 'home', onDeclared });
          else router.push({ pathname: '/insights', params: { tab: 'couple' } });
        }}
        accessibilityRole="button"
        accessibilityLabel={card.cta}
      >
        <Text style={door ? s.ctaText : s.coupleOpenText}>{card.cta}</Text>
        {door ? null : <ChevronRight size={16} color={t.palette.accent.interactive} />}
      </Pressable>
    </View>
  );
}

/** docs/62 A-1/A-2 — the week as seven dots, and the day opened up: the
 *  engine's cited reasons, Rahu Kaal from the real sunrise, the golden and
 *  silence windows. Nothing here is computed: every word and every colour is
 *  the card's `day` layer; a day the engine could not score is a hollow dot
 *  with its reason, never a guess. */
function WeekCard({ view, open, onToggle }: { view: DayView; open: boolean; onToggle: () => void }) {
  return (
    <View style={s.weekCard} accessibilityLabel={`Your week: ${view.strip.map((d) => `${d.weekday} ${d.band ?? 'not scored'}`).join(', ')}`}>
      <Text style={s.weekTitle}>Your week</Text>
      <View style={s.weekRow}>
        {view.strip.map((d) => (
          <View key={d.date} style={s.weekDay} accessibilityLabel={`${d.weekday}: ${d.band ?? 'not scored'}`}>
            <Text style={[s.weekLabel, d.isToday && s.weekLabelToday]}>{d.weekday}</Text>
            <View
              style={[
                s.weekDot,
                d.band ? { backgroundColor: t.palette.day[d.band] } : s.weekDotAbsent,
                d.isToday && s.weekDotToday,
              ]}
            />
          </View>
        ))}
      </View>
      {view.strip.some((d) => d.absent) ? (
        <Text style={s.weekNote}>
          {view.strip.filter((d) => d.absent).map((d) => `${d.weekday}: ${d.absent}`).join(' · ')}
        </Text>
      ) : null}
      {view.place ? <Text style={s.weekNote}>scored for {view.place}, from your Moon</Text> : null}
      {view.notYours ? <Text style={s.weekNote}>{view.notYours}.</Text> : null}

      <Pressable
        style={s.whyRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide why today is this colour' : 'Why is today this colour?'}
      >
        <Text style={s.whyText}>{open ? 'Hide the why' : `Why a ${view.label.toLowerCase()}?`}</Text>
        <ChevronRight size={14} color={t.palette.accent.ceremonial} />
      </Pressable>
      {open ? (
        <View style={s.whyBody}>
          {view.reasons.map((r) => (
            <Text key={r} style={s.whyLine}>• {r}</Text>
          ))}
          {view.rahuKaal ? (
            <Text style={s.whyLine}>• Rahu Kaal {view.rahuKaal} — keep beginnings out of it</Text>
          ) : view.rahuKaalAbsent ? (
            <Text style={s.whyLine}>• Rahu Kaal not stated: {view.rahuKaalAbsent}</Text>
          ) : null}
          {view.golden.length ? (
            <Text style={s.whyLine}>• Golden {view.golden.join(' · ')} — the big ask goes here</Text>
          ) : view.momentsAbsent ? null : (
            <Text style={s.whyLine}>• No golden window today — that is the day, not a gap</Text>
          )}
          {view.silence.length ? (
            <Text style={s.whyLine}>• Silence {view.silence.join(' · ')} — lie low</Text>
          ) : null}
          {view.momentsAbsent ? (
            <Text style={s.whyLine}>• Moments not stated: {view.momentsAbsent}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The designed absence: one sentence per state, and the one control that is
 *  honest for it — a chat TURN, because the chart is recast by the turn that
 *  needs it and there is no endpoint a screen may call (F24 / INV-1). */
function AbsentCard({ res }: { res: Exclude<DailyResponse, { state: 'ready' }> }) {
  const view = absentView(res);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{view.title}</Text>
      <Text style={s.cardBody}>{view.body}</Text>
      {view.action && view.turn ? (
        <Pressable
          style={s.cta}
          onPress={() => {
            track('home_absent_action', { state: res.state });
            // Where the ask goes depends on what is missing, not on which
            // screen raised it. A stale chart needs no details — only the
            // chart redone — so it goes straight to chat.
            router.push(
              view.destination === 'details'
                ? { pathname: '/birth-details', params: { opening: view.turn! } }
                : { pathname: '/chat', params: { pending: view.turn! } },
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={view.action}
        >
          <Text style={s.ctaText}>{view.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  safe: { flex: 1 },
  scroll: { flex: 1, backgroundColor: t.palette.paper.base },
  body: { paddingBottom: t.space(10) },
  paper: { padding: t.space(4), gap: t.space(3) },
  // The ceremonial block: night sky behind the greeting and the day's card,
  // clipped so the field ends where the paper surfaces begin.
  skyBlock: {
    overflow: 'hidden',
    paddingHorizontal: t.space(4),
    paddingBottom: t.space(4),
    gap: t.space(3),
    backgroundColor: t.palette.cosmic.deep,
  },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  greetBlock: { marginBottom: t.space(1), gap: t.space(1) },
  greet: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.onCosmic },
  greetSub: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },

  transitCard: {
    backgroundColor: t.palette.cosmic.base,
    borderRadius: t.radius.card,
    padding: t.space(4),
    gap: t.space(1.5),
    borderWidth: 1,
    borderColor: t.palette.cosmic.glow,
  },
  transitTitle: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  transitDate: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  transitLine: { ...t.type.scale.sub, color: t.palette.ink.onCosmic },
  transitLead: { fontWeight: '700' },
  transitProse: { ...t.type.scale.body, color: t.palette.ink.onCosmicMuted, marginTop: t.space(2) },
  bandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space(2), marginTop: t.space(1) },
  bandPill: { borderRadius: t.radius.pill, paddingVertical: t.space(1), paddingHorizontal: t.space(2.5) },
  bandPillText: { ...t.type.scale.caption, fontWeight: '700' },
  bandLine: { ...t.type.scale.caption, color: t.palette.ink.onCosmic, flex: 1 },

  weekCard: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    padding: t.space(4),
    gap: t.space(2),
    borderWidth: 1,
    borderColor: t.palette.cosmic.line,
  },
  weekTitle: { ...t.type.scale.label, color: t.palette.ink.onCosmicMuted, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: t.space(1), minWidth: 34 },
  weekLabel: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  weekLabelToday: { color: t.palette.ink.onCosmic, fontWeight: '700' },
  weekDot: { width: 18, height: 18, borderRadius: t.radius.pill },
  weekDotAbsent: { borderWidth: 1, borderColor: t.palette.ink.onCosmicMuted, backgroundColor: 'transparent' },
  weekDotToday: { borderWidth: 2, borderColor: t.palette.accent.ceremonial },
  weekNote: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: t.space(1) },
  whyText: { ...t.type.scale.sub, color: t.palette.accent.ceremonial, fontWeight: '600' },
  whyBody: { gap: t.space(1) },
  whyLine: { ...t.type.scale.caption, color: t.palette.ink.onCosmic },
  more: { flexDirection: 'row', alignItems: 'center', gap: t.space(1), marginTop: t.space(2) },
  moreText: { ...t.type.scale.sub, color: t.palette.accent.ceremonial, fontWeight: '600' },

  coupleCard: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(4),
    gap: t.space(2),
    borderWidth: 1,
    borderColor: t.palette.accent.interactive,
  },
  coupleHead: { flexDirection: 'row', alignItems: 'center', gap: t.space(2) },
  coupleOpen: { flexDirection: 'row', alignItems: 'center', gap: t.space(1), alignSelf: 'flex-start' },
  coupleOpenText: { ...t.type.scale.sub, color: t.palette.accent.interactive, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space(3) },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(3.5),
    gap: t.space(1),
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  tileTitle: { ...t.type.scale.label, color: t.palette.ink.primary, fontWeight: '700' },
  tileSub: { ...t.type.scale.caption, color: t.palette.ink.muted },

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
  caption: { ...t.type.scale.caption, color: t.palette.ink.muted },
  bullet: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: t.space(3) },
  rowLabel: { ...t.type.scale.sub, color: t.palette.ink.muted },
  rowValue: { ...t.type.scale.sub, color: t.palette.ink.primary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  absence: {
    borderRadius: t.radius.card,
    padding: t.space(3.5),
    gap: t.space(1),
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    backgroundColor: 'transparent',
  },
  absenceTitle: { ...t.type.scale.label, color: t.palette.ink.secondary, fontWeight: '700' },
  absenceBody: { ...t.type.scale.caption, color: t.palette.ink.muted },

  cta: {
    alignSelf: 'flex-start',
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.interactiveInk, fontWeight: '700' },
});
