// Muhurta — an auspicious time to begin (docs/49 ASTRAL-17, F36, AMB-26(a)).
//
// F36: neither palm nor muhurta appears on any of the board's twelve frames.
// Both are shipped engine intents; under India-first their absence from the
// product surface is a hole rather than a simplification. AMB-26 recommends
// (a) — Home tiles — and this is that. No sixth tab.
//
// ── read `lib/muhurta-view.ts` before changing this screen ────────────────
//
// It carries two things this file depends on and does not restate:
//
//   (1) the diagnosis for the form that is NOT here — there is no structured
//       ask for the three slots muhurta needs, verified by running
//       `_input_request_block('required_slots_missing',
//       Belief(intent='muhurta'))` in the container and getting the empty
//       string. A native event/date/place form would have to flatten its
//       values into a sentence for the extractor to parse back out, which is
//       F18's named anti-pattern with a structural test behind it;
//
//   (2) the MEASUREMENT that decided the shape of this screen — the user's
//       own sentence is turn ONE, because the two-turn opening the rest of
//       this app uses runs into a live subject-attribution defect that reads
//       a wedding date and a venue as somebody's birth details.
//
// What a muhurta screen is FOR — the windows — is drawn natively at full
// width by the renderer that has existed since PH-3. And the day four
// `InputFieldSpec` rows land in `graph.py`, the `form_ask` branch below
// lights up with no change here: this screen draws whichever block arrives
// rather than a form it declared itself.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import {
  InputRequestView,
  LIGHT_THEME,
  MuhurtaWindowsView,
  parseInputRequest,
  parseMuhurtaResults,
  partitionAroundBlocks,
  splitDataBlocks,
  type InputRequestPayload,
  type MuhurtaResultsPayload,
} from '@wealthai/astral';
import { rnPrimitives } from '@wealthai/astral-native';
import { chatMarkdownStyles, useSendMessage } from '@wealthai/chat-native';
import { useChatStore, type Message } from '@wealthai/core';

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { track } from '@/lib/analytics';
import { astroChatTheme } from '@/lib/chat-theme';
import { lastChatId, rememberChat } from '@/lib/chat-session';
import { fetchBalance } from '@/lib/credits';
import {
  MUHURTA_COMPOSE_PROMPT,
  MUHURTA_EMPTY_LINE,
  MUHURTA_OPENING_LINE,
  MUHURTA_REPLY_HINT,
  muhurtaReplyKind,
  replyReady,
  stillAsking,
  type MuhurtaPhase,
} from '@/lib/muhurta-view';
import { routeIsLive } from '@/lib/tabs';
import { tokens } from '@/theme';

const MUHURTA_LANGUAGES = ['input_request', 'muhurta_results'];
const HEADER_HEIGHT = 148;

