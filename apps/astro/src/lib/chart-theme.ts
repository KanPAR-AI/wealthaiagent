// This brand's values for the shared astral renderers' theme (ASTRAL-97,
// AMB-20(a)) — the sibling of `chat-theme.ts`, and for the same reason.
//
// The diamond, the scorecard and the muhurta table are ONE implementation
// each, drawn against a small theme contract. Left on the package's own
// `LIGHT_THEME` they render in the package's colours, which are close to this
// brand's and not the same — and "close" is what makes a screen look assembled
// rather than designed. Every value here is READ from `@/theme`, so the second
// brand swaps a values file and the ASTRAL-97 greps still mean something.
//
// Nothing here follows the phone's colour scheme: AMB-22(a) ruled the split is
// by ROLE, and a chart is a WORKING surface (ASTRAL-124).

import type { AstralTheme } from '@wealthai/astral';

import { tokens as t } from '@/theme';

export const astroChartTheme: AstralTheme = {
  text: t.palette.ink.primary,
  textMuted: t.palette.ink.muted,
  textPending: t.palette.ink.secondary,
  // The diamond's strokes. The ink line rather than the card's hairline: at
  // the sizes a phone draws this at, a 0.8-unit stroke in the border colour
  // reads as a smudge and the twelve cells stop being twelve cells.
  line: t.palette.ink.secondary,
  surface: t.palette.paper.card,
  surfaceAlt: t.palette.paper.base,
  accent: t.palette.accent.interactive,
  ceremonial: t.palette.accent.ceremonial,
  warn: t.palette.danger,
  border: t.palette.paper.line,
};

/** The same diagram on the night field (the Birth Chart screen, owner
 *  2026-09-18). Gold lines on the cosmic card: the diamond reads as a drawn
 *  keepsake, and the twelve cells stay twelve cells at phone size. The paper
 *  theme above stays for the match screen until that moves too. */
export const astroChartThemeNight: AstralTheme = {
  text: t.palette.ink.onCosmic,
  textMuted: t.palette.ink.onCosmicMuted,
  textPending: t.palette.ink.onCosmicMuted,
  line: t.palette.accent.ceremonial,
  surface: 'transparent',
  surfaceAlt: t.palette.cosmic.deep,
  accent: t.palette.accent.ceremonial,
  ceremonial: t.palette.accent.ceremonial,
  warn: t.palette.cosmic.horizon,
  border: t.palette.cosmic.line,
};
