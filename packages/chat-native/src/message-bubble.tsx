// The ONE message bubble (docs/49 ASTRAL-105, amended 2026-08-24).
//
// Moved out of `apps/mobile/src/components/chat/message-bubble.tsx`. Layout,
// ChatGPT-style:
//   user      → right-aligned filled bubble, plain text
//   assistant → markdown, streaming cursor while live, full-width or on a
//               floating card depending on the brand (`assistantCard`)
//
// Widgets stream as contentBlocks between text runs, and fenced data blocks
// in the TEXT stream are split out into widgets here. WHICH widgets exist is
// the host's business — allowance (b) — so dispatch arrives as a prop; the
// SPLIT does not, because two clients deciding differently what counts as a
// data fence is how one of them ends up showing raw JSON.

import { memo, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { splitDataBlocks, stripInputResponse } from '@wealthai/astral';
import { getPlatform, type ContentBlock, type Message, type Widget } from '@wealthai/core';

import { CHAT_RETRY_EVENT, getChatHost } from './host';
import type { ChatTheme } from './theme';

/** Backend file URLs require a Bearer token — a bare <Image> gets a 401
 *  and renders blank on prod. RN's Image supports per-request headers;
 *  fetch a fresh token per mount (cheap: cached by Firebase). */
function AuthImage({ uri, style, onError }: { uri: string; style: any; onError?: () => void }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    getChatHost()
      .getToken()
      .then((t) => {
        if (alive) setHeaders(t ? { Authorization: `Bearer ${t}` } : {});
      });
    return () => { alive = false; };
  }, [uri]);
  if (!headers) return <View style={style} />;
  return <Image source={{ uri, headers }} style={style} onError={onError} />;
}

// ```some_widget_type\n{...json...}\n``` → widget block.
//
// "Is this fence data?" is decided by `splitDataBlocks` from @wealthai/astral
// — the SAME rule web uses (docs/49 ASTRAL-20): the fence language must equal
// the JSON body's own `type` field, which is the backend's convention for
// every data block it emits (natal_chart, match_report, muhurta_results,
// palm_*, bedtime_video — all verified against the emitters). An ordinary
// ```json fence therefore stays text and renders as code.
//
// `dataLanguages` is the surface's own block set (allowance (b)) and it is
// OPTIONAL because it changes streaming behaviour: given a list, a TRAILING
// half-written fence is withheld until it closes, so the seconds between
// "```natal_chart" and its closing fence are not seconds of raw JSON
// scrolling past. `apps/mobile` passes none, which is exactly the behaviour
// that shipped.
function splitFencedWidgets(block: ContentBlock, dataLanguages?: string[]): ContentBlock[] {
  if (block.type !== 'text') return [block];
  const segments = splitDataBlocks(block.content, dataLanguages);
  if (!segments.some((s) => s.kind === 'block')) return [block];
  return segments.map((s) =>
    s.kind === 'block'
      ? ({ type: 'widget', widget: s.value as any } as ContentBlock)
      : ({ type: 'text', content: s.text } as ContentBlock),
  );
}

/** The markdown element styles, composed from the theme's own steps so a
 *  brand cannot end up with a body size its reply headings disagree with. */
export function chatMarkdownStyles(theme: ChatTheme) {
  const { colors, type } = theme;
  return {
    body: { ...(type.body as TextStyle), color: colors.text },
    link: { color: colors.link, textDecorationLine: 'underline' as const },
    strong: { fontWeight: '700' as const },
    code_inline: {
      backgroundColor: colors.surfaceStrong,
      color: colors.text,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: colors.surfaceStrong,
      color: colors.text,
      borderRadius: 8,
      padding: theme.metrics.bubblePaddingX,
      borderWidth: 0,
    },
    fence: {
      backgroundColor: colors.surfaceStrong,
      color: colors.text,
      borderRadius: 8,
      padding: theme.metrics.bubblePaddingX,
      borderWidth: 0,
    },
    blockquote: {
      backgroundColor: colors.surfaceStrong,
      borderLeftColor: colors.line,
    },
    hr: { backgroundColor: colors.line },
  } as const;
}

