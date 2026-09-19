// The match scorecard, NATIVE (docs/astral-board/06-compatibility-overview.png;
// docs/49 ASTRAL-232/241, from F86).
//
// ── the one-read change ──────────────────────────────────────────────────
//
// The whole scorecard — every koota with its points, the pending ones with
// their reasons, the doshas, the firm/pending split — has been STORED since
// PH-6, and `GET /people/matches` served a list row. So "why is Nadi zero"
// could only be answered by asking a model about an artifact the engine had
// already computed, which is the owner's complaint in its purest form. This
// screen is `GET /people/matches/{pair_key}` (ASTRAL-232) drawn.
//
// ── one scorecard in the workspace ───────────────────────────────────────
//
// `MatchScorecard` is the shared component — the same file the 380px
// extension panel and the web app render (ASTRAL-18). This screen supplies
// primitives, a theme and a width, and renders the payload the read returned
// UNCHANGED. It computes no band, no total and no percentage; there is
// nothing here that could.
//
// ── exactly one way out ──────────────────────────────────────────────────
//
// One affordance opens a conversation, and it carries a NAME (ASTRAL-146).
// It opens a FRESH chat — the owner ruled it directly on 2026-09-11 ("when
// ask about my match always start a new chat"), which is AMB-53's one-
// session-per-match made real: chatservice `dea07ce`'s stored-match
// rehydration is the hydration that ruling was gated on.

import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchScorecard } from '@wealthai/astral';
import { rnPrimitives } from '@wealthai/astral-native';

import { ChevronLeft } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import { astroChartThemeNight } from '@/lib/chart-theme';
import {
  ASK_AI_LABEL,
  askTurn,
  detailState,
  header,
  refusal,
  report,
} from '@/lib/match-detail-view';
import { deletePerson, fetchMatch } from '@/lib/people';
import { REMOVE_MATCH_LABEL, removeMatchConfirmation } from '@/lib/matches-view';
import type { MatchDetail } from '@/lib/people-shapes';
import { tokens } from '@/theme';

type Load =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; detail: MatchDetail };

