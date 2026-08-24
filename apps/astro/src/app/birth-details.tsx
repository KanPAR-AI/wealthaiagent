// Screen 2 — Birth Details, as the board draws it (docs/astral-board/
// 02-birth-details.png; docs/49 ASTRAL-104): the light working surface, the
// back chevron, the serif "Let's Build Your Chart" over its subtitle, three
// labelled fields with their glyphs, the violet Continue and the privacy line.
//
// ── the thing this screen is NOT ───────────────────────────────────────────
//
// The board draws a self-contained form with three fields and a Continue
// button, which reads as "POST the three fields". There is no endpoint that
// accepts them and there must not be one (F24): `api/v1/endpoints/astrology.py`
// has exactly two routes, and `reconcile` is the only fact-writer (INV-1).
//
// So this screen does not own a form at all. It opens the pinned chat, asks
// the engine for a reading, and renders the `input_request` block the engine
// answers with — FULL-SCREEN instead of in a bubble. Same block, same
// component (`packages/astral/src/components/input-request.tsx`), same typed
// `input_response` carrier, different chrome. The fields on screen are
// whatever the engine says it is missing; nothing here names a slot key, and
// nothing here decides that a birth time is required.
//
// Two consequences worth stating, because both are load-bearing:
//   * if the engine answers WITHOUT a block, this screen says so and offers
//     the conversation — it does not draw three fields of its own from
//     memory. A form that renders when the engine did not ask for one is a
//     form whose values have nowhere to land.
//   * Continue does not send. It hands the composed message to the chat
//     screen, which owns the ONE send path — so the answer, the echo and the
//     streaming chart all happen in the place that can show them, and there
//     is no second chat client (ASTRAL-105's standing rule).
//
// The opening turn goes out through the SHARED lifecycle (ASTRAL-105), not
// through a helper of its own: `lib/reading.ts` is gone. This screen sends
// one message and then READS the reply out of the shared chat store — which
// is also why the conversation it starts is already in the transcript by the
// time the chat screen opens, rather than being re-fetched or re-sent.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

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

import { ChevronLeft, SymbolIcon } from '@/components/glyphs';
import { CornerWash } from '@/components/sky';
import { track } from '@/lib/analytics';
import { fetchBalance } from '@/lib/credits';
import { tokens } from '@/theme';

/**
 * The turn that opens the chat.
 *
 * A sentence, not a command — it becomes the first user message in a
 * transcript the user can scroll back through, and "cast my kundli" is what
 * somebody would actually say. The ENGINE decides what it needs from it; this
 * string does not name a field, a slot or a kind.
 */
const OPENING_TURN = "I'd like my birth chart.";

const WASH_HEIGHT = 190;
const WASH_WIDTH = 0.62;

