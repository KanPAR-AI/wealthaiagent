// Screen 4 — AI Chat as the board draws it (docs/astral-board/04-ai-chat.png;
// docs/49 ASTRAL-106): a WORKING surface per AMB-22(a) — warm paper ground,
// dark ink, a back chevron and the dot-grid menu either side of the serif
// wordmark over "Your cosmic advisor", a cosmic wash bleeding out of the
// top-right corner, the user's words in a violet bubble, the reply on a
// floating light card, the suggestion chips, and the send disc sitting inside
// the composer's pill.
//
// Same engine path as before the restyle: anonymous auth → chatservice → the
// PINNED astrology agent, streaming.
//
// STILL one exchange at a time. A real transcript is ASTRAL-105's shared
// message lifecycle, and inventing a second one here is exactly what
// `reading.ts`'s header warns against.
//
// The data blocks ARE rendered now (docs/49 ASTRAL-99, F22). The engine emits
// them as fenced JSON inside the text stream, and until this change they went
// through `react-native-markdown-display` — so a computed chart reached the
// owner as a screenful of raw JSON. The fences are split out here with the
// SAME rule web and mobile use (`splitDataBlocks` → `readDataBlock`: the
// fence language must equal the body's own `type`) and drawn through the ONE
// React Native binding, now shared rather than trapped in `apps/mobile`.
//
// Three outcomes, and the third is the one that matters: a registered type
// draws its view; an unparseable payload draws NOTHING; an UNREGISTERED type
// draws nothing and says so once, by name, in the console. What never
// happens is raw JSON on a user's screen.

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
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Markdown from 'react-native-markdown-display';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { splitDataBlocks, stripInputResponse } from '@wealthai/astral';
import { AstralBlock, astralBlockRegistry } from '@wealthai/astral-native';
import { getPlatform } from '@wealthai/core';

import { ArrowUp, ChevronLeft, DotGrid, StopSquare } from '@/components/glyphs';
import { CornerWash } from '@/components/sky';
import { WIDGET_ANSWER_EVENT } from '@/lib/astral-host';
import { fetchBalance } from '@/lib/credits';
import { ask, type AskHandle } from '@/lib/reading';
import { tokens } from '@/theme';

/**
 * The block types this build can draw, asked for rather than restated.
 *
 * `splitDataBlocks` uses them for one job: a TRAILING half-written fence is
 * withheld until it closes, so the seconds between "```natal_chart" and its
 * closing fence are not seconds of raw JSON scrolling past the reader.
 */
const DATA_LANGUAGES = astralBlockRegistry.types();

/**
 * The board's three chips, which are also the honest ones: each is a plain
 * follow-up that any reply can take. They appear only once a reply has
 * ARRIVED — a chip that says "Tell me more" over an empty screen is an
 * affordance pointing at nothing.
 */
const SUGGESTIONS = ['Yes, please', 'Tell me more', 'Another question'];

const WASH_HEIGHT = 132;
/** how far across the header the corner bleed reaches — it must not touch the
 *  wordmark, which is what a full-width wash did */
const WASH_WIDTH = 0.45;

