// Message rendering — ChatGPT-style layout:
//   user      → right-aligned filled bubble, plain text
//   assistant → full-width markdown, no bubble, streaming cursor while live
//
// Widgets stream as contentBlocks between text runs, and fenced data blocks
// in the TEXT stream are split out into widgets here. `widget-view.tsx`
// dispatches them through a registry (docs/49 ASTRAL-20): a registered type
// renders its view, a declared not-yet-built type renders a labelled chip, and
// anything else renders nothing and warns once by name.

import { memo, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { readDataBlock } from '@wealthai/astral';
import type { ContentBlock, Message } from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { VideoEmbed } from '@/components/chat/video-embed';
import { WidgetView } from '@/components/chat/widget-view';
import { splitVideoSegments } from '@/lib/video-links';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';
import { getPlatform } from '@wealthai/core';
import { RETRY_EVENT } from '@/lib/events';

export { RETRY_EVENT } from '@/lib/events';

/** Backend file URLs require a Bearer token — a bare <Image> gets a 401
 *  and renders blank on prod. RN's Image supports per-request headers;
 *  fetch a fresh token per mount (cheap: cached by Firebase). */
function AuthImage({ uri, style, onError }: { uri: string; style: any; onError?: () => void }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    getToken().then((t) => {
      if (alive) setHeaders(t ? { Authorization: `Bearer ${t}` } : {});
    });
    return () => { alive = false; };
  }, [uri]);
  if (!headers) return <View style={style} />;
  return <Image source={{ uri, headers }} style={style} onError={onError} />;
}


// ```some_widget_type\n{...json...}\n``` → widget block.
//
// "Is this fence data?" is decided by `readDataBlock` from @wealthai/astral,
// the SAME rule web uses (docs/49 ASTRAL-20): the fence language must equal
// the JSON body's own `type` field, which is the backend's convention for
// every data block it emits (natal_chart, match_report, muhurta_results,
// palm_*, bedtime_video — all verified against the emitters).
//
// Sharing the rule fixes a small mobile-only wart: previously ANY fenced JSON
// object became a widget, so an ordinary ```json fence turned into a
// "json — interactive view coming to mobile soon" chip instead of rendering
// as code the way it does on web. Now it stays text.
const FENCE_RE = /```([a-z_][a-z0-9_]*)\s*\n([\s\S]*?)```/g;

function splitFencedWidgets(block: ContentBlock): ContentBlock[] {
  if (block.type !== 'text') return [block];
  const text = block.content;
  const out: ContentBlock[] = [];
  let last = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    const [whole, lang, body] = m;
    const start = m.index ?? 0;
    const data = readDataBlock(lang, body.trim());
    if (!data) continue;
    if (start > last) out.push({ type: 'text', content: text.slice(last, start) });
    out.push({ type: 'widget', widget: data.value as any });
    last = start + whole.length;
  }
  if (last === 0) return [block];
  if (last < text.length) out.push({ type: 'text', content: text.slice(last) });
  return out;
}

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const markImageFailed = (url: string) =>
    setFailedImages((prev) => new Set(prev).add(url));

  if (message.sender === 'user') {
    // History attachments arrive as bare /files/<id>/download URLs — no
    // mime, no extension (web solves this by sniffing the blob's magic
    // bytes). Render those optimistically as images and demote any that
    // fail to load to a doc chip.
    const isImage = (f: { type: string; url: string }) =>
      f.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|heic)($|\?)/i.test(f.url) ||
      (!f.type && /\/files\/[^/]+\/download/.test(f.url) && !failedImages.has(f.url));
    const images = (message.files || []).filter(isImage);
    const docs = (message.files || []).filter((f) => !images.includes(f));
    return (
      <View style={styles.userRow}>
        <View style={styles.userStack}>
          {images.map((f, i) => (
            <AuthImage
              key={`${f.url}-${i}`}
              uri={f.url}
              style={styles.userImage}
              onError={() => markImageFailed(f.url)}
            />
          ))}
          {docs.map((f, i) => (
            <View key={`${f.url}-${i}`} style={[styles.userBubble, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="small">📄 {f.name}</ThemedText>
            </View>
          ))}
          {message.message ? (
            <View style={[styles.userBubble, { backgroundColor: colors.backgroundElement }]}>
              {/* selectable → native long-press "Copy" menu. RN Text isn't
                  copyable by default, so users couldn't copy what they sent
                  (bug 522f3a6e). */}
              <ThemedText selectable>{message.message}</ThemedText>
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
    // Links inherited `body` colour with no underline, so an agent reply like
    // "[Download the unlocked PDF](…)" rendered as plain text indistinguishable
    // from the sentence around it — tappable, but with nothing to say so. That
    // is half of "cant see the unlocked pdf": the link was invisible AS a link.
    // iOS system blue reads on both the light and dark backgrounds this theme
    // uses (#ffffff / #000000).
    link: { color: '#0A84FF', textDecorationLine: 'underline' as const },
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
        <Pressable
          onPress={() => getPlatform().events.emit(RETRY_EVENT, {})}
          style={styles.errorRow}
          accessibilityLabel="Retry">
          <ThemedText type="small" style={styles.error}>
            {message.error}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.retry}>↻ Retry</ThemedText>
        </Pressable>
      ) : null}
      {blocks.map((block, i) => {
        if (block.type !== 'text') {
          return <WidgetView key={`w${i}`} widget={block.widget} />;
        }
        // Streaming cursor on the last text block while live
        const text =
          message.isStreaming && i === blocks.length - 1
            ? `${block.content}▍`
            : block.content;
        // Corpus-media citations become inline players; the markdown link
        // alone would dump the user into a raw browser stream (web parity:
        // response.tsx embedCorpusMediaLinks).
        return splitVideoSegments(text).map((seg, j) =>
          seg.kind === 'video' ? (
            <VideoEmbed key={`t${i}v${j}`} segment={seg} />
          ) : (
            <Markdown key={`t${i}s${j}`} style={markdownStyles}>
              {seg.text}
            </Markdown>
          ),
        );
      })}
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
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  error: { color: '#e5484d' },
  retry: { color: '#e5484d', textDecorationLine: 'underline' },
});
