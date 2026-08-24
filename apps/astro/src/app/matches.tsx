// My Matches — the saved pairs, ranked honestly (docs/49 ASTRAL-140..146).
//
// The board draws this as `My Shortlist (4)` with 91% / 87% / 84% / 79%
// (frame 18). docs/48 §9c-6 already ruled on those numbers: they are false
// precision, and here they are worse because they become a RANKING. So the
// percentages are gone, the ring is gone, and what is left is what the engine
// actually computed.
//
// ── the three groups, and why they are three ──────────────────────────────
//
// A time-less match keeps 15 firm points and leaves 21 genuinely unknown, and
// `matching.py` refuses to rescale that into a /36. An ORDERING IS A
// COMPARISON, so a single list would perform the rescale the engine refuses.
// The server sends three labelled groups, already ordered; this screen draws
// them in that order and never merges them. An ordinal exists only INSIDE a
// section and is labelled with it (F47).
//
// ── what this screen may not do ───────────────────────────────────────────
//
//  · compute anything (ASTRAL-135) — every number here was computed in a
//    chat turn and stored against the pair.
//  · recompute a band. The verdict is the engine's own string, printed
//    verbatim, which on a partly-scored row is the word `incomplete`.
//  · write a fact. The star is a LABEL (`PATCH /people/{id}`); adding a
//    partner rides the chat ask, and there is no `POST /people` (F24).
//
// Every rule above is enforced in `lib/matches-view.ts`, which is pure and
// tested at the workspace root, including a property test over 48 generated
// match sets. What is left here is layout.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import { lastChatId } from '@/lib/chat-session';
import {
  EMPTY_BODY,
  EMPTY_TITLE,
  askAboutTurn,
  isEmpty,
  sections,
  type MatchRowView,
} from '@/lib/matches-view';
import { fetchMatches, patchLabels, type MatchesResponse } from '@/lib/people';
import { tokens } from '@/theme';

