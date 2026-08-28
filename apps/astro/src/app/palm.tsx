// The palm reading — capture, analysis and result (docs/49 ASTRAL-44..49).
//
// F36: neither palm nor muhurta appears on any of the board's twelve frames,
// and under India-first that is a hole in the product rather than a market
// simplification — the brief calls palm "the strongest part of the engine".
// AMB-26 asks where they live; its recommendation is (a), Home tiles, and
// this is that, taken as a default under the standing rule. No sixth tab.
//
// ── how it runs, and why it is a turn ──────────────────────────────────────
//
// Every other native surface in this app READS a stored artifact and costs
// zero turns (ASTRAL-242). A palm reading cannot: there is nothing to read
// until a photograph has been analysed. So it runs the engine, once, through
// the same lifecycle every turn uses — the headless-turn pattern
// `birth-details.tsx` established — and the user sees this screen rather than
// a chat.
//
// What is NOT invented here, and this is the whole discipline: the ask is the
// engine's (`palm_intent_needs_upload`), the two role labels are the
// engine's, the upload is the shared primitive's, the analysis is the
// engine's, and the answer travels back on the engine's own typed
// `input_response` carrier — nothing is flattened into a sentence for the
// extractor to parse out again (F18).
//
// ── every decision is next door ───────────────────────────────────────────
//
// `lib/palm-view.ts` is pure and unit-tested at the workspace root. In
// particular the retention disclosure lives there, because what this screen
// may and may not promise about a stored photograph is a decision, not a
// paragraph.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import {
  InputRequestView,
  LIGHT_THEME,
  PalmReadingView,
  parseInputRequest,
  parsePalmAnalysis,
  partitionAroundBlocks,
  splitDataBlocks,
  type InputRequestPayload,
  type PalmAnalysisPayload,
} from '@wealthai/astral';
import { rnPrimitives } from '@wealthai/astral-native';
import { chatMarkdownStyles, useSendMessage } from '@wealthai/chat-native';
import { useChatStore, type Message } from '@wealthai/core';

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { track } from '@/lib/analytics';
import { astroChatTheme } from '@/lib/chat-theme';
import { getToken } from '@/lib/auth';
import { lastChatId, rememberChat } from '@/lib/chat-session';
import { apiUrl } from '@/lib/core-adapter';
import { fetchBalance } from '@/lib/credits';
import {
  PALM_EMPTY_LINE,
  PALM_OPENING_TURN,
  captureHint,
  offTopicAskLine,
  palmAskKind,
  palmDisclosure,
  palmReplyKind,
} from '@/lib/palm-view';
import { routeIsLive } from '@/lib/tabs';
import { tokens } from '@/theme';

/** The block languages this screen splits out of the stream. Asked for by
 *  name rather than by registry, because these are the only two a palm turn
 *  can answer with and a trailing half-written fence of either must not
 *  scroll past the reader as raw JSON. */
const PALM_LANGUAGES = ['input_request', 'palm_analysis'];

const HEADER_HEIGHT = 148;

type Phase = 'disclosure' | 'asking' | 'capture' | 'analysing' | 'reading' | 'said' | 'error';

