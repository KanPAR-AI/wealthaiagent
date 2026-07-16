// Chat screen — Phase 3 vertical slice.
//
// New-chat flow: first send creates the backend session (which persists
// the message), streams the reply over SSE via @wealthai/core, and keeps
// the whole transcript in the SHARED zustand store — the same store, the
// same chat client, and the same backend the web app uses.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlatform, useChatStore, type MessageFile } from '@wealthai/core';

import { BugReportSheet } from '@/components/bug-report-sheet';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatDrawer } from '@/components/drawer/chat-drawer';
import { RETRY_EVENT } from '@/components/chat/message-bubble';
import { QUICK_REPLY_EVENT } from '@/components/chat/widget-view';
import { MessageList } from '@/components/chat/message-list';
import { StatePanel } from '@/components/chat/state-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useSendMessage } from '@/hooks/use-send-message';
import { useUiStore } from '@/store/ui';

const SUGGESTIONS = [
  'Help me plan my finances',
  'Analyze my portfolio performance',
  'Build a 7-day meal plan for me',
  'What are my top holdings?',
];

export default function ChatScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chatId = useUiStore((st) => st.currentChatId);
  const setChatId = useUiStore((st) => st.setCurrentChatId);
  const newChat = useUiStore((st) => st.newChat);
  const { send, cancel, isSending, isCreatingChat } = useSendMessage(chatId, setChatId);
  const selectedAgent = useChatStore((st) => st.selectedAgent);
  // Refetch the debug panel when a turn settles (message added / send finishes).
  const msgCount = useChatStore((st) => (chatId ? st.chats[chatId]?.messages?.length ?? 0 : 0));

  const busy = isSending || isCreatingChat;

  // Report-a-bug: sheet with description + image attachment (library pick
  // or a screenshot of the current screen). The capture happens BEFORE the
  // sheet opens — the user is reporting about what they're looking at, and
  // the sheet itself must never be in the shot.
  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const [bugScreenshot, setBugScreenshot] = useState<string | null>(null);
  const reportBug = async () => {
    let shot: string | null = null;
    try {
      const { captureScreen } = await import('react-native-view-shot');
      shot = await captureScreen({ format: 'jpg', quality: 0.85 });
    } catch (e) {
      // Capture can fail (fresh binary missing the native module, odd GPU
      // states) — the sheet still works, just without the pre-attached shot.
      console.warn('[reportBug] screen capture failed:', e);
    }
    setBugScreenshot(shot);
    setBugSheetOpen(true);
  };

  // Widget quick-replies (action tiles, specialist picker, multi-select)
  // arrive over the platform event bus — the mobile analogue of the web's
  // `chat-quick-reply` CustomEvent.
  useEffect(() => {
    return getPlatform().events.on(QUICK_REPLY_EVENT, (payload) => {
      const text = (payload as any)?.text;
      if (typeof text === 'string' && text.trim()) send(text, []);
    });
  }, [send]);

  // ↻ Retry on an errored reply: resend the last user message (with its
  // attachments) — ChatGPT semantics.
  useEffect(() => {
    return getPlatform().events.on(RETRY_EVENT, () => {
      if (!chatId) return;
      const msgs = useChatStore.getState().chats[chatId]?.messages || [];
      const lastUser = [...msgs].reverse().find((m) => m.sender === 'user');
      if (lastUser) send(lastUser.message, lastUser.files || []);
    });
  }, [chatId, send]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable
            onPress={() => {
              // Dismiss the composer keyboard first — otherwise it stays
              // floating over the drawer when opened from inside a chat.
              Keyboard.dismiss();
              setDrawerOpen(true);
            }}
            hitSlop={12}
            accessibilityLabel="Chat history">
            <ThemedText type="title" style={styles.headerIcon}>☰</ThemedText>
          </Pressable>
          <Pressable
            style={styles.headerCenter}
            onPress={() => router.push('/agents')}
            hitSlop={8}
            accessibilityLabel="Choose agent">
            <ThemedText type="smallBold">YourFinAdvisor</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {selectedAgent ? selectedAgent.replace(/_/g, ' ') : 'Smart routing'} ▾
            </ThemedText>
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              onPress={reportBug}
              hitSlop={10}
              accessibilityLabel="Report a bug">
              <ThemedText type="title" style={styles.headerIcon}>⚑</ThemedText>
            </Pressable>
            <Pressable
              onPress={newChat}
              hitSlop={10}
              accessibilityLabel="New chat">
              <ThemedText type="title" style={styles.headerIcon}>✎</ThemedText>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.body}>
          {/* Always mounted (even with no chatId) so a brand-new chat still
              shows "About you" + the personalization toggle. */}
          <StatePanel chatId={chatId} refreshSignal={msgCount + (busy ? 0 : 1000)} />
          {chatId ? (
            <MessageList chatId={chatId} />
          ) : busy ? (
            // New-chat creation in flight — show immediate feedback instead of
            // the stale suggestions screen (bug e6797e57: looked frozen).
            <View style={[styles.empty, { justifyContent: 'center' }]}>
              <ActivityIndicator color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                Starting your chat…
              </ThemedText>
            </View>
          ) : (
            <View style={styles.empty}>
              <ThemedText type="title" style={styles.emptyTitle}>
                How can I help you today?
              </ThemedText>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    disabled={busy}
                    onPress={() => send(s, [])}
                    style={({ pressed }) => [
                      styles.suggestion,
                      { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText type="small">{s}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <ChatInput onSend={send} onStop={cancel} busy={busy} />
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ChatDrawer
        open={drawerOpen}
        width={Math.min(screenWidth * 0.84, 360)}
        onClose={() => setDrawerOpen(false)}
      />
      <BugReportSheet
        visible={bugSheetOpen}
        onClose={() => setBugSheetOpen(false)}
        screenShotUri={bugScreenshot}
        chatId={chatId}
        selectedAgent={selectedAgent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { alignItems: 'center' },
  headerRight: { flexDirection: 'row', gap: Spacing.three },
  headerIcon: { fontSize: 20, lineHeight: 24 },
  body: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  emptyTitle: { textAlign: 'center' },
  suggestions: { gap: Spacing.two },
  suggestion: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
