// Chat history — list past conversations, tap to resume.
//
// Pushed over the chat screen (ChatGPT pattern: history behind a header
// button, chat itself stays full-bleed). Favorites float to the top,
// mirroring the web sidebar's ordering.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchChatList, type ChatListItem } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';
import { loadChatIntoStore } from '@/lib/load-chat';
import { useUiStore } from '@/store/ui';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const setCurrentChatId = useUiStore((s) => s.setCurrentChatId);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not signed in');
        const list = await fetchChatList(token, { page: 1, limit: 50 });
        // Favorites first, then recency (web sidebar ordering).
        setChats([
          ...list.filter((c) => c.isFavorite),
          ...list.filter((c) => !c.isFavorite),
        ]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load chats');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openChat = useCallback(
    async (chat: ChatListItem) => {
      if (openingId) return;
      setOpeningId(chat.id);
      try {
        await loadChatIntoStore(chat.id);
        setCurrentChatId(chat.id);
        router.back();
      } catch (e: any) {
        setError(e?.message || 'Failed to open chat');
        setOpeningId(null);
      }
    },
    [openingId, router, setCurrentChatId],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link">‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Chats</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ThemedText type="small" style={{ color: '#e5484d' }}>{error}</ThemedText>
          </View>
        ) : chats.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">No conversations yet</ThemedText>
          </View>
        ) : (
          <FlashList
            data={chats}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openChat(item)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.backgroundElement },
                  pressed && { backgroundColor: colors.backgroundElement },
                ]}>
                <View style={styles.rowText}>
                  <ThemedText numberOfLines={1}>
                    {item.isFavorite ? '★ ' : ''}{item.title || 'Untitled chat'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {relativeTime(item.updatedAt)}
                    {item.lastAgentType ? ` · ${item.lastAgentType.replace(/_/g, ' ')}` : ''}
                  </ThemedText>
                </View>
                {openingId === item.id && (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                )}
              </Pressable>
            )}
          />
        )}
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
  headerSpacer: { width: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  rowText: { flex: 1, gap: 2 },
});
