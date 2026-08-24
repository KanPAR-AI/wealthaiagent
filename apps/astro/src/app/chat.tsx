// Screen 4 — AI Chat (docs/astral-board/04-ai-chat.png; docs/49 ASTRAL-106),
// and it is now the yourfinadvisor chat wearing this brand.
//
// ── what this file is, after ASTRAL-105 ───────────────────────────────────
//
// The owner's ruling, verbatim: "is chat page same as yourfinadvisor app, it
// should be — just some branding details, and memory extraction and widget…
// with routing disabled." So the conversation — the lifecycle, the
// transcript, the bubble, the composer, the interactive widgets — is
// `<ChatSurface>` from `@wealthai/chat-native`, the same component
// `apps/mobile` renders. What is left in this file is the CHROME the board
// draws around it: the paper ground, the back chevron and the dot-grid menu
// either side of the serif wordmark over "Your cosmic advisor", and the
// cosmic wash bleeding out of the top-right corner.
//
// The three things this app is allowed to differ in, and where each lives:
//   (a) brand    → `lib/chat-theme.ts` (values) and the copy below
//   (b) widgets  → `lib/chat-widgets.tsx` (the astral blocks)
//   (c) routing  → `lib/chat-host.ts`: routing off, agent pinned, no picker
// Memory extraction needs nothing: it is server-side and already runs on
// every turn this app sends.
//
// ── what it replaces ──────────────────────────────────────────────────────
//
// One `asked` string and one `answer` string — so the previous turn vanished
// the moment the next one began, and a relaunch showed an empty screen even
// though the conversation was safe on the server. There is a real transcript
// now, hydrated from history on mount, which is the point of the slice:
// close the app mid-reading, come back, and the reading is still there.
//
// `lib/reading.ts` is gone. Its own header said it was "NOT a second chat
// client" and that the real lifecycle would move here; it did, and its §12
// funnel counters moved with it into the lifecycle rather than being left
// behind in a screen.

import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CHAT_RETRY_EVENT,
  CHAT_SEND_EVENT,
  ChatSurface,
  loadChatIntoStore,
  useSendMessage,
} from '@wealthai/chat-native';
import { getPlatform, useChatStore } from '@wealthai/core';

import { ArrowUp, ChevronLeft, DotGrid, StopSquare } from '@/components/glyphs';
import { CornerWash } from '@/components/sky';
import { astroChatTheme } from '@/lib/chat-theme';
import { ASTRO_DATA_LANGUAGES, AstroWidget } from '@/lib/chat-widgets';
import { fetchBalance } from '@/lib/credits';
import { tokens } from '@/theme';

/**
 * Which conversation this app was last in.
 *
 * `apps/mobile` has a drawer full of chats and picks one; this app has one
 * running reading and simply resumes it. Screen-level state, deliberately
 * not in the shared surface: WHICH conversation to show is a product
 * decision, and these two products answer it differently.
 */
const LAST_CHAT_KEY = 'astro.lastChatId';

/**
 * The board's three chips.
 *
 * They are a STAND-IN and nothing more: the engine writes contextual
 * follow-ups for every reply (`widget_action_tiles`) and those render inline
 * in the transcript, through the shared widget path, exactly where the board
 * draws them once you are at the foot of the conversation. Rendering the
 * static three beside the engine's own was the "suggestion is not proper"
 * the owner saw on-device, so the surface shows these only when a settled
 * reply carried none.
 *
 * Copy, so it belongs to the brand — it should become a `copy.*` token in
 * ASTRAL-124's sweep, alongside the hint below.
 */
const FALLBACK_SUGGESTIONS = ['Yes, please', 'Tell me more', 'Another question'];

const WASH_HEIGHT = 132;
/** how far across the header the corner bleed reaches — it must not touch the
 *  wordmark, which is what a full-width wash did */
const WASH_WIDTH = 0.45;

