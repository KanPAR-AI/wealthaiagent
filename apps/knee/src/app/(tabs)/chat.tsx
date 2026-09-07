// The Coach tab — the yourfinadvisor chat wearing this brand, exactly the
// astro arrangement (its chat.tsx documents the lifecycle in detail): the
// conversation is `<ChatSurface>` from `@wealthai/chat-native`; this file is
// the chrome, the resume logic, and the ONE send path.

import { useFocusEffect } from 'expo-router';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CHAT_RETRY_EVENT,
  CHAT_SEND_EVENT,
  ChatSurface,
  loadChatIntoStore,
  useSendMessage,
} from '@wealthai/chat-native';
import { getPlatform, useChatStore } from '@wealthai/core';

import { fetchBalance } from '@/lib/api';
import { forgetChat, lastChatId, rememberChat, takePendingCoachPrompt } from '@/lib/chat-session';
import { kneeChatTheme } from '@/lib/chat-theme';
import { tokens } from '@/theme';

/** Stand-ins only when a settled reply carried no follow-ups of its own —
 *  the astro rule. Copy from the design's Chat board chips. */
const FALLBACK_SUGGESTIONS = ['Why glutes first?', 'Do supplements help?', 'Tell me more'];

function ArrowUp({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StopSquare({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect x={5} y={5} width={10} height={10} rx={2} fill={color} />
    </Svg>
  );
}

export default function Chat() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));

  const [chatId, setChatId] = useState<string | null>(null);
  const onChatCreated = useCallback((id: string) => setChatId(id), []);

  useEffect(() => {
    if (chatId) rememberChat(chatId);
  }, [chatId]);

  const { send, cancel, isSending, isCreatingChat } = useSendMessage(chatId, onChatCreated);

  // Trigger the one-time welcome grant on first entry to the coach — without
  // this a fresh anonymous account that opens Coach before Profile sits at
  // ZERO credits and the first turn is refused, which renders as "Couldn't
  // get a response" (owner-reported 2026-09-06; the astro build-3 defect).
  useEffect(() => {
    fetchBalance().catch((e) => console.warn('[credits]', String(e?.message ?? e)));
  }, []);
  const busy = isSending || isCreatingChat;

  // Resume the device's last conversation — hydrated from the server through
  // the same loader mobile's drawer uses.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    void lastChatId()
      .then(async (id) => {
        if (!id) return;
        // Load FIRST, adopt only if it loads. The stored id can belong to a
        // PRIOR account (the anonymous uid changes on sign-in/out) and now
        // 404s — adopting it before the load check left the dead id as the
        // active chat, so every send POSTed to a missing chat and returned
        // "Couldn't get a response" (owner-reported 2026-09-06, seen as
        // repeated 404s on /chats/{stale} in the logs).
        await loadChatIntoStore(id);
        setChatId(id);
      })
      .catch((e) => {
        console.warn('[chat] could not resume — starting fresh', String(e?.message ?? e));
        forgetChat();
        setChatId(null); // fall back to a NEW chat on the next send
      });
  }, []);

  // Widget answers arrive on the one declared channel and leave through the
  // one send path this screen owns.
  useEffect(() => {
    return getPlatform().events.on(CHAT_SEND_EVENT, (payload) => {
      const text = (payload as { text?: string } | undefined)?.text;
      if (typeof text === 'string' && text.trim()) void send(text, []);
    });
  }, [send]);

  // A screen handed the coach a context question ("ask the coach" from a
  // session or a phase). Send it once, on focus, through the same one send
  // path — so the coach opens already asking, with the screen's context. Read
  // clears it, so returning to the tab later never re-sends.
  useFocusEffect(useCallback(() => {
    const pending = takePendingCoachPrompt();
    if (pending) void send(pending, []);
  }, [send]));

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
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={s.headerTitle}>Knee coach</Text>
            <Text style={s.headerSub}>Knows your phase and your program</Text>
          </View>
          {/* New conversation. The tab deliberately resumes ONE running
              thread (the astro ritual); this is the owner-asked escape hatch
              (2026-09-05): clear the adopted id and forget the stored one,
              and the next send opens a fresh chat. The old conversation is
              not deleted — it stays on the server like every chat. */}
          <Pressable
            onPress={() => {
              forgetChat();
              setChatId(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="New conversation"
            hitSlop={8}
            style={s.newChat}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 20h8M16.5 3.9a2.1 2.1 0 0 1 3 3L8 18.4l-4 1 1-4L16.5 3.9Z"
                stroke={t.palette.ink.primary} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>
        <ChatSurface
          chatId={chatId}
          theme={kneeChatTheme}
          busy={busy}
          onSend={send}
          onStop={cancel}
          fallbackSuggestions={FALLBACK_SUGGESTIONS}
          placeholder="Ask about your knee…"
          renderSendIcon={(streaming, color, size) =>
            streaming ? <StopSquare size={size} color={color} /> : <ArrowUp size={size} color={color} />
          }
          empty={
            <View style={s.emptyBody}>
              <Text style={s.hint}>
                Ask about an exercise, a pain, or the program — the coach knows
                the videos and can open them at the exact moment.
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
    paddingHorizontal: t.space(6),
    paddingVertical: t.space(3),
    borderBottomWidth: 1,
    borderBottomColor: t.palette.paper.line,
  },
  headerText: { flex: 1, gap: 1 },
  newChat: {
    width: t.size.disc,
    height: t.size.disc,
    borderRadius: t.size.disc / 2,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    backgroundColor: t.palette.paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...t.type.scale.heading, ...t.type.display, color: t.palette.ink.primary },
  headerSub: { ...t.type.scale.sub, color: t.palette.ink.muted },
  emptyBody: { flex: 1, padding: t.space(4) },
  hint: { ...t.type.scale.sub, color: t.palette.ink.muted, marginTop: t.space(2) },
});
