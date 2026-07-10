// Slide-in navigation drawer — the Gemini-style panel (user's reference
// screenshot 2026-07-10): New chat · Search chats · Recents · profile
// footer with sign-out. Replaces the pushed /history screen.
//
// Feel: spring slide (reanimated), dimmed backdrop (tap to close),
// swipe-left to dismiss. 84% width with a rounded trailing edge.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchChatList, useChatStore, type ChatListItem } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getToken, signOut } from '@/lib/auth';
import { loadChatIntoStore } from '@/lib/load-chat';
import { useUiStore } from '@/store/ui';
import { useAuth } from '@/hooks/use-auth';

const SPRING = { damping: 24, stiffness: 240, mass: 0.8 };

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatDrawer({
  open,
  width,
  onClose,
}: {
  open: boolean;
  width: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const { user } = useAuth();
  const setCurrentChatId = useUiStore((s) => s.setCurrentChatId);
  const newChat = useUiStore((s) => s.newChat);
  const resetChats = useChatStore((s) => s.reset);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  // ── Animation ────────────────────────────────────────────────────
  const tx = useSharedValue(-width);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    tx.value = withSpring(open ? 0 : -width, SPRING);
    backdrop.value = withTiming(open ? 1 : 0, { duration: 220 });
  }, [open, width, tx, backdrop]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.45,
  }));
  const pointerStyle = useAnimatedStyle(() => ({
    // Keep the overlay untouchable when closed.
    pointerEvents: backdrop.value > 0.02 ? ('auto' as const) : ('none' as const),
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      tx.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX < -width * 0.25 || e.velocityX < -600) {
        tx.value = withSpring(-width, SPRING);
        backdrop.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        tx.value = withSpring(0, SPRING);
      }
    });

  // ── Data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const list = await fetchChatList(token, { page: 1, limit: 50 });
        setChats([...list.filter((c) => c.isFavorite), ...list.filter((c) => !c.isFavorite)]);
      } catch { /* stale list is fine in a drawer */ }
      finally { setLoading(false); }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return chats;
    const q = query.toLowerCase();
    return chats.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [chats, query]);

  const openChat = useCallback(async (chat: ChatListItem) => {
    if (openingId) return;
    setOpeningId(chat.id);
    try {
      await loadChatIntoStore(chat.id);
      setCurrentChatId(chat.id);
      onClose();
    } finally {
      setOpeningId(null);
    }
  }, [openingId, setCurrentChatId, onClose]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    resetChats();
    newChat();
    onClose();
    router.replace('/login');
  }, [resetChats, newChat, onClose, router]);

  const initial = (user?.displayName || user?.email || 'A')[0].toUpperCase();
  const who = user?.isAnonymous ? 'Guest' : (user?.displayName || user?.email || '');

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, pointerStyle]}>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      {/* Panel */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.panel,
            { width, backgroundColor: colors.background, shadowColor: '#000' },
            panelStyle,
          ]}>
          <SafeAreaView style={styles.panelInner} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="title" style={styles.brand}>YourFinAdvisor</ThemedText>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={[styles.closeButton, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="smallBold" style={styles.closeGlyph}>✕</ThemedText>
              </Pressable>
            </View>

            {/* Actions */}
            <Pressable
              onPress={() => { newChat(); onClose(); }}
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors.backgroundElement }]}>
              <ThemedText style={styles.actionIcon}>✎</ThemedText>
              <ThemedText>New chat</ThemedText>
            </Pressable>

            <View style={[styles.searchBox, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText themeColor="textSecondary" style={styles.actionIcon}>⌕</ThemedText>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search chats"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            {/* Recents */}
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Recents
            </ThemedText>
            <View style={styles.list}>
              {loading && chats.length === 0 ? (
                <ActivityIndicator color={colors.textSecondary} style={styles.listSpinner} />
              ) : (
                <FlashList
                  data={filtered}
                  keyExtractor={(c) => c.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => openChat(item)}
                      style={({ pressed }) => [
                        styles.chatRow,
                        pressed && { backgroundColor: colors.backgroundElement },
                      ]}>
                      <View style={styles.chatRowText}>
                        <ThemedText numberOfLines={1}>
                          {item.isFavorite ? '★ ' : ''}{item.title || 'Untitled'}
                        </ThemedText>
                      </View>
                      {openingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {relativeTime(item.updatedAt)}
                        </ThemedText>
                      )}
                    </Pressable>
                  )}
                />
              )}
            </View>

            {/* Profile footer */}
            <View style={[styles.footer, { borderTopColor: colors.backgroundElement }]}>
              <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText type="smallBold">{initial}</ThemedText>
              </View>
              <View style={styles.footerText}>
                <ThemedText type="smallBold" numberOfLines={1}>{who}</ThemedText>
                <Pressable onPress={handleSignOut} hitSlop={6}>
                  <ThemedText type="small" style={styles.signOut}>Sign out</ThemedText>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 16,
  },
  panelInner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  brand: { fontSize: 20, lineHeight: 26 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 13, lineHeight: 16 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    marginHorizontal: Spacing.two,
  },
  actionIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  sectionLabel: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  list: { flex: 1 },
  listSpinner: { marginTop: Spacing.five },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 4,
    borderRadius: 14,
    marginHorizontal: Spacing.two,
  },
  chatRowText: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { flex: 1, gap: 1 },
  signOut: { color: '#e5484d' },
});
