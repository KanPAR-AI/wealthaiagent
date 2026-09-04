// KneeFit's values for the shared chat surface's token contract — the Terra
// direction. Every value is READ from `@/theme`, same discipline as astro's
// chat-theme.ts: the brand swaps a values file, never a screen.

import type { ChatTheme } from '@wealthai/chat-native';

import { tokens as t } from '@/theme';

export const kneeChatTheme: ChatTheme = {
  colors: {
    background: t.palette.paper.base,
    surface: t.palette.paper.card,
    surfaceStrong: t.palette.paper.line,
    line: t.palette.paper.line,
    text: t.palette.ink.primary,
    textMuted: t.palette.ink.muted,
    link: t.palette.accent.interactive,
    danger: t.palette.danger,
    // The design's deep-pine user bubble with bone text (Chat board).
    userBubble: t.palette.accent.interactive,
    userBubbleText: t.palette.accent.interactiveInk,
    primary: t.palette.accent.interactive,
    onPrimary: t.palette.accent.interactiveInk,
    sendDisabled: t.palette.accent.interactive,
    accent: t.palette.accent.interactive,
  },
  type: {
    title: { ...t.type.scale.heading },
    body: { ...t.type.scale.body },
    bubble: { ...t.type.scale.body },
    small: { ...t.type.scale.sub },
    smallBold: { ...t.type.scale.sub, fontWeight: '700' },
    input: { ...t.type.scale.body },
  },
  radius: {
    bubble: 18,
    tail: t.radius.tail,
    card: t.radius.card,
    input: t.radius.input,
    chip: t.radius.chip,
  },
  metrics: {
    rowPaddingX: t.space(5),
    rowGapY: t.space(2),
    bubblePaddingX: t.space(4),
    bubblePaddingY: t.space(3),
    composerPaddingX: t.space(4),
    composerPaddingY: t.space(2),
    fieldPaddingY: t.space(1.5),
    // No attach button in front of the text (xrayUpload is false), so the
    // field carries its own start padding — same reasoning as astro's.
    fieldPaddingStart: t.space(4),
    sendSize: t.size.disc,
    sendDisabledOpacity: 0.35,
    maxInputHeight: t.space(30),
    widgetGap: t.space(2),
    // The design floats coach replies on white cards over the bone ground
    // (Chat board) — same board decision astro made.
    assistantCard: true,
    composerBarBorderTop: false,
    composerFieldBorder: true,
  },
  cardElevation: t.elevation.card,
};
