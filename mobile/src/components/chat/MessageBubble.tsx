import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { borderRadius, fontSize, spacing } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useThemeColors();
  const isUser = message.role === 'user';

  const bubbleStyle = isUser
    ? { backgroundColor: colors.outgoingBubble, alignSelf: 'flex-end' as const }
    : { backgroundColor: colors.incomingBubble, alignSelf: 'flex-start' as const };

  const textColor = isUser ? colors.outgoingText : colors.incomingText;

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, bubbleStyle]}>
        {/* File attachments */}
        {message.files && message.files.length > 0 && (
          <View style={styles.files}>
            {message.files.map((file, idx) => (
              <View key={idx} style={[styles.fileChip, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="document-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.fileName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {file.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Message content */}
        <Text style={[styles.text, { color: textColor }]}>
          {message.content}
          {message.isStreaming && <Text style={styles.cursor}>|</Text>}
        </Text>

        {/* Timestamp */}
        <View style={styles.meta}>
          <Text style={[styles.time, { color: isUser ? colors.textMuted : colors.textMuted }]}>
            {time}
          </Text>
          {isUser && (
            <Ionicons
              name="checkmark-done"
              size={14}
              color={colors.textMuted}
              style={styles.check}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs / 2,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    minWidth: 80,
  },
  text: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  cursor: {
    color: '#25D366',
    fontWeight: 'bold',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs / 2,
    gap: 2,
  },
  time: {
    fontSize: fontSize.xs,
  },
  check: {
    marginLeft: 2,
  },
  files: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  fileName: {
    fontSize: fontSize.xs,
    maxWidth: 120,
  },
});
