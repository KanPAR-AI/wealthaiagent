// Preferences — what matters to you in a partner (docs/49 S20: ASTRAL-152,
// ASTRAL-154, ASTRAL-159, ASTRAL-162).
//
// The owner's question this screen answers: *"where do I specify my own
// preferences so AI gives in addition to kundali / based on my preference /
// based on kundali"*. Here, and it is three things at once: what is stored,
// what your CHART suggests and why, and the ask that changes either.
//
// ── the shape, and why it is the birth-details shape ───────────────────────
//
// This screen owns no form. It opens the pinned chat with a SENTENCE, and
// renders the `input_request` the engine answers with — full-screen instead
// of in a bubble, the same component, the same typed `input_response`
// carrier. There is no `PUT /people/priorities` and there must not be one:
// the engine declares the vocabulary, validates the picks against it, refuses
// an off-menu key by name and reconciles the write (F24, INV-1, ASTRAL-88).
// A screen that POSTed a preference would be a second vocabulary the moment
// the table changed.
//
// ── the two things it must never do ───────────────────────────────────────
//
// 1. SHOW A DERIVED PRIORITY AS ONE THE USER CHOSE (ASTRAL-160). The
//    proposals sit in their own section, labelled, each with the chart
//    feature behind it, and they are INACTIVE until picked (AMB-29).
// 2. TURN THE FREE-TEXT NOTE INTO PROSE (AMB-32(c)). It is quoted back as
//    the user's own words and labelled as unscored, and nothing composes
//    with it.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  InputRequestView,
  LIGHT_THEME,
  parseInputRequest,
  splitDataBlocks,
  type InputRequestPayload,
} from '@wealthai/astral';
import { rnPrimitives } from '@wealthai/astral-native';
import { useSendMessage } from '@wealthai/chat-native';
import { useChatStore, type Message } from '@wealthai/core';

import { ChevronLeft } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import { fetchPriorities, type PrioritiesResponse } from '@/lib/people';
import {
  EMPTY_BODY,
  EMPTY_TITLE,
  disclosure,
  interestRows,
  isEmpty,
  proposalAbsence,
  proposalRows,
  rankedRows,
  updatedLine,
} from '@/lib/priorities-view';
import { tokens } from '@/theme';

/** The fallback turn, used only if the read failed. The server sends its own
 *  (`edit_turn`) — a SENTENCE, never a value. */
const OPENING_TURN = "I'd like to set what matters to me in a partner.";

