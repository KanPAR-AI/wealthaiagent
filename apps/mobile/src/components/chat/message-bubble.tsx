// Message rendering — ChatGPT-style layout:
//   user      → right-aligned filled bubble, plain text
//   assistant → full-width markdown, no bubble, streaming cursor while live
//
// Widgets stream as contentBlocks between text runs. Interactive widget
// UIs arrive in Phase 4 — until then each renders as a labeled chip so
// the reply's structure stays visible instead of silently dropping data.

import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { ContentBlock, Message } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { WidgetView } from '@/components/chat/widget-view';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';

/** Backend file URLs require a Bearer token — a bare <Image> gets a 401
 *  and renders blank on prod. RN's Image supports per-request headers;
 *  fetch a fresh token per mount (cheap: cached by Firebase). */
function AuthImage({ uri, style }: { uri: string; style: any }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    getToken().then((t) => {
      if (alive) setHeaders(t ? { Authorization: `Bearer ${t}` } : {});
    });
    return () => { alive = false; };
  }, [uri]);
  if (!headers) return <View style={style} />;
  return <Image source={{ uri, headers }} style={style} />;
}


// ```some_widget_type\n{...json...}\n``` → widget block. Anything that
// isn't a JSON object with a fence language stays as text (real code
// blocks render as code).
const FENCE_RE = /```([a-z_][a-z0-9_]*)\s*\n([\s\S]*?)```/g;

function splitFencedWidgets(block: ContentBlock): ContentBlock[] {
  if (block.type !== 'text') return [block];
  const text = block.content;
  const out: ContentBlock[] = [];
  let last = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    const [whole, lang, body] = m;
    const start = m.index ?? 0;
    let widgetData: any = null;
    try {
      const parsed = JSON.parse(body.trim());
      if (parsed && typeof parsed === 'object') widgetData = parsed;
    } catch { /* not JSON — leave the fence as text/code */ }
    if (!widgetData) continue;
    if (start > last) out.push({ type: 'text', content: text.slice(last, start) });
    out.push({ type: 'widget', widget: { ...widgetData, type: widgetData.type || lang } });
    last = start + whole.length;
  }
  if (last === 0) return [block];
  if (last < text.length) out.push({ type: 'text', content: text.slice(last) });
  return out;
}

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  if (message.sender === 'user') {
    const images = (message.files || []).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)($|\?)/i.test(f.url));
    const docs = (message.files || []).filter((f) => !images.includes(f));
    return (
      <View style={styles.userRow}>
        <View style={styles.userStack}>
          {images.map((f, i) => (
            <AuthImage key={`${f.url}-${i}`} uri={f.url} style={styles.userImage} />
          ))}
          {docs.map((f, i) => (
            <View key={`${f.url}-${i}`} style={[styles.userBubble, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="small">📄 {f.name}</ThemedText>
            </View>
          ))}
          {message.message ? (
            <View style={[styles.userBubble, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText>{message.message}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // Assistant. Prefer contentBlocks (streaming order, widget-aware); fall
  // back to the flat message string for history rows that predate blocks.
  const rawBlocks: ContentBlock[] =
    message.contentBlocks?.length
      ? message.contentBlocks
      : message.message
        ? [{ type: 'text', content: message.message }]
        : [];
  // MysticAI (and some other agents) emit widgets as fenced JSON inside
  // the TEXT stream (```palm_analysis {...}```), not as widget_ SSE
  // events — the web parses these fences out of markdown; do the same
  // here so mobile renders widget chips/views instead of raw JSON.
  const blocks = rawBlocks.flatMap(splitFencedWidgets);

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
          <WidgetView key={`w${i}`} widget={block.widget} />
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
  userStack: { maxWidth: '82%', alignItems: 'flex-end', gap: Spacing.one },
  userImage: { width: 180, height: 180, borderRadius: 14 },
  userBubble: {
    maxWidth: '100%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  assistantRow: {
    paddingHorizontal: Spacing.four,
    marginVertical: Spacing.two,
  },
  error: { color: '#e5484d', marginBottom: Spacing.one },
});