export default function Match() {
  const { pairKey } = useLocalSearchParams<{ pairKey?: string }>();
  const { width } = useWindowDimensions();
  const [load, setLoad] = useState<Load>({ phase: 'loading' });

  const read = useCallback(() => {
    if (!pairKey) {
      setLoad({ phase: 'error', message: 'No match was named.' });
      return;
    }
    setLoad({ phase: 'loading' });
    fetchMatch(String(pairKey))
      .then((detail) => {
        setLoad({ phase: 'done', detail });
        track('match_detail_shown', { freshness: String(detail.freshness) });
      })
      .catch((e: unknown) =>
        setLoad({ phase: 'error', message: String((e as Error)?.message ?? e) }));
  }, [pairKey]);

  useEffect(read, [read]);

  const detail = load.phase === 'done' ? load.detail : null;
  const head = detail ? header(detail) : null;
  const card = detail ? report(detail) : null;
  const refused = detail ? refusal(detail) : null;

  /** The ONE affordance on this screen that opens a conversation.
   *
   *  ALWAYS a fresh chat (owner ruling 2026-09-11) — no `chatId`, so the
   *  running reading is never joined. Servable since chatservice
   *  `dea07ce`: the fresh chat answers from the STORED scorecard rather
   *  than re-asking for birth details. `handoffKey` lets a second match
   *  ask go through in the same app launch. */
  const askAi = useCallback(() => {
    if (!detail) return;
    track('match_ask_ai', { from: 'scorecard' });
    router.push({
      pathname: '/chat',
      params: { pending: askTurn(detail), fresh: '1',
                handoffKey: String(Date.now()) },
    });
  }, [detail]);

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/matches'))}
            style={s.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
          >
            <ChevronLeft size={tokensIconSize} color={inkPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.body}>
          {load.phase === 'loading' ? <ActivityIndicator color={accent} /> : null}

          {load.phase === 'error' ? (
            <View style={s.gap}>
              <Text style={s.title}>We couldn’t open this match</Text>
              <Text style={s.sentence}>{load.message}</Text>
              <Pressable style={s.cta} onPress={read} accessibilityRole="button">
                <Text style={s.ctaText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {detail && head ? (
            <>
              <Text style={s.title}>{head.name}</Text>
              {head.scale ? <Text style={s.caption}>{head.scale}</Text> : null}
              {head.computed ? (
                <Text style={s.caption}>Computed {head.computed}</Text>
              ) : null}
              {head.freshness ? (
                <View style={s.notice}>
                  <Text style={s.noticeText}>{head.freshness}</Text>
                </View>
              ) : null}

              {/* ASTRAL-144: a refusal is the whole answer — the reason, and
                  the ask that would change it. No card, and therefore no
                  score: not a zero, not an empty ring. */}
              {detailState(detail) === 'refused' && refused ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Not scored</Text>
                  <Text style={s.sentence}>{refused.reason}</Text>
                  {refused.ask ? <Text style={s.caption}>{refused.ask}</Text> : null}
                </View>
              ) : null}

              {/* THE scorecard — the shared component, rendering the payload
                  the read returned, unchanged. */}
              {card ? (
                <MatchScorecard
                  ui={rnPrimitives}
                  theme={astroChartThemeNight}
                  width={width - gutter}
                  report={card}
                  title="Kundli Milan"
                />
              ) : null}

              <Pressable
                style={s.ghost}
                onPress={() => void askAi()}
                accessibilityRole="button"
                accessibilityLabel={`${ASK_AI_LABEL} with ${head.name}`}
              >
                <Text style={s.ghostText}>{ASK_AI_LABEL}</Text>
              </Pressable>

              {/* Owner 2026-09-19: a match could be saved and never removed.
                  The shipped person cascade, behind one confirm. */}
              {detail?.person_id ? (
                <Pressable
                  style={s.removeLink}
                  hitSlop={8}
                  onPress={() => {
                    const id = detail!.person_id!;
                    Alert.alert(`Remove ${head!.name}?`,
                      removeMatchConfirmation(head!.name, detail!.relation === 'partner'), [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove', style: 'destructive',
                          onPress: () => {
                            deletePerson(id)
                              .then(() => {
                                track('match_removed');
                                if (router.canGoBack()) router.back(); else router.replace('/matches');
                              })
                              .catch((e: any) => Alert.alert('Could not remove them', String(e?.message ?? e)));
                          },
                        },
                      ]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${head!.name} and everything saved about them`}
                >
                  <Text style={s.removeText}>{REMOVE_MATCH_LABEL}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;
const tokensIconSize = t.size.icon;
const inkPrimary = t.palette.ink.onCosmic;
const accent = t.palette.accent.ceremonial;
const gutter = t.space(10);

// Owner 2026-09-18 ("why background is white in this screen, fix"): this is a
// reading surface, so it lives on the night field with the rest of the app.
const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: {
    paddingHorizontal: t.space(5),
    paddingTop: t.space(2),
    paddingBottom: t.space(10),
    gap: t.space(2),
  },
  gap: { gap: t.space(3) },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.onCosmic },
  caption: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  sentence: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  card: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.cosmic.line,
    padding: t.space(4),
    gap: t.space(2),
    marginTop: t.space(2),
  },
  cardTitle: { ...t.type.scale.lead, color: t.palette.ink.onCosmic, fontWeight: '700' },
  notice: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderLeftWidth: 3,
    borderLeftColor: t.palette.accent.ceremonial,
    padding: t.space(4),
    marginTop: t.space(2),
  },
  noticeText: { ...t.type.scale.sub, color: t.palette.ink.onCosmic },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.ceremonialInk, fontWeight: '700' },
  ghost: {
    marginTop: t.space(3),
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.palette.cosmic.line,
  },
  ghostText: { ...t.type.scale.label, color: t.palette.ink.onCosmic },
  removeLink: { alignSelf: 'center', paddingVertical: t.space(3) },
  removeText: { ...t.type.scale.caption, color: t.palette.cosmic.horizon },
});