export default function Preferences() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<PrioritiesResponse | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [request, setRequest] = useState<InputRequestPayload | null>(null);
  const [asking, setAsking] = useState(false);
  const [prose, setProse] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const { send } = useSendMessage(chatId, (id) => {
    chatIdRef.current = id;
    setChatId(id);
  });

  const read = useCallback(() => {
    setReadError(null);
    fetchPriorities()
      .then((res) => {
        setData(res);
        track('preferences_shown', {
          ranked: res.set.ranked.length,
          proposed: res.proposed.entries.length,
        });
      })
      // "Nothing is set" and "the read failed" are different sentences, and
      // this screen says the right one because this does not swallow.
      .catch((e: any) => setReadError(String(e?.message ?? e)));
  }, []);

  useEffect(read, [read]);

  // The ask goes out through the SHARED lifecycle, exactly as screen 2 does.
  // It is not sent on mount: opening this screen is a READ, and a screen that
  // starts a chat turn just by being opened spends a turn the user did not
  // ask for.
  const openAsk = useCallback(() => {
    if (asking) return;
    setAsking(true);
    track('preferences_ask');
    void send(data?.edit_turn?.trim() || OPENING_TURN, []);
  }, [asking, data, send]);

  const reply = useChatStore((s) => {
    const id = chatId;
    if (!id) return null;
    const msgs = s.chats[id]?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].sender === 'bot') return msgs[i] as Message;
    }
    return null;
  });

  const parsed = useRef(false);
  useEffect(() => {
    if (parsed.current || !reply || reply.isStreaming) return;
    parsed.current = true;
    if (reply.error) {
      setProse(reply.error);
      return;
    }
    const segments = splitDataBlocks(reply.message ?? '', ['input_request']);
    const block = segments.find((seg) => seg.kind === 'block');
    const asked = block ? parseInputRequest(block.value) : null;
    setRequest(asked);
    setProse(
      segments
        .filter((seg) => seg.kind === 'text')
        .map((seg) => (seg.kind === 'text' ? seg.text : ''))
        .join('')
        .trim(),
    );
    if (!asked) {
      // Never a spinner that never ends: if the engine answered without a
      // block, its words plus the conversation are what this screen offers.
      setProse(
        (p) =>
          p ||
          'The engine did not send the picker this time. Continue in chat and I will ask you there.',
      );
    }
  }, [reply]);

  // Continue hands the typed carrier to the chat screen, which owns the one
  // send path. Nothing is flattened into a sentence for an extractor to read
  // back out (F18), and nothing is written here.
  const handOff = useCallback((message: string) => {
    track('preferences_submitted');
    router.replace({
      pathname: '/chat',
      params: { chatId: chatIdRef.current ?? '', pending: message },
    });
  }, []);

  const ranked = rankedRows(data);
  const interests = interestRows(data);
  const proposals = proposalRows(data);
  const absence = proposalAbsence(data);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
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
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>What matters to you</Text>

          {/* The invariant, stated where the change is made: this is the
              sentence that teaches ASTRAL-149, and it comes from the server
              so it is generated by the same mapping that drove the sort. */}
          <Text style={s.sentence}>
            {disclosure(data) ||
              'Your picks change what your reports lead with and how your matches are ordered. No score changes.'}
          </Text>

          {readError ? (
            <View style={s.gap}>
              <Text style={s.sentence}>I could not read your preferences just now. {readError}</Text>
              <Pressable style={s.ghost} onPress={read} accessibilityRole="button" accessibilityLabel="Try again">
                <Text style={s.ghostText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {isEmpty(data) && !readError ? (
            <View style={s.gap}>
              <Text style={s.sectionTitle}>{EMPTY_TITLE}</Text>
              <Text style={s.sentence}>{EMPTY_BODY}</Text>
            </View>
          ) : null}

          {ranked.length ? (
            <>
              <Text style={s.section}>In this order</Text>
              <View style={s.card}>
                {ranked.map((row, i) => (
                  <View key={row.key}>
                    <View style={s.row}>
                      <View style={[s.rank, row.fromChart ? s.rankChart : null]}>
                        <Text style={s.rankText}>{row.rank}</Text>
                      </View>
                      <View style={s.rowText}>
                        <Text style={s.rowValue}>{row.label}</Text>
                        {/* ASTRAL-160: "from your chart" and "set by you" are
                            different statements and never the same pixels. */}
                        <Text style={s.caption}>{row.caption}</Text>
                      </View>
                    </View>
                    {i < ranked.length - 1 ? <View style={s.divider} /> : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {interests.length ? (
            <>
              <Text style={s.section}>Also kept — not scored by gun milan</Text>
              <View style={[s.card, s.cardMuted]}>
                {interests.map((row, i) => (
                  <View key={row.id}>
                    <View style={s.row}>
                      <View style={s.rowText}>
                        <Text style={row.freeText ? s.rowNote : s.rowValue}>{row.text}</Text>
                        <Text style={s.caption}>{row.note}</Text>
                      </View>
                    </View>
                    {i < interests.length - 1 ? <View style={s.divider} /> : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {proposals.length ? (
            <>
              <Text style={s.section}>Your chart suggests</Text>
              <View style={[s.card, s.cardProposed]}>
                <View style={s.cardBody}>
                  <Text style={s.caption}>
                    Suggestions only — nothing here is active until you pick it.
                  </Text>
                  {proposals.map((row) => (
                    <View key={row.key} style={s.gapTight}>
                      <Text style={s.rowValue}>{row.label}</Text>
                      {/* the basis travels with the claim, every time */}
                      <Text style={s.caption}>{row.basis}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : absence ? (
            <>
              <Text style={s.section}>Your chart suggests</Text>
              <View style={[s.card, s.cardProposed]}>
                <View style={s.cardBody}>
                  {/* ASTRAL-161: an honest absence, never a starter set with
                      a chart's name on it. */}
                  <Text style={s.sentence}>{absence}</Text>
                </View>
              </View>
            </>
          ) : null}

          {request ? (
            <View style={s.gap}>
              <Text style={s.section}>Change them</Text>
              {prose ? <Text style={s.sentence}>{prose}</Text> : null}
              <InputRequestView
                ui={rnPrimitives}
                theme={LIGHT_THEME}
                width={width - tokens.space(12)}
                request={request}
                layout="page"
                submitLabel="Save"
                onSend={handOff}
              />
            </View>
          ) : asking ? (
            <View style={s.gap}>
              {prose ? (
                <>
                  <Text style={s.sentence}>{prose}</Text>
                  <Pressable
                    style={s.ghost}
                    onPress={() =>
                      router.replace({ pathname: '/chat', params: { chatId: chatIdRef.current ?? '' } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Continue in chat"
                  >
                    <Text style={s.ghostText}>Continue in chat</Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator color={tokens.palette.accent.interactive} />
              )}
            </View>
          ) : (
            <Pressable
              style={s.cta}
              onPress={openAsk}
              accessibilityRole="button"
              accessibilityLabel={ranked.length ? 'Change what matters' : 'Set what matters'}
            >
              <Text style={s.ctaText}>
                {ranked.length ? 'Change what matters' : 'Set what matters'}
              </Text>
            </Pressable>
          )}

          {updatedLine(data) ? <Text style={s.caption}>{updatedLine(data)}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: {
    paddingHorizontal: t.space(5),
    paddingTop: t.space(2),
    paddingBottom: t.space(10),
    gap: t.space(3),
  },
  gap: { gap: t.space(3) },
  gapTight: { gap: t.space(1) },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.primary },
  sectionTitle: { ...t.type.scale.title, color: t.palette.ink.primary },
  section: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1,
    marginTop: t.space(2),
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    overflow: 'hidden',
  },
  /** the second tier reads as a quieter surface — it does nothing to order */
  cardMuted: { backgroundColor: t.palette.paper.base },
  /** …and a suggestion is visibly a suggestion, never a stored pick */
  cardProposed: { borderColor: t.palette.accent.ceremonial },
  cardBody: { padding: t.space(4), gap: t.space(2.5) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3),
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3.5),
  },
  rank: {
    width: t.size.icon + 8,
    height: t.size.icon + 8,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.palette.accent.interactive,
  },
  rankChart: { backgroundColor: t.palette.accent.ceremonial },
  rankText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '700' },
  rowText: { flex: 1, gap: t.space(0.5) },
  rowValue: { ...t.type.scale.lead, color: t.palette.ink.primary },
  /** the user's own words, quoted and italic — visibly not a picked option */
  rowNote: { ...t.type.scale.lead, color: t.palette.ink.secondary, fontStyle: 'italic' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.palette.paper.line,
    marginLeft: t.space(4),
  },
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
    paddingVertical: t.space(3.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  ghostText: { ...t.type.scale.label, color: t.palette.ink.primary },
});