export interface MessageBubbleProps {
  message: Message;
  theme: ChatTheme;
  /** (b) the surface's widget set. A host that renders none passes nothing
   *  and gets text only — visibly less, never a silent drop. */
  renderWidget?: (widget: Widget, key: string) => ReactNode;
  /** (b) the data-fence languages this surface draws; see the note above. */
  dataLanguages?: string[];
  /** Optional per-text-run renderer, for a surface that embeds something
   *  inside prose. `apps/mobile` turns corpus-media citations into inline
   *  players here (web parity: response.tsx embedCorpusMediaLinks); a host
   *  that passes nothing gets plain markdown. */
  renderText?: (text: string, key: string, theme: ChatTheme) => ReactNode;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  theme,
  renderWidget,
  dataLanguages,
  renderText,
}: MessageBubbleProps) {
  const { metrics } = theme;
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const markImageFailed = (url: string) =>
    setFailedImages((prev) => new Set(prev).add(url));

  const styles = stylesFor(theme);

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
            <View key={`${f.url}-${i}`} style={styles.userBubble}>
              <ChatText theme={theme} step="small" tone="onUserBubble">📄 {f.name}</ChatText>
            </View>
          ))}
          {stripInputResponse(message.message) ? (
            <View style={styles.userBubble}>
              {/* selectable → native long-press "Copy" menu. RN Text isn't
                  copyable by default, so users couldn't copy what they sent
                  (bug 522f3a6e).

                  `stripInputResponse` is AMB-17 (a)'s declared cost: a widget
                  answer travels as a fenced `input_response` block inside the
                  user's own message, so the raw fence is suppressed here the
                  same way data fences already are on an assistant bubble. The
                  ASTRAL-89 echo is what remains. */}
              <ChatText theme={theme} step="bubble" tone="onUserBubble" selectable>
                {stripInputResponse(message.message)}
              </ChatText>
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
  // here so a computed chart renders as a chart rather than as a
  // screenful of raw JSON.
  const blocks = rawBlocks.flatMap((b) => splitFencedWidgets(b, dataLanguages));

  const markdownStyles = chatMarkdownStyles(theme);

  return (
    <View style={styles.assistantRow}>
      {message.error ? (
        <Pressable
          onPress={() => getPlatform().events.emit(CHAT_RETRY_EVENT, {})}
          style={styles.errorRow}
          accessibilityLabel="Retry">
          <ChatText theme={theme} step="small" tone="danger">{message.error}</ChatText>
          <ChatText theme={theme} step="smallBold" tone="danger" style={styles.retry}>↻ Retry</ChatText>
        </Pressable>
      ) : null}
      {blocks.map((block, i) => {
        if (block.type !== 'text') {
          // A surface with no renderer for this block draws nothing — and
          // says so, because dropping a block is indistinguishable from
          // never receiving one (ASTRAL-20). The registries themselves live
          // in the apps; what is shared is that the dispatch happens.
          return renderWidget ? renderWidget(block.widget, `w${i}`) : null;
        }
        // Streaming cursor on the last text block while live
        const text =
          message.isStreaming && i === blocks.length - 1
            ? `${block.content}▍`
            : block.content;
        const body = renderText ? (
          renderText(text, `t${i}`, theme)
        ) : (
          <Markdown key={`t${i}`} style={markdownStyles}>{text}</Markdown>
        );
        return metrics.assistantCard && text.trim() ? (
          // The board floats the reply on a card; ChatGPT (and apps/mobile)
          // runs it full width. Widgets stay OUTSIDE the card on purpose: a
          // wheel and a scorecard draw their own surface, and nesting them
          // gives the artifact two borders and less width than it was told
          // it had.
          <View key={`c${i}`} style={styles.replyCard}>{body}</View>
        ) : (
          <View key={`c${i}`}>{body}</View>
        );
      })}
      {message.isStreaming && blocks.length === 0 && (
        <ChatText theme={theme} step="body" tone="muted">▍</ChatText>
      )}
    </View>
  );
});

/** The one text primitive these components use: a step from the theme, a
 *  tone from the theme, and nothing stated at the call site. */
export function ChatText({
  theme,
  step = 'body',
  tone = 'default',
  style,
  ...rest
}: {
  theme: ChatTheme;
  step?: 'title' | 'body' | 'bubble' | 'small' | 'smallBold';
  tone?: 'default' | 'muted' | 'danger' | 'accent' | 'onUserBubble' | 'onPrimary';
  style?: any;
  selectable?: boolean;
  numberOfLines?: number;
  children?: ReactNode;
}) {
  const { colors } = theme;
  const color =
    tone === 'muted' ? colors.textMuted
    : tone === 'danger' ? colors.danger
    : tone === 'accent' ? colors.accent
    : tone === 'onUserBubble' ? colors.userBubbleText
    : tone === 'onPrimary' ? colors.onPrimary
    : colors.text;
  return <Text style={[theme.type[step] as TextStyle, { color }, style]} {...rest} />;
}

function stylesFor(theme: ChatTheme) {
  const { colors, metrics, radius } = theme;
  return StyleSheet.create({
    userRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: metrics.rowPaddingX,
      marginVertical: metrics.rowGapY,
    },
    userStack: { maxWidth: '82%', alignItems: 'flex-end', gap: 4 },
    userImage: { width: 180, height: 180, borderRadius: 14 },
    userBubble: {
      maxWidth: '100%',
      backgroundColor: colors.userBubble,
      borderRadius: radius.bubble,
      borderBottomRightRadius: radius.tail,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.bubblePaddingY,
    },
    assistantRow: {
      paddingHorizontal: metrics.rowPaddingX,
      marginVertical: metrics.rowGapY,
    },
    replyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingTop: metrics.bubblePaddingX,
      paddingBottom: 4,
      shadowColor: theme.cardElevation?.color,
      shadowOpacity: theme.cardElevation?.opacity ?? 0,
      shadowRadius: theme.cardElevation?.radius ?? 0,
      shadowOffset: { width: 0, height: theme.cardElevation?.offsetY ?? 0 },
      elevation: theme.cardElevation ? 3 : 0,
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    retry: { textDecorationLine: 'underline' },
  });
}
