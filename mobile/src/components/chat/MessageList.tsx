import React, { useRef, useEffect } from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { ChatMessage } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, fontSize } from '../../theme';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const colors = useThemeColors();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.chatBg }]}>
        <View style={styles.emptyContent}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            WealthWise AI
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Your personal financial advisor.{'\n'}Ask me anything about investments,{'\n'}savings, or financial planning.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      style={[styles.list, { backgroundColor: colors.chatBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