export default function Matches() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [starBusy, setStarBusy] = useState<string | null>(null);

  const read = useCallback(() => {
    setBusy(true);
    setError(null);
    fetchMatches()
      .then((res) => {
        setData(res);
        track('matches_shown', { total: res.total });
      })
      // "No matches saved" and "the read failed" are different sentences and
      // the screen says the right one because this does not swallow.
      .catch((e: any) => setError(String(e?.message ?? e)))
      .finally(() => setBusy(false));
  }, []);

  useEffect(read, [read]);

  /** The star is owner-authored metadata, not a fact: `PATCH /people/{id}`
   *  takes `favourite` and returns an empty `invalidated` list, because the
   *  list joins artifact → person at render and nothing is recomputed. */
  const toggleStar = useCallback((row: MatchRowView) => {
    if (!row.personId) return;
    setStarBusy(row.pairKey);
    patchLabels(row.personId, { favourite: !row.favourite })
      .then(() => {
        track('match_favourite', { on: row.favourite ? 0 : 1 });
        read();
      })
      .catch((e: any) => setError(String(e?.message ?? e)))
      .finally(() => setStarBusy(null));
  }, [read]);

  /**
   * ASTRAL-146 — "Ask AI about this match".
   *
   * The handoff carries the person's NAME and nothing else: a handoff that
   * restates birth facts is a second write path wearing a prompt's clothes,
   * and the restated copy is the one that goes stale.
   *
   * It continues the conversation this device is already in rather than
   * opening a fresh one, because a fresh chat knows nothing about the pair —
   * the engine has no read-back path from the People store into a turn's
   * belief yet, so a new session would answer by asking for birth details
   * again. Reported as a gap rather than papered over with a re-ask.
   */
  const askAbout = useCallback(async (row: MatchRowView) => {
    track('match_ask_ai');
    const chatId = (await lastChatId()) ?? '';
    router.push({
      pathname: '/chat',
      params: { chatId, pending: askAboutTurn(row.name) },
    });
  }, []);

  const view = sections(data);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
            style={s.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
          >
            <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={read} />}
        >
          <Text style={s.title}>My Matches</Text>

          {busy && !data ? (
            <ActivityIndicator color={tokens.palette.accent.interactive} />
          ) : error ? (
            <View style={s.gap}>
              <Text style={s.sentence}>I could not read your matches just now. {error}</Text>
              <Pressable style={s.cta} onPress={read} accessibilityRole="button" accessibilityLabel="Try again">
                <Text style={s.ctaText}>Try again</Text>
              </Pressable>
            </View>
          ) : isEmpty(data) ? (
            <View style={s.gap}>
              <Text style={s.sectionTitle}>{EMPTY_TITLE}</Text>
              <Text style={s.sentence}>{EMPTY_BODY}</Text>
              <Pressable
                style={s.cta}
                onPress={() => router.push('/chat')}
                accessibilityRole="button"
                accessibilityLabel="Open chat"
              >
                <Text style={s.ctaText}>Open chat</Text>
              </Pressable>
            </View>
          ) : (
            view.map((section) => (
              <View key={section.key} style={s.gap}>
                {/* The section's own label, written by the engine, carrying
                    the scale its rows are on. Never rewritten here. */}
                <Text style={s.section}>{section.label}</Text>
                {section.rows.map((row) => (
                  <Row
                    key={row.pairKey}
                    row={row}
                    starBusy={starBusy === row.pairKey}
                    onStar={() => toggleStar(row)}
                    onAsk={() => void askAbout(row)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({
  row, starBusy, onStar, onAsk,
}: {
  row: MatchRowView;
  starBusy: boolean;
  onStar: () => void;
  onAsk: () => void;
}) {
  return (
    <View style={[s.card, row.favourite ? s.cardStarred : null]}>
      <View style={s.cardBody}>
        <View style={s.rowHead}>
          <View style={s.disc}>
            <Text style={s.discInitial}>{(row.name.trim()[0] ?? '★').toUpperCase()}</Text>
          </View>
          <View style={s.rowName}>
            <Text style={s.name}>{row.name}</Text>
            {row.ordinal ? <Text style={s.caption}>{row.ordinal}</Text> : null}
          </View>
          {/* The score in ITS OWN scale, or nothing at all. A refused match
              gets no pill — never a zero, never an empty ring. */}
          {row.score ? (
            <View style={s.pill}>
              <Text style={s.pillText}>{row.score.text}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={onStar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={row.favourite ? `Unstar ${row.name}` : `Star ${row.name}`}
          >
            {starBusy ? (
              <ActivityIndicator color={tokens.palette.ink.muted} />
            ) : (
              <SymbolIcon
                name={row.favourite ? 'star.fill' : 'star'}
                color={row.favourite ? tokens.palette.accent.ceremonial : tokens.palette.ink.muted}
              />
            )}
          </Pressable>
        </View>

        {row.score?.scale ? <Text style={s.caption}>{row.score.scale}</Text> : null}

        <View style={s.chips}>
          {/* ASTRAL-143: the engine's own verdict word, verbatim. */}
          {row.verdict ? (
            <View style={s.chip}>
              <Text style={s.chipText}>{row.verdict}</Text>
            </View>
          ) : null}
          {/* …and the active dosha flags ON the row: a 28/36 with one is a
              materially different verdict from a 28/36 without, and a list is
              exactly where that difference gets laundered into a position. */}
          {row.doshas.map((dosha) => (
            <View key={dosha.name} style={[s.chip, s.chipWarn]}>
              <Text style={s.chipWarnText}>
                {dosha.name}{dosha.provisional ? ' (provisional)' : ''}
              </Text>
            </View>
          ))}
        </View>

        {row.refusal ? <Text style={s.sentence}>{row.refusal}</Text> : null}
        {row.score?.pending.map((reason) => (
          <Text key={reason} style={s.caption}>{reason}</Text>
        ))}
        {row.freshness ? <Text style={s.caption}>{row.freshness}</Text> : null}
        {row.ask ? <Text style={s.caption}>{row.ask} — ask in chat.</Text> : null}

        <Pressable
          style={s.ghost}
          onPress={onAsk}
          accessibilityRole="button"
          accessibilityLabel={`Ask AI about your match with ${row.name}`}
        >
          <Text style={s.ghostText}>Ask AI about this match</Text>
        </Pressable>
      </View>
    </View>
  );
}

const t = tokens;

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: { paddingHorizontal: t.space(5), paddingTop: t.space(2), paddingBottom: t.space(10), gap: t.space(3) },
  gap: { gap: t.space(2.5) },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.primary },
  sectionTitle: { ...t.type.scale.title, color: t.palette.ink.primary },
  section: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1,
    marginTop: t.space(3),
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
  },
  /** the board tints the starred row rather than moving it */
  cardStarred: { borderColor: t.palette.accent.ceremonial },
  cardBody: { padding: t.space(4), gap: t.space(2) },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: t.space(3) },
  disc: {
    width: t.size.disc,
    height: t.size.disc,
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discInitial: { ...t.type.scale.lead, color: t.palette.accent.interactiveInk },
  rowName: { flex: 1, gap: t.space(0.5) },
  name: { ...t.type.scale.lead, color: t.palette.ink.primary },
  pill: {
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    paddingHorizontal: t.space(3),
    paddingVertical: t.space(1),
  },
  pillText: { ...t.type.scale.label, color: t.palette.ink.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) },
  chip: {
    borderRadius: t.radius.chip,
    backgroundColor: t.palette.paper.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    paddingHorizontal: t.space(2.5),
    paddingVertical: t.space(1),
  },
  chipText: { ...t.type.scale.caption, color: t.palette.ink.secondary },
  chipWarn: { borderColor: t.palette.danger },
  chipWarnText: { ...t.type.scale.caption, color: t.palette.danger },
  sentence: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  caption: { ...t.type.scale.caption, color: t.palette.ink.muted },
  cta: {
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5),
    alignItems: 'center',
  },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '600' },
  ghost: {
    borderRadius: t.radius.button,
    paddingVertical: t.space(3),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.palette.accent.interactive,
    marginTop: t.space(1),
  },
  ghostText: { ...t.type.scale.label, color: t.palette.accent.interactive },
});
