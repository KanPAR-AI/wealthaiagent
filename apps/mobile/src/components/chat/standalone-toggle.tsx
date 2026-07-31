import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useChatStore } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Standalone chat — sealed off from user memory.
 *
 * Deliberately NOT called "temporary" or "incognito". The chat is saved,
 * appears in history and reopens later; only the memory link is cut. A name
 * implying deletion would mislead someone into saying things they otherwise
 * would not.
 *
 * The wording promises exactly what the backend enforces. "Won't use or update
 * what we know about you" is true; "private" or "not saved" would not be.
 */
export function StandaloneToggle() {
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const standaloneMode = useChatStore((s) => s.standaloneMode);
  const setStandaloneMode = useChatStore((s) => s.setStandaloneMode);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: standaloneMode }}
      accessibilityLabel="Standalone chat — won't use or update what we know about you"
      onPress={() => setStandaloneMode(!standaloneMode)}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: standaloneMode ? '#D97706' : colors.backgroundSelected,
          backgroundColor: standaloneMode ? 'rgba(217,119,6,0.14)' : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText
        type="small"
        style={{ color: standaloneMode ? '#B45309' : colors.textSecondary }}>
        {standaloneMode ? '● Standalone chat on' : 'Standalone chat'}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Shown inside a standalone chat, for as long as it is open.
 *
 * Load-bearing on mobile especially: these chats appear in history like any
 * other, so unlike a temporary or incognito chat there is no absence-from-the-
 * list to signal that this one is different. Without this the user has no way
 * to tell which mode they are in, and a mode you cannot identify is a mode you
 * cannot rely on.
 */
export function StandaloneBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(217,119,6,0.14)' }]}>
      <ThemedText type="small" style={{ color: '#B45309' }}>
        Standalone — not using or updating your memory
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.three,
  },
  badge: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.two,
  },
});
