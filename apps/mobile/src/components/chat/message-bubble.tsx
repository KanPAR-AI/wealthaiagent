// Message rendering — ChatGPT-style layout:
//   user      → right-aligned filled bubble, plain text
//   assistant → full-width markdown, no bubble, streaming cursor while live
//
// Widgets stream as contentBlocks between text runs. Interactive widget
// UIs arrive in Phase 4 — until then each renders as a labeled chip so
// the reply's structure stays visible instead of silently dropping data.

import { memo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { ContentBlock, Message } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

function WidgetChip({ type }: { type: string }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const label = type.replace(/^widget_/, '').replace(/_/g, ' ');
  return (
    <View style={[styles.widgetChip, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        ✦ {label} — interactive view coming to mobile soon
      </ThemedText>
    </View>
  );
}

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  if (message.sender === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText>{message.message}</ThemedText>
        </View>
      </View>
    );
  }

  // Assistant. Prefer contentBlocks (streaming order, widget-aware); fall
  // back to the flat message string for history rows that predate blocks.
  const blocks: ContentBlock[] =
    message.contentBlocks?.length
      ? message.contentBlocks
      : message.message
        ? [{ type: 'text', content: message.message }]
        : [];

  const markdownStyles = {
    body: { color: colors.text, fontSize: 16, lineHeight: 24 },
    code_inline: {
      backgroundColor: colors.backgroundElement,
      color: colors.text,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: colors.backgroundElement,
      color: colors.text,
      borderRadius: 8,
      padding: Spacing.three,
      borderWidth: 0,
    },
    fence: {
      backgroundColor: colors.backgroundElement,
      color: colors.text,
      borderRadius: 8,
      padding: Spacing.three,
      borderWidth: 0,
    },
    blockquote: {
      backgroundColor: colors.backgroundElement,
      borderLeftColor: colors.backgroundSelected,
    },
    hr: { backgroundColor: colors.backgroundSelected },
  } as const;

  return (
    <View style={styles.assistantRow}>
      {message.error ? (
        <ThemedText type="small" style={styles.error}>
          {message.error}
        </ThemedText>
      ) : null}
      {blocks.map((block, i) =>
        block.type === 'text' ? (
          <Markdown key={`t${i}`} style={markdownStyles}>
            {/* Streaming cursor on the last text block while live */}
            {message.isStreaming && i === blocks.length - 1
              ? `${block.content}▍`
              : block.content}
          </Markdown>
        ) : (
          <WidgetChip key={`w${i}`} type={block.widget.type} />
        ),
      )}
      {message.isStreaming && blocks.length === 0 && (
        <ThemedText themeColor="textSecondary">▍</ThemedText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    marginVertical: Spacing.two,
  },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  assistantRow: {
    paddingHorizontal: Spacing.four,
    marginVertical: Spacing.two,
  },
  widgetChip: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginVertical: Spacing.two,
    alignSelf: 'flex-start',
  },
  error: { color: '#e5484d', marginBottom: Spacing.one },
});
