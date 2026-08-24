// This brand's values for the shared chat surface's token contract
// (docs/49 ASTRAL-105, allowance (a); AMB-20(a)).
//
// Every value is READ from `@/theme` — the brand token module — so the second
// brand swaps a values file rather than rewriting a screen, and so the
// ASTRAL-97 greps that forbid a colour, a size or a radius in an app file
// keep meaning something. Nothing here follows the phone's colour scheme:
// AMB-22(a) ruled the split is by ROLE, and a chat is a WORKING surface, so
// it is the paper ground in both system appearances (ASTRAL-124).

import type { ChatTheme } from '@wealthai/chat-native';

import { tokens as t } from '@/theme';

export const astroChatTheme: ChatTheme = {
  colors: {
    background: t.palette.paper.base,
    surface: t.palette.paper.card,
    surfaceStrong: t.palette.paper.base,
    line: t.palette.paper.line,
    text: t.palette.ink.primary,
    textMuted: t.palette.ink.muted,
    link: t.palette.accent.interactive,
    danger: t.palette.danger,
    // The board's violet bubble, and white words inside it.
    userBubble: t.palette.accent.interactive,
    userBubbleText: t.palette.accent.interactiveInk,
    primary: t.palette.accent.interactive,
    onPrimary: t.palette.accent.interactiveInk,
    // The disc keeps its violet and fades, rather than turning grey — the
    // board draws one send disc, not two.
    sendDisabled: t.palette.accent.interactive,
    accent: t.palette.accent.interactive,
  },
  type: {
    title: { ...t.type.scale.title },
    body: { ...t.type.scale.body },
    bubble: { ...t.type.scale.body },
    small: { ...t.type.scale.sub },
    smallBold: { ...t.type.scale.sub, fontWeight: '700' },
    input: { ...t.type.scale.body },
  },
  radius: {
    bubble: t.radius.card,
    tail: t.radius.tail,
    card: t.radius.card,
    input: t.radius.input,
    chip: t.radius.chip,
  },
  metrics: {
    rowPaddingX: t.space(4),
    rowGapY: t.space(1.5),
    bubblePaddingX: t.space(4),
    bubblePaddingY: t.space(3),
    composerPaddingX: t.space(4),
    composerPaddingY: t.space(2),
    fieldPaddingY: t.space(1.5),
    // Wider than mobile's, because there is no attach button in front of
    // the text — see the composer's capability note.
    fieldPaddingStart: t.space(4),
    sendSize: t.size.disc,
    // The one number here that is not a token: the board fades the disc
    // rather than re-colouring it, and an opacity is not part of the brand
    // contract (`theme/contract.ts` is owned by ASTRAL-97 and out of this
    // slice's scope). It is the value that shipped in build 7.
    sendDisabledOpacity: 0.35,
    maxInputHeight: t.space(30),
    widgetGap: t.space(2),
    // The board floats the reply on a light card (frame 04); ChatGPT and
    // apps/mobile run it full width. Both are drawn designs, so it is a token.
    assistantCard: true,
    composerBarBorderTop: false,
    composerFieldBorder: true,
  },
  cardElevation: t.elevation.card,
};
