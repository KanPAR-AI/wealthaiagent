// This app's values for the shared chat surface's token contract
// (docs/49 ASTRAL-105, allowance (a)).
//
// Every number here is the one already on TestFlight — the move must not
// re-space or re-weight a live app by a pixel. Where the shared contract has
// one token and this app had two different values (prose at weight 400, the
// user's own words at 500), the contract kept both rather than picking one.
//
// This is also the ONE place this app follows the phone's colour scheme. The
// shared components never call `useColorScheme`: a surface that follows the
// OS without anybody choosing it is how apps/astro's chart wheel flipped to
// a palette the board never drew (docs/49 ASTRAL-124, F34).

import { useColorScheme } from 'react-native';
import type { ChatTheme } from '@wealthai/chat-native';

import { Colors, Spacing } from '@/constants/theme';

export function useChatTheme(): ChatTheme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  return {
    colors: {
      background: c.background,
      surface: c.backgroundElement,
      surfaceStrong: c.backgroundSelected,
      line: c.backgroundElement,
      text: c.text,
      textMuted: c.textSecondary,
      // iOS system blue reads on both grounds this theme uses (#ffffff /
      // #000000). Links inherited the body colour with no underline, so
      // "[Download the unlocked PDF](…)" rendered as plain prose — tappable,
      // with nothing to say so.
      link: '#0A84FF',
      danger: '#e5484d',
      userBubble: c.backgroundElement,
      userBubbleText: c.text,
      primary: c.text,
      onPrimary: c.background,
      sendDisabled: c.backgroundSelected,
      accent: c.textSecondary,
    },
    type: {
      // ThemedText's `subtitle`, which is what the bug sheet's heading was.
      title: { fontSize: 32, lineHeight: 44, fontWeight: '600' },
      body: { fontSize: 16, lineHeight: 24 },
      bubble: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
      small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
      smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
      input: { fontSize: 16, lineHeight: 22 },
    },
    radius: { bubble: 20, tail: 6, card: 16, input: 24, chip: 14 },
    metrics: {
      rowPaddingX: Spacing.four,
      rowGapY: Spacing.two,
      bubblePaddingX: Spacing.three,
      bubblePaddingY: Spacing.two + 2,
      composerPaddingX: Spacing.three,
      composerPaddingY: Spacing.two,
      fieldPaddingY: Spacing.one + 2,
      fieldPaddingStart: Spacing.two,
      sendSize: 32,
      // The ground changes rather than the disc fading — this app's send
      // button has no brand colour to fade.
      sendDisabledOpacity: 1,
      maxInputHeight: 120,
      widgetGap: Spacing.two,
      // ChatGPT's layout: the reply runs full width with no card.
      assistantCard: false,
      composerBarBorderTop: true,
      composerFieldBorder: false,
    },
  };
}