export default function Palm() {
  const { width } = useWindowDimensions();

  // An absent capability REMOVES the route, not only the tile (ASTRAL-233's
  // mechanism): expo-router builds its table from the file system, so a deep
  // link would otherwise reach a screen this build cannot serve.
  useEffect(() => {
    if (!routeIsLive('/palm')) router.replace('/home');
  }, []);

  const [phase, setPhase] = useState<Phase>('disclosure');
  const [request, setRequest] = useState<InputRequestPayload | null>(null);
  const [analysis, setAnalysis] = useState<PalmAnalysisPayload | null>(null);
  const [said, setSaid] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Nothing expanded to start. `combine_hand_analyses` files the PRIMARY
  // hand's geometry as the top-level lines and mounts, so opening hand 0 by
  // default repeats the reading the user has just read, word for word,
  // under a different heading — measured on the simulator 2026-08-28.
  const [openHand, setOpenHand] = useState<number | null>(null);
  const [photoToken, setPhotoToken] = useState<string | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const { send } = useSendMessage(chatId, (id) => {
    chatIdRef.current = id;
    setChatId(id);
    rememberChat(id);
  });

  /**
   * Which bot messages this screen has already read.
   *
   * `birth-details.tsx` only ever consumes ONE reply, so it remembers a
   * single prior id. A palm flow is two turns — the ask, then the reading —
   * so the boundary has to move after each one. Without this the second
   * effect re-reads the first reply and the screen shows the upload form
   * again with a completed reading behind it.
   */
  const consumed = useRef<Set<string>>(new Set());

  /**
   * ADOPT the chat the user is already in, exactly as a correction does
   * (ASTRAL-138 / ASTRAL-259's clause (i)).
   *
   * Not a style choice. The palm analysis persists into the chat's
   * `palm_analysis_data` slot, and the holistic reading draws on the chart
   * and the palm TOGETHER. A palm filed in a chat of its own is a reading the
   * user's actual conversation cannot see — which is the shape of the bug
   * that made a stored palm invisible to later turns in the first place.
   */
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

  // The photo comes back as an AUTHORISED file, so it needs a bearer token to
  // render. Fetched once here rather than inside the image element: a token
  // read per paint is a token read per stream chunk.
  useEffect(() => {
    void getToken().then(setPhotoToken).catch(() => setPhotoToken(null));
  }, []);

  const started = useRef(false);
  const begin = useCallback(() => {
    if (started.current || !adopted) return;
    started.current = true;
    setPhase('asking');
    track('palm_started');
    void (async () => {
      // Same reason `birth-details.tsx` calls it first: `ensure_welcome` runs
      // inside `GET /credits/balance` and nowhere else, so a brand-new
      // account has zero credits until something asks. A failure here is not
      // fatal — the engine's own out-of-credits reply is the honest thing to
      // show.
      try {
        await fetchBalance();
      } catch (e: unknown) {
        console.warn('[credits]', String((e as Error)?.message ?? e));
      }
      try {
        await send(PALM_OPENING_TURN, []);
      } catch (e: unknown) {
        setError(String((e as Error)?.message ?? e));
        setPhase('error');
      }
    })();
  }, [adopted, send]);

  // The reply, read out of the SHARED store — same message, same place the
  // chat screen reads it from if the user goes there next.
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

    const segments = splitDataBlocks(reply.message ?? '', PALM_LANGUAGES);
    // Only the text AFTER the reading is the reading's prose. Before it is
    // the engine's progress line, which reads as "still working" above a
    // finished result.
    const { after: prose } = partitionAroundBlocks(segments);

    const blocks = segments.filter((seg) => seg.kind === 'block');
    const reading = blocks
      .map((b) => (b.kind === 'block' ? parsePalmAnalysis(b.value) : null))
      .find((v): v is PalmAnalysisPayload => v !== null) ?? null;
    const asked = blocks
      .map((b) => (b.kind === 'block' ? parseInputRequest(b.value) : null))
      .find((v): v is InputRequestPayload => v !== null) ?? null;

    const kind = palmReplyKind(reading !== null, prose);
    if (reading) {
      setAnalysis(reading);
      // …and the prose the engine wrote ABOUT it rides along under the card.
      setSaid(prose);
      setPhase('reading');
      track('palm_reading_shown', {
        both_hands: reading.both_hands ? 1 : 0,
        hand_source: String(reading.hand_source ?? ''),
        rules: reading.classical_rules?.fired.length ?? 0,
      });
      return;
    }
    if (asked) {
      setRequest(asked);
      setPhase('capture');
      track('palm_ask_shown', { ask: String(asked.ask ?? ''), fields: asked.fields.length });
      return;
    }
    // No block. The engine answered in words — a refusal for a photo that is
    // not a palm (ASTRAL-47), an out-of-credits reply, a question. Its
    // sentence is shown as it wrote it; the screen does not route around a
    // refusal and does not retry it silently.
    setSaid(kind === 'said' ? prose : PALM_EMPTY_LINE);
    setPhase('said');
  }, [reply]);

  /** The typed carrier the widget built, sent as-is. */
  const submit = useCallback(
    (message: string) => {
      setPhase('analysing');
      setRequest(null);
      track('palm_submitted');
      void send(message, []).catch((e: unknown) => {
        setError(String((e as Error)?.message ?? e));
        setPhase('error');
      });
    },
    [send],
  );

  const toChat = () =>
    router.push({ pathname: '/chat', params: { chatId: chatIdRef.current ?? '' } });

  const markdown = chatMarkdownStyles(astroChatTheme);

  const disclosure = useMemo(() => palmDisclosure(), []);
  const askKind = palmAskKind(request?.ask);
  const filled = 0; // the widget owns its own field state; the hint is copy
  const hint = captureHint(filled);

  // The analysed photograph, if the engine filed one. Rendered with the
  // bearer token the file endpoint requires — an <Image> cannot carry a
  // header on its own, and an unauthorised GET renders as a broken tile.
  //
  // An image that cannot be fetched COLLAPSES. Measured on the simulator
  // 2026-08-28: a file id the backend does not have left a 220pt-tall empty
  // box between the heading and the reading — a hole where a photograph is
  // implied, which reads as a broken screen rather than as a reading without
  // a picture. The reading is complete without it, so the honest render of
  // "no image" is no element.
  const photo = useMemo(() => {
    if (!analysis?.image_url || !photoToken || photoBroken) return null;
    const path = analysis.image_url.replace(/^\/api\/v1/, '');
    return (
      <Image
        source={{ uri: apiUrl(path), headers: { Authorization: `Bearer ${photoToken}` } }}
        style={st.photo}
        contentFit="cover"
        onError={() => setPhotoBroken(true)}
        accessibilityLabel={analysis.hand_label ?? 'The analysed palm'}
      />
    );
  }, [analysis, photoToken, photoBroken]);

  return (
    <View style={st.fill}>
      <StatusBar style="light" />
      <ScrollView style={st.scroll} contentContainerStyle={st.body}>
        <View style={st.skyBlock}>
          <View style={st.sky} pointerEvents="none">
            <Svg width="100%" height={HEADER_HEIGHT}>
              <SkyDefs id="palm" />
              <SkyField id="palm" width={Math.max(width, 400)} height={HEADER_HEIGHT} />
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
              <Text style={st.title}>Palm Reading</Text>
              <Text style={st.stamp}>Hasta Rekha · both hands, read as a pair</Text>
            </View>
          </SafeAreaView>
        </View>

        {phase === 'disclosure' ? (
          <View style={st.card}>
            <Text style={st.cardTitle}>{disclosure.title}</Text>
            {disclosure.body.map((para) => (
              <Text key={para.slice(0, 24)} style={st.cardBody}>
                {para}
              </Text>
            ))}
            {/* No delete control and no "analyse without storing" option. F7:
                there is no DELETE route and `expiresAt` is unconditionally
                None, so either affordance would report success and change
                nothing — the silent-success class, inside a consent surface. */}
            <Pressable
              style={st.cta}
              accessibilityRole="button"
              accessibilityLabel={disclosure.cta}
              onPress={begin}
            >
              <Text style={st.ctaText}>{disclosure.cta}</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'asking' || phase === 'analysing' ? (
          <View style={st.card}>
            <ActivityIndicator color={tokens.palette.accent.interactive} />
            <Text style={st.cardBody}>
              {phase === 'analysing'
                ? 'Reading the lines, the mounts and the markings…'
                : 'Getting ready…'}
            </Text>
          </View>
        ) : null}

        {phase === 'capture' && request && askKind !== 'other' ? (
          <View style={st.card}>
            <InputRequestView
              ui={rnPrimitives}
              theme={LIGHT_THEME}
              width={width - tokens.space(12)}
              request={request}
              layout="page"
              submitLabel="Read my palm"
              onSend={submit}
            />
            {hint ? <Text style={st.caption}>{hint}</Text> : null}
          </View>
        ) : null}

        {/* An ask this screen is not for. Its words and the conversation —
            never an unrelated form under a "Palm Reading" heading. */}
        {phase === 'capture' && request && askKind === 'other' ? (
          <View style={st.card}>
            <Text style={st.cardBody}>{offTopicAskLine(request.ask)}</Text>
            <Pressable style={st.cta} onPress={toChat} accessibilityRole="button">
              <Text style={st.ctaText}>Continue in chat</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'reading' && analysis ? (
          <View style={st.readingWrap}>
            <PalmReadingView
              ui={rnPrimitives}
              theme={LIGHT_THEME}
              width={width - tokens.space(8)}
              analysis={analysis}
              photo={photo}
              openHand={openHand}
              onOpenHand={setOpenHand}
            />
            {/* The engine's own words about the reading, through the SAME
                markdown renderer the chat bubble uses — plain Text prints
                `**` and `###` at the user. */}
            {said ? (
              <View style={st.narration}>
                <Markdown style={markdown}>{said}</Markdown>
              </View>
            ) : null}
            <Pressable style={st.ctaGhost} onPress={toChat} accessibilityRole="button">
              <Text style={st.ctaGhostText}>Ask about this reading</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'said' ? (
          <View style={st.card}>
            <Text style={st.cardBody}>{said}</Text>
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
    </View>
  );
}

const t = tokens;

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  scroll: { flex: 1 },
  body: { paddingBottom: t.space(10) },

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
  cardTitle: { ...t.type.scale.lead, color: t.palette.ink.primary, fontWeight: '700' },
  cardBody: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  caption: { ...t.type.scale.caption, color: t.palette.ink.muted },

  readingWrap: { paddingHorizontal: t.space(4), paddingTop: t.space(4), gap: t.space(3) },
  narration: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(2),
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: t.radius.card,
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
