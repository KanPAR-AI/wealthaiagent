// Chat screen — Phase 3 vertical slice.
//
// New-chat flow: first send creates the backend session (which persists
// the message), streams the reply over SSE via @wealthai/core, and keeps
// the whole transcript in the SHARED zustand store — the same store, the
// same chat client, and the same backend the web app uses.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlatform, useChatStore, type Widget } from '@wealthai/core';
import {
  BugReportSheet,
  ChatSurface,
  chatMarkdownStyles,
  useSendMessage,
  type ChatTheme,
} from '@wealthai/chat-native';

import { DEFAULT_TILES, getHomeSuggestions, type HomeTile } from '@/services/home-service';
import { track } from '@/lib/analytics';
import { ChatDrawer } from '@/components/drawer/chat-drawer';
import { VideoEmbed } from '@/components/chat/video-embed';
import { WidgetView } from '@/components/chat/widget-view';
import { QUICK_REPLY_EVENT, RETRY_EVENT } from '@/lib/events';
import { splitVideoSegments } from '@/lib/video-links';
import { useChatTheme } from '@/lib/chat-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useUiStore } from '@/store/ui';
import { StandaloneBadge, StandaloneToggle } from '@/components/chat/standalone-toggle';

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
  // (a) this app's values for the shared surface's token contract.
  const chatTheme = useChatTheme();
  // (b) this app's widget set.
  const renderWidget = useCallback(
    (widget: Widget, key: string) => <WidgetView key={key} widget={widget} theme={chatTheme} />,
    [chatTheme],
  );
  // Corpus-media citations become inline players; the markdown link alone
  // would dump the user into a raw browser stream (web parity:
  // response.tsx embedCorpusMediaLinks). apps/astro has no corpus media, so
  // this renderer is this app's and arrives through the seam rather than
  // living in the shared bubble.
  const renderText = useCallback(
    (text: string, key: string, theme: ChatTheme) =>
      splitVideoSegments(text).map((seg, j) =>
        seg.kind === 'video' ? (
          <VideoEmbed key={`${key}v${j}`} segment={seg} />
        ) : (
          <Markdown key={`${key}s${j}`} style={chatMarkdownStyles(theme)}>
            {seg.text}
          </Markdown>
        ),
      ),
    [],
  );
  const selectedAgent = useChatStore((st) => st.selectedAgent);
  const setSelectedAgent = useChatStore((st) => st.setSelectedAgent);
  const modelTier = useChatStore((st) => st.selectedModelTier) || 'auto';
  const standaloneMode = useChatStore((st) => st.standaloneMode);

  // Server-configured suggestion tiles (campaigns). Fetched once on mount;
  // falls back to bundled defaults so the home screen is never blank.
  const [tiles, setTiles] = useState<HomeTile[]>(DEFAULT_TILES);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getHomeSuggestions().then((s) => {
      if (!alive) return;
      if (s.tiles?.length) setTiles(s.tiles);
      setCampaignId(s.campaign_id);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Tapping a tile sends its text. If the tile is locked to an agent, select
  // that agent first so the turn routes there (else smart routing decides).
  const sendTile = (tile: HomeTile) => {
    track('tile_tap', { campaign_id: campaignId || 'default', text: tile.text, agent: tile.agent || 'auto' });
    if (tile.agent) setSelectedAgent(tile.agent);
    send(tile.text, []);
  };
  const creditsUsed = useChatStore((st) => (chatId ? st.creditsConsumed[chatId] ?? 0 : 0));
  // Refetch the debug panel when a turn settles (message added / send finishes).
  const msgCount = useChatStore((st) => (chatId ? st.chats[chatId]?.messages?.length ?? 0 : 0));

  const busy = isSending || isCreatingChat;

  // Report-a-bug: sheet with description + image attachment (library pick
  // or a screenshot of the current screen). The capture happens BEFORE the
  // sheet opens — the user is reporting about what they're looking at, and
  // the sheet itself must never be in the shot.
  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const [bugScreenshot, setBugScreenshot] = useState<string | null>(null);
  const screenRef = useRef<View>(null);
  const reportBug = async () => {
    let shot: string | null = null;
    try {
      const vs = await import('react-native-view-shot');
      // captureRef on the mounted screen view is far more reliable than
      // captureScreen (which flakes on new-arch / static frameworks and was
      // silently returning null → no auto-attached screenshot). Fall back to
      // captureScreen only if the ref capture is unavailable.
      if (screenRef.current && vs.captureRef) {
        shot = await vs.captureRef(screenRef, { format: 'jpg', quality: 0.85 });
      } else if (vs.captureScreen) {
        shot = await vs.captureScreen({ format: 'jpg', quality: 0.85 });
      }
    } catch (e) {
      // Capture can still fail (native module unregistered, odd GPU states) —
      // the sheet works without a pre-attached shot; the user can pick from
      // the library. Surfaced so the on-device console shows the real cause.
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
      <SafeAreaView ref={screenRef} collapsable={false} style={styles.safeArea} edges={['top', 'bottom']}>
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

        {/* Sub-header: model tier picker (left) + subtle credits-used counter (right) */}
        <Pressable
          onPress={() => router.push('/models')}
          style={[styles.subHeader, { borderBottomColor: colors.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            ⚡ {modelTier === 'fast' ? 'Fast' : modelTier === 'deep' ? 'Deep' : 'Auto'} model ▾
          </ThemedText>
          {creditsUsed > 0 && (
            <ThemedText type="small" themeColor="textSecondary">✦ {creditsUsed.toLocaleString()} used</ThemedText>
          )}
        </Pressable>

        <ChatSurface
          chatId={chatId}
          theme={chatTheme}
          busy={busy}
          onSend={send}
          onStop={cancel}
          renderWidget={renderWidget}
          renderText={renderText}
          pending={
            <View style={[styles.empty, { justifyContent: 'center' }]}>
              <ActivityIndicator color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                Starting your chat…
              </ThemedText>
            </View>
          }
          empty={
            <View style={styles.empty}>
              <ThemedText type="title" style={styles.emptyTitle}>
                How can I help you today?
              </ThemedText>
              {/* Offered before the first message: standalone applies at
                  creation only, since a chat switched later would already have
                  been answered from a profile it now promises not to read. */}
              <StandaloneToggle />
              <View style={styles.suggestions}>
                {tiles.map((tile, i) => (
                  <Pressable
                    key={`${tile.text}-${i}`}
                    disabled={busy}
                    onPress={() => sendTile(tile)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText type="small">{tile.text}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          belowTranscript={standaloneMode && msgCount > 0 ? <StandaloneBadge /> : null}
        />
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
        theme={chatTheme}
        brand="YourFinAdvisor"
        context={{ url: 'app://mobile/chat', selected_agent: selectedAgent || undefined }}
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
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 5,
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