export default function BirthDetails() {
  const { width } = useWindowDimensions();
  const [request, setRequest] = useState<InputRequestPayload | null>(null);
  const [prose, setProse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const { send } = useSendMessage(chatId, (id) => {
    chatIdRef.current = id;
    setChatId(id);
  });

  // One turn, through the one lifecycle. `started` guards the SEND rather
  // than the mount: `send`'s identity changes as the turn progresses, so an
  // unguarded effect would ask twice.
  //
  // The balance call comes FIRST, and it is not decoration. `ensure_welcome`
  // runs inside `GET /credits/balance` and nowhere else (chatservice
  // `credits.py:34`), so a brand-new account has ZERO until something asks —
  // and this screen sends the first turn of the app's life. Measured on the
  // simulator, fresh install, 2026-08-24: the engine answered "You're out of
  // credits, so I can't generate this reply" to the very first question,
  // before any screen that asks for the balance had mounted. `chat.tsx` asks
  // too; that call is for the resume path and stays.
  //
  // Awaited, and a failure is not fatal: if the balance call fails the ask
  // still goes out, and the engine's own out-of-credits reply is the honest
  // thing to show.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track('birth_details_shown');
    void (async () => {
      try {
        await fetchBalance();
      } catch (e: any) {
        console.warn('[credits]', String(e?.message ?? e));
      }
      await send(OPENING_TURN, []);
    })();
  }, [send]);

  // The reply, read out of the SHARED store rather than out of a promise
  // this screen owns — same message, same place the chat screen will read it
  // from a moment later.
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
      // ASTRAL-69's designed failure: the reading did not come through at
      // all. Named, never a spinner that never ends.
      setError(reply.error);
      return;
    }
    // The block arrives as a fenced data block inside the text stream — the
    // same convention every other astrology block uses, read with the same
    // splitter, so this screen cannot drift from the chat surface.
    const segments = splitDataBlocks(reply.message ?? '', ['input_request']);
    const block = segments.find((seg) => seg.kind === 'block');
    const asked = block ? parseInputRequest(block.value) : null;
    setProse(
      segments
        .filter((seg) => seg.kind === 'text')
        .map((seg) => (seg.kind === 'text' ? seg.text : ''))
        .join('')
        .trim(),
    );
    setRequest(asked);
    if (!asked) {
      // No block and no words: without this the spinner spins forever —
      // the one state this screen's own comment says it avoids (Role-3).
      setProse((p) =>
        p || 'The reading did not come back as a form. Continue in chat and I will ask you there.',
      );
    }
    track('birth_details_ask', { fields: asked ? asked.fields.length : 0 });
  }, [reply]);

  // Continue: hand the typed carrier to the chat screen, which sends it.
  // Nothing is flattened into a sentence for the extractor to re-read (F18) —
  // what travels is exactly what `buildInputResponseMessage` produced.
  const handOff = useCallback((message: string) => {
    track('birth_details_submitted');
    router.replace({
      pathname: '/chat',
      params: { chatId: chatIdRef.current ?? '', pending: message },
    });
  }, []);

  const toChat = () =>
    router.replace({
      pathname: '/chat',
      params: { chatId: chatIdRef.current ?? '' },
    });

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View pointerEvents="none" style={s.wash}>
          <Svg width={width * WASH_WIDTH} height={WASH_HEIGHT}>
            <CornerWash id="details" width={width * WASH_WIDTH} height={WASH_HEIGHT} />
          </Svg>
        </View>

        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
        >
          <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.primary} />
        </Pressable>

        <ScrollView
          contentContainerStyle={s.body}
          keyboardDismissMode="interactive"
          // Measured on the simulator: with the keyboard up, the place field
          // and Continue sat behind it — the user could not see what they had
          // typed into the one field that is free text.
          automaticallyAdjustKeyboardInsets
          // …and a tap on Continue while the keyboard is up must submit,
          // not just dismiss the keyboard and be swallowed.
          keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{tokens.copy.birthDetailsTitle}</Text>

          {request ? (
            <>
              {/* The board's subtitle stands in only when the engine sent no
                  sentence of its own. When it did, that sentence is the one
                  carrying information — which values a birth time unlocks —
                  and two subtitles is one too many. */}
              {request.reason ? null : (
                <Text style={s.subtitle}>{tokens.copy.birthDetailsSubtitle}</Text>
              )}
              <InputRequestView
                ui={rnPrimitives}
                theme={LIGHT_THEME}
                width={width - tokens.space(12)}
                request={request}
                layout="page"
                submitLabel="Continue"
                onSend={handOff}
                hints={{ place: tokens.copy.fieldHints.placeBirthHint }}
                fieldIcons={FIELD_ICONS}
              />
            </>
          ) : error ? (
            // ASTRAL-69's designed failure, one level up: the reading did not
            // come through at all. Named, never a spinner that never ends.
            <View style={s.gap}>
              <Text style={s.subtitle}>{error}</Text>
              <Pressable style={s.cta} onPress={toChat} accessibilityRole="button"
                accessibilityLabel="Continue in chat">
                <Text style={s.ctaText}>Continue in chat</Text>
              </Pressable>
            </View>
          ) : prose ? (
            // The engine answered, and it did not ask for these three things.
            // Its words, and the conversation — never a form invented here to
            // fill the space.
            <View style={s.gap}>
              <Text style={s.subtitle}>{prose}</Text>
              <Pressable style={s.cta} onPress={toChat} accessibilityRole="button"
                accessibilityLabel="Continue in chat">
                <Text style={s.ctaText}>Continue in chat</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.gap}>
              <Text style={s.subtitle}>{tokens.copy.birthDetailsSubtitle}</Text>
              <ActivityIndicator color={tokens.palette.accent.interactive} />
            </View>
          )}

          <View style={s.footer}>
            <SymbolIcon name="lock.shield" size={tokens.size.icon} color={tokens.palette.ink.muted} />
            <Text style={s.footerText}>{tokens.copy.privacyFooter}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;

/** Frame 2's three row glyphs, keyed by the engine's field KIND. */
const FIELD_ICONS = {
  date: <SymbolIcon name="calendar" color={t.palette.ink.muted} />,
  time: <SymbolIcon name="clock" color={t.palette.ink.muted} />,
  place: <SymbolIcon name="mappin.and.ellipse" color={t.palette.ink.muted} />,
};

const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  wash: { position: 'absolute', top: 0, right: 0, height: WASH_HEIGHT },
  back: { paddingHorizontal: t.space(4), paddingVertical: t.space(2) },
  body: {
    paddingHorizontal: t.space(6),
    paddingTop: t.space(4),
    paddingBottom: t.space(8),
    gap: t.space(5),
  },
  title: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.primary },
  subtitle: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  gap: { gap: t.space(4) },
  cta: {
    backgroundColor: t.palette.accent.interactive,
    borderRadius: t.radius.button,
    paddingVertical: t.space(4),
    alignItems: 'center',
  },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space(2),
    paddingTop: t.space(2),
  },
  footerText: { ...t.type.scale.caption, color: t.palette.ink.muted },
});
