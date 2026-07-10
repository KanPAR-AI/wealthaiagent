// Chat screen — Phase 3 vertical slice.
//
// New-chat flow: first send creates the backend session (which persists
// the message), streams the reply over SSE via @wealthai/core, and keeps
// the whole transcript in the SHARED zustand store — the same store, the
// same chat client, and the same backend the web app uses.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
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
  const chatId = useUiStore((st) => st.currentChatId);
  const setChatId = useUiStore((st) => st.setCurrentChatId);
  const newChat = useUiStore((st) => st.newChat);
  const { send, cancel, isSending, isCreatingChat } = useSendMessage(chatId, setChatId);

  const busy = isSending || isCreatingChat;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable
            onPress={() => router.push('/history')}
            hitSlop={12}
            accessibilityLabel="Chat history">
            <ThemedText type="title" style={styles.headerIcon}>☰</ThemedText>
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText type="smallBold">YourFinAdvisor</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Smart routing
            </ThemedText>
          </View>
          <Pressable
            onPress={newChat}
            hitSlop={12}
            accessibilityLabel="New chat">
            <ThemedText type="title" style={styles.headerIcon}>✎</ThemedText>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.body}>
          {chatId ? (
            <MessageList chatId={chatId} />
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
                    onPress={() => send(s)}
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