export default function Chat() {
  // Screen 2 (docs/49 ASTRAL-104) opens the chat, renders the engine's
  // `input_request` full-screen, and hands the composed answer here rather
  // than sending it: this screen owns the ONE send path. `chatId` carries the
  // conversation the form already started — without it the answer would land
  // in a NEW chat, where the ask it answers never happened.
  const handoff = useLocalSearchParams<{ chatId?: string; pending?: string }>();
  const [chatId, setChatId] = useState<string | null>(null);
  const [washWidth, setWashWidth] = useState(0);

  const onChatCreated = useCallback((id: string) => {
    setChatId(id);
    // Remembered here rather than on unmount: the app can be killed at any
    // moment, and a chat id written "later" is a transcript that comes back
    // empty. The lifecycle calls this twice for a new chat — once with the
    // optimistic local id, once with the backend's — and the second call is
    // what survives.
    void getPlatform().storage.setItem(LAST_CHAT_KEY, id);
  }, []);

  const { send, cancel, isSending, isCreatingChat } = useSendMessage(chatId, onChatCreated);
  const busy = isSending || isCreatingChat;

  // Asking for the balance triggers the server's one-time welcome grant —
  // without this call a fresh account sits at zero and the first reading is
  // refused (the build-3 defect). The NUMBER lives on the settings screen,
  // where the out-of-credits message points ("Settings → Credits"), because
  // the board's header carries a chevron, the wordmark and the menu and
  // nothing else. The call stays regardless of who displays the result.
  useEffect(() => {
    fetchBalance().catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);

  // ── which conversation are we in? ───────────────────────────────────────
  // Either the one screen 2 started (route param) or the one this device was
  // last in (storage). Both are hydrated from the server through the SAME
  // loader mobile's drawer uses, so a reading resumes identically on both.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    const incoming = handoff.chatId?.trim();
    if (incoming) {
      setChatId(incoming);
      void loadChatIntoStore(incoming).catch((e) =>
        console.warn('[chat] could not load the handed-off reading', String(e?.message ?? e)),
      );
      return;
    }
    // A handoff with no chat id is a NEW conversation; resuming the previous
    // one under it would answer this question inside the last reading.
    if (handoff.pending) return;
    void getPlatform()
      .storage.getItem(LAST_CHAT_KEY)
      .then(async (id) => {
        if (!id) return;
        setChatId(id);
        await loadChatIntoStore(id);
      })
      .catch((e) => {
        // The remembered chat is gone (deleted, or a different account).
        // Forget it rather than showing an empty screen that never fills.
        console.warn('[chat] could not resume the last reading', String(e?.message ?? e));
        void getPlatform().storage.removeItem(LAST_CHAT_KEY);
      });
  }, [handoff.chatId, handoff.pending]);

  // The handed-off turn, sent exactly once — and only once the chat it
  // belongs to has been adopted, because the lifecycle reads the chat id
  // from its argument and would otherwise open a second conversation.
  const sentHandoff = useRef(false);
  useEffect(() => {
    const pending = handoff.pending;
    if (!pending || sentHandoff.current) return;
    const incoming = handoff.chatId?.trim();
    if (incoming && chatId !== incoming) return;
    sentHandoff.current = true;
    void send(pending, []);
  }, [handoff.pending, handoff.chatId, chatId, send]);

  // A widget answer — a chip, a picker, the input widget's typed
  // `input_response` carrier — arrives on the ONE channel the shared surface
  // declares, and goes out through the ONE send path this screen owns. No
  // second send path, and nothing flattened into a sentence for the extractor
  // to re-read (F18).
  useEffect(() => {
    return getPlatform().events.on(CHAT_SEND_EVENT, (payload) => {
      const text = (payload as { text?: string } | undefined)?.text;
      if (typeof text === 'string' && text.trim()) void send(text, []);
    });
  }, [send]);

  // ↻ Retry on an errored reply: resend the last user message. Same
  // behaviour, same channel, same component as mobile — a dropped stream
  // must not mean two different things in two apps (ASTRAL-105).
  useEffect(() => {
    return getPlatform().events.on(CHAT_RETRY_EVENT, () => {
      if (!chatId) return;
      const msgs = useChatStore.getState().chats[chatId]?.messages || [];
      const lastUser = [...msgs].reverse().find((m) => m.sender === 'user');
      if (lastUser) void send(lastUser.message, lastUser.files || []);
    });
  }, [chatId, send]);

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
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

        <ChatSurface
          chatId={chatId}
          theme={astroChatTheme}
          busy={busy}
          onSend={send}
          onStop={cancel}
          renderWidget={(widget, key) => (
            <AstroWidget key={key} widget={widget} theme={astroChatTheme} />
          )}
          dataLanguages={ASTRO_DATA_LANGUAGES}
          fallbackSuggestions={FALLBACK_SUGGESTIONS}
          placeholder={`Message ${tokens.wordmark}...`}
          renderSendIcon={(streaming, color, size) =>
            streaming ? <StopSquare size={size} color={color} /> : <ArrowUp size={size} color={color} />
          }
          empty={
            <View style={s.emptyBody}>
              <Text style={s.hint}>
                Ask anything — start with your birth date, time and place.
              </Text>
            </View>
          }
          pending={<View style={s.emptyBody} />}
        />
      </SafeAreaView>
    </View>
  );
}

const t = tokens;

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
  emptyBody: { flex: 1, padding: t.space(4) },
  hint: { ...t.type.scale.sub, color: t.palette.ink.muted, marginTop: t.space(2) },
});