export default function Chat() {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const handleRef = useRef<AskHandle | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [washWidth, setWashWidth] = useState(0);

  // Asking for the balance triggers the server's one-time welcome grant —
  // without this call a fresh account sits at zero and the first reading is
  // refused (the build-3 defect). The NUMBER now lives on the settings screen,
  // where the out-of-credits message points ("Settings → Credits"), because
  // the board's header carries a chevron, the wordmark and the menu and
  // nothing else. The call stays regardless of who displays the result.
  useEffect(() => {
    fetchBalance().catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);

  const send = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body || busy) return;
    setQuestion('');
    setAsked(body);
    setAnswer('');
    setError(null);
    setSettled(false);
    setBusy(true);
    try {
      const handle = await ask(body, {
        chatId: chatIdRef.current,
        onDelta: setAnswer,
      });
      handleRef.current = handle;
      chatIdRef.current = handle.chatId;
      await handle.done;
      setSettled(true);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'The reading did not come through.');
    } finally {
      handleRef.current = null;
      setBusy(false);
    }
  }, [busy]);

  // A widget answer arrives on the host channel `lib/astral-host.ts` installs
  // — the analogue of mobile's shipped quick-reply event — and goes out
  // through the one send path this screen already owns. No second send path,
  // and nothing flattened into a sentence for the extractor to re-read (F18):
  // what travels is the typed `input_response` fence the shared component
  // builds.
  useEffect(() => {
    return getPlatform().events.on(WIDGET_ANSWER_EVENT, (payload) => {
      const text = (payload as { text?: string } | undefined)?.text;
      if (text) void send(text);
    });
  }, [send]);

  // Text runs and data blocks, in the order the engine streamed them.
  const segments = splitDataBlocks(answer, DATA_LANGUAGES);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior="padding" style={s.fill}>
          <View style={s.header} onLayout={(e) => setWashWidth(e.nativeEvent.layout.width)}>
            {/* The cosmic wash the board bleeds out of the top-right corner:
                the ceremonial field, just visible, on a working surface. */}
            {washWidth ? (
              <View pointerEvents="none" style={s.wash}>
                <Svg width={washWidth * WASH_WIDTH} height={WASH_HEIGHT}>
                  <CornerWash id="chat" width={washWidth * WASH_WIDTH} height={WASH_HEIGHT} />
                </Svg>
              </View>
            ) : null}

            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : undefined)}
              style={s.headerSide}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
            >
              <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.primary} />
            </Pressable>

            <View style={s.headerMid}>
              <Text style={s.headerTitle}>{tokens.wordmark}</Text>
              <Text style={s.headerSub}>Your cosmic advisor</Text>
            </View>

            <Pressable
              onPress={() => router.push('/settings')}
              style={[s.headerSide, s.headerRight]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={10}
            >
              <DotGrid size={tokens.size.icon} color={tokens.palette.ink.primary} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={s.fill}
            contentContainerStyle={s.body}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {asked ? (
              <View style={s.userBubble}>
                {/* AMB-17 (a)'s declared cost: a widget answer travels as a
                    fenced `input_response` block inside the user's own
                    message, so the raw fence is suppressed on the user bubble
                    exactly as data fences are on an assistant one. The
                    human-readable echo is what remains. */}
                <Text style={s.userText}>{stripInputResponse(asked)}</Text>
              </View>
            ) : null}
            {segments.length ? (
              segments.map((seg, i) =>
                seg.kind === 'block' ? (
                  // Outside the reply card on purpose: a wheel and a
                  // scorecard draw their own surface, and nesting them in one
                  // gives the artifact two borders and 32px less width than
                  // it was told it had.
                  <AstralBlock key={`b${i}`} type={seg.type} data={seg.value} />
                ) : seg.text.trim() ? (
                  <View key={`t${i}`} style={s.replyCard}>
                    {/* The engine writes structured prose — bold claim leads,
                        lists of transits. Rendered as plain Text it arrived
                        with its asterisks showing. */}
                    <Markdown style={markdown}>{seg.text}</Markdown>
                  </View>
                ) : null,
              )
            ) : busy ? (
              <ActivityIndicator color={tokens.palette.accent.interactive} style={s.spinner} />
            ) : !asked ? (
              <Text style={s.hint}>
                Ask anything — start with your birth date, time and place.
              </Text>
            ) : null}
            {error ? <Text style={s.error}>{error}</Text> : null}
          </ScrollView>

          {settled && !busy ? (
            <View style={s.chips}>
              {SUGGESTIONS.map((chip) => (
                <Pressable
                  key={chip}
                  style={s.chip}
                  onPress={() => void send(chip)}
                  accessibilityRole="button"
                  accessibilityLabel={chip}
                >
                  <Text style={s.chipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={s.composer}>
            <View style={s.field}>
              <TextInput
                style={s.input}
                value={question}
                onChangeText={setQuestion}
                placeholder={`Message ${tokens.wordmark}...`}
                placeholderTextColor={tokens.palette.ink.muted}
                multiline
                editable={!busy}
                onSubmitEditing={() => void send(question)}
              />
              {/* Inside the pill's right edge, as the board draws it — not a
                  second control sitting beside the field. */}
              <Pressable
                style={[s.send, !question.trim() && !busy && s.sendOff]}
                onPress={busy ? () => handleRef.current?.stop() : () => void send(question)}
                accessibilityRole="button"
                accessibilityLabel={busy ? 'Stop the reading' : 'Send'}
              >
                {busy ? (
                  <StopSquare size={tokens.size.icon} color={tokens.palette.accent.interactiveInk} />
                ) : (
                  <ArrowUp size={tokens.size.icon} color={tokens.palette.accent.interactiveInk} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;

/** Markdown element styles, composed from the same steps every screen uses. */
const markdown = StyleSheet.create({
  body: { ...t.type.scale.body, color: t.palette.ink.primary },
  paragraph: { marginTop: 0, marginBottom: t.space(3) },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic', color: t.palette.ink.secondary },
  bullet_list: { marginBottom: t.space(2) },
  ordered_list: { marginBottom: t.space(2) },
  list_item: { marginBottom: t.space(1) },
  heading1: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary, marginBottom: t.space(2) },
  heading2: { ...t.type.scale.lead, ...t.type.display, color: t.palette.ink.primary, marginBottom: t.space(2) },
  heading3: { ...t.type.scale.label, color: t.palette.ink.primary, fontWeight: '700', marginBottom: t.space(1) },
  link: { color: t.palette.accent.interactive },
  code_inline: { backgroundColor: t.palette.paper.base, color: t.palette.ink.secondary },
  hr: { backgroundColor: t.palette.paper.line, height: StyleSheet.hairlineWidth },
});

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(2.5),
    overflow: 'hidden',
  },
  // The wash covers the whole header box; the fade lives in the gradient
  // itself (see CornerWash), so nothing here needs an opacity.
  wash: { position: 'absolute', top: 0, right: 0, height: WASH_HEIGHT },
  headerSide: { width: t.space(11) },
  headerRight: { alignItems: 'flex-end' },
  headerMid: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: {
    ...t.type.scale.title,
    ...t.type.display,
    color: t.palette.ink.primary,
  },
  headerSub: { ...t.type.scale.caption, color: t.palette.ink.muted },
  body: { padding: t.space(4), gap: t.space(3), paddingBottom: t.space(6) },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.card,
    borderBottomRightRadius: t.radius.tail,
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
  },
  userText: { ...t.type.scale.body, color: t.palette.accent.interactiveInk },
  replyCard: {
    backgroundColor: t.palette.paper.card,
    borderRadius: t.radius.card,
    paddingHorizontal: t.space(4),
    paddingTop: t.space(4),
    paddingBottom: t.space(1),
    // the board floats this card rather than outlining it
    shadowColor: t.elevation.card.color,
    shadowOpacity: t.elevation.card.opacity,
    shadowRadius: t.elevation.card.radius,
    shadowOffset: { width: 0, height: t.elevation.card.offsetY },
    elevation: 3,
  },
  spinner: { marginTop: t.space(4) },
  hint: { ...t.type.scale.sub, color: t.palette.ink.muted, marginTop: t.space(2) },
  error: { ...t.type.scale.sub, color: t.palette.danger },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space(2),
    paddingHorizontal: t.space(4),
    paddingBottom: t.space(2),
  },
  chip: {
    borderRadius: t.radius.chip,
    borderWidth: 1,
    borderColor: t.palette.accent.interactive,
    paddingHorizontal: t.space(3.5),
    paddingVertical: t.space(2),
    backgroundColor: t.palette.paper.card,
  },
  chipText: { ...t.type.scale.sub, color: t.palette.accent.interactive },
  composer: {
    paddingHorizontal: t.space(4),
    paddingTop: t.space(1),
    paddingBottom: t.space(3),
    backgroundColor: t.palette.paper.base,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: t.palette.paper.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.input,
    paddingLeft: t.space(4),
    paddingRight: t.space(1.5),
    paddingVertical: t.space(1.5),
  },
  input: {
    ...t.type.scale.body,
    flex: 1,
    maxHeight: t.space(30),
    color: t.palette.ink.primary,
    paddingVertical: t.space(2),
    paddingRight: t.space(2),
  },
  send: {
    width: t.size.disc,
    height: t.size.disc,
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.35 },
});