export default function Muhurta() {
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!routeIsLive('/muhurta')) router.replace('/home');
  }, []);

  const [phase, setPhase] = useState<MuhurtaPhase>('compose');
  const [prose, setProse] = useState('');
  const [request, setRequest] = useState<InputRequestPayload | null>(null);
  const [results, setResults] = useState<MuhurtaResultsPayload | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const { send } = useSendMessage(chatId, (id) => {
    chatIdRef.current = id;
    setChatId(id);
    rememberChat(id);
  });

  const consumed = useRef<Set<string>>(new Set());
  /** Has this session ever produced windows? Decides whether a prose reply
   *  is an ASK or commentary — see `stillAsking`'s note on why this is not
   *  read out of the sentence. */
  const computed = useRef(false);

  // ADOPT the running chat, like every other computation this app starts
  // outside the chat screen (ASTRAL-259 clause (i)). A muhurta asked in a
  // conversation of its own cannot see the chart the user already cast, and
  // the node reads the natal Moon's nakshatra when it has one.
  const [adopted, setAdopted] = useState(false);
  useEffect(() => {
    void (async () => {
      const id = await lastChatId();
      if (id) {
        chatIdRef.current = id;
        setChatId(id);
      }
      setAdopted(true);
    })();
  }, []);

  // No opening turn. The user's own sentence IS turn one — see
  // `muhurta-view.ts` for the measurement that decided it. What still runs
  // on mount is the balance call, for the reason `birth-details.tsx` names:
  // `ensure_welcome` lives inside `GET /credits/balance` and nowhere else,
  // so a brand-new account has zero credits until something asks.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track('muhurta_started');
    void fetchBalance().catch((e: unknown) =>
      console.warn('[credits]', String((e as Error)?.message ?? e)));
  }, []);

  const reply = useChatStore((s) => {
    const id = chatId;
    if (!id) return null;
    const msgs = s.chats[id]?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].sender !== 'bot') continue;
      return consumed.current.has(msgs[i].id) ? null : (msgs[i] as Message);
    }
    return null;
  });

  useEffect(() => {
    if (!reply || reply.isStreaming) return;
    consumed.current.add(reply.id);
    if (reply.error) {
      setError(reply.error);
      setPhase('error');
      return;
    }

    const segments = splitDataBlocks(reply.message ?? '', MUHURTA_LANGUAGES);
    // Only the text AFTER the result is the reading. Everything before it is
    // the engine's progress line ("Calculating auspicious windows… 🔮"),
    // which read as "still working" above a finished result on the simulator.
    const { after: text } = partitionAroundBlocks(segments);
    const blocks = segments.filter((seg) => seg.kind === 'block');
    const windows = blocks
      .map((b) => (b.kind === 'block' ? parseMuhurtaResults(b.value) : null))
      .find((v): v is MuhurtaResultsPayload => v !== null) ?? null;
    const asked = blocks
      .map((b) => (b.kind === 'block' ? parseInputRequest(b.value) : null))
      .find((v): v is InputRequestPayload => v !== null) ?? null;

    const kind = muhurtaReplyKind(
      windows !== null,
      asked !== null,
      text,
      stillAsking(computed.current),
    );

    setProse(text);
    setRequest(asked);
    if (windows) {
      computed.current = true;
      setResults(windows);
      setPhase('windows');
      track('muhurta_windows_shown', { windows: windows.windows.length });
      return;
    }
    if (kind === 'form_ask') {
      setPhase('form_ask');
      return;
    }
    if (kind === 'empty') {
      setProse(MUHURTA_EMPTY_LINE);
      setPhase('said');
      return;
    }
    setPhase(kind === 'prose_ask' ? 'prose_ask' : 'said');
  }, [reply]);

  const answer = useCallback(
    (message: string) => {
      // Never before adoption resolves. Sending first would create a NEW
      // chat and the muhurta would be computed in a conversation that cannot
      // see the chart the user already cast — the node reads the natal
      // Moon's nakshatra when it has one.
      if (!replyReady(message) || !adopted) return;
      setDraft('');
      setPhase('computing');
      track('muhurta_answered');
      void send(message, []).catch((e: unknown) => {
        setError(String((e as Error)?.message ?? e));
        setPhase('error');
      });
    },
    [send, adopted],
  );

  const toChat = () =>
    router.push({ pathname: '/chat', params: { chatId: chatIdRef.current ?? '' } });

  const markdown = chatMarkdownStyles(astroChatTheme);

  return (
    <View style={st.fill}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior="padding" style={st.fill}>
        <ScrollView
          style={st.scroll}
          contentContainerStyle={st.body}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={st.skyBlock}>
            <View style={st.sky} pointerEvents="none">
              <Svg width="100%" height={HEADER_HEIGHT}>
                <SkyDefs id="muhurta" />
                <SkyField id="muhurta" width={Math.max(width, 400)} height={HEADER_HEIGHT} />
                <Stars width={Math.max(width, 400)} height={HEADER_HEIGHT} until={0.6} scale={0.8} />
              </Svg>
            </View>
            <SafeAreaView edges={['top']}>
              <View style={st.navRow}>
                <Pressable
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                  style={st.back}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={10}
                >
                  <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
                </Pressable>
              </View>
              <View style={st.head}>
                <Text style={st.title}>Muhurta</Text>
                <Text style={st.stamp}>An auspicious time to begin</Text>
              </View>
            </SafeAreaView>
          </View>

          {phase === 'computing' ? (
            <View style={st.card}>
              <ActivityIndicator color={tokens.palette.accent.interactive} />
              <Text style={st.cardBody}>{MUHURTA_OPENING_LINE}</Text>
            </View>
          ) : null}

          {/* The engine's prose ask, in the engine's own words, with a box
              for the user's own sentence. Nothing here is composed from
              typed values (F18) — the text that travels is the text they
              wrote. */}
          {phase === 'compose' || phase === 'prose_ask' ? (
            <View style={st.card}>
              {/* Turn one is the user's sentence, so the first prompt is the
                  SCREEN's; every later one is the engine's own words. */}
              <Text style={st.cardBody}>
                {phase === 'compose' ? MUHURTA_COMPOSE_PROMPT : prose}
              </Text>
              <TextInput
                style={st.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={MUHURTA_REPLY_HINT}
                placeholderTextColor={tokens.palette.ink.muted}
                multiline
                autoCapitalize="sentences"
                accessibilityLabel="Your answer"
                testID="muhurta-reply"
              />
              <Pressable
                style={[st.cta, replyReady(draft) && adopted ? null : st.ctaOff]}
                disabled={!replyReady(draft) || !adopted}
                accessibilityRole="button"
                accessibilityLabel="Find windows"
                onPress={() => answer(draft)}
              >
                <Text style={st.ctaText}>Find windows</Text>
              </Pressable>
            </View>
          ) : null}

          {/* The structured ask, the day the engine sends one. No client
              change is needed for this branch to light up. */}
          {phase === 'form_ask' && request ? (
            <View style={st.card}>
              <InputRequestView
                ui={rnPrimitives}
                theme={LIGHT_THEME}
                width={width - tokens.space(12)}
                request={request}
                layout="page"
                submitLabel="Find windows"
                onSend={answer}
              />
            </View>
          ) : null}

          {phase === 'windows' && results ? (
            <View style={st.windowsWrap}>
              {/* The WINDOWS first. They are what this screen is for, and
                  the narration below them is commentary on them. */}
              <MuhurtaWindowsView
                ui={rnPrimitives}
                theme={LIGHT_THEME}
                width={width - tokens.space(8)}
                results={results}
              />
              {/* …and the reading, through the SAME markdown renderer the
                  chat uses. Rendered as plain text it printed `**1.` and
                  `###` on screen, which is the raw-markdown leak the shared
                  bubble already solved — a second renderer here would be a
                  second answer to a solved question. */}
              {prose ? (
                <View style={st.narration}>
                  <Markdown style={markdown}>{prose}</Markdown>
                </View>
              ) : null}
              <Pressable style={st.ctaGhost} onPress={toChat} accessibilityRole="button">
                <Text style={st.ctaGhostText}>Ask about these windows</Text>
              </Pressable>
            </View>
          ) : null}

          {phase === 'said' ? (
            <View style={st.card}>
              <Text style={st.cardBody}>{prose}</Text>
              <Pressable style={st.cta} onPress={toChat} accessibilityRole="button">
                <Text style={st.ctaText}>Continue in chat</Text>
              </Pressable>
            </View>
          ) : null}

          {phase === 'error' ? (
            <View style={st.notice}>
              <SymbolIcon
                name="exclamationmark.triangle"
                size={tokens.size.icon}
                color={tokens.palette.danger}
              />
              <Text style={st.noticeText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const t = tokens;

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  scroll: { flex: 1 },
  body: { paddingBottom: t.space(12) },

  skyBlock: { backgroundColor: t.palette.cosmic.base },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT },
  navRow: { paddingHorizontal: t.space(3), paddingTop: t.space(2) },
  back: { width: t.size.disc, height: t.size.disc, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: t.space(5), paddingBottom: t.space(5), gap: t.space(1) },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  stamp: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },

  card: {
    marginHorizontal: t.space(4),
    marginTop: t.space(4),
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    padding: t.space(5),
    gap: t.space(3),
  },
  cardBody: { ...t.type.scale.sub, color: t.palette.ink.secondary },

  input: {
    ...t.type.scale.sub,
    color: t.palette.ink.primary,
    minHeight: 88,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.input,
    padding: t.space(3),
    textAlignVertical: 'top',
  },

  windowsWrap: { paddingHorizontal: t.space(4), paddingTop: t.space(4), gap: t.space(3) },
  narration: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(2),
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space(3),
    marginHorizontal: t.space(4),
    marginTop: t.space(4),
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
  ctaOff: { opacity: 0.45 },
  ctaText: { ...t.type.scale.sub, color: t.palette.accent.interactiveInk, fontWeight: '700' },
  ctaGhost: {
    alignSelf: 'flex-start',
    borderRadius: t.radius.button,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    paddingVertical: t.space(2.5),
    paddingHorizontal: t.space(5),
  },
  ctaGhostText: { ...t.type.scale.sub, color: t.palette.ink.primary, fontWeight: '600' },
});
