/** The token CONTRACT — what every brand must supply (docs/49 ASTRAL-97).
 *
 *  Pure types: no React, no platform imports, no values. A screen written
 *  against `tokens.accent.interactive` works for any brand; a screen written
 *  against `#7c3aed` works for exactly one — which is the copy AMB-20(a)
 *  exists to prevent.
 *
 *  Per ASTRAL-98 the ceremonial accent (the board's gold ring, star field,
 *  "Get Started") and the interactive accent (the violet buttons, links,
 *  send disc) are SEPARATE tokens: the board uses both and one token cannot
 *  be two colors.
 */

export interface BrandTokens {
  /** The product's display name. A per-brand token, never a literal (F35). */
  wordmark: string;
  /** One line under the wordmark on ceremonial surfaces. */
  tagline: string;

  palette: {
    /** Ceremonial ground — the deep cosmic field (screens 1, 3, 6, 12's header). */
    cosmic: { base: string; deep: string; glow: string };
    /** Working ground — light card surfaces with dark ink (screens 2, 4, 5, 7, 8). */
    paper: { base: string; card: string; line: string };
    ink: { primary: string; secondary: string; muted: string; onCosmic: string; onCosmicMuted: string };
    accent: {
      /** Gold: ceremony — the ring, stars, the primary CTA on cosmic ground. */
      ceremonial: string;
      ceremonialInk: string;
      /** Violet: interaction — buttons on paper, links, the send disc, user bubbles. */
      interactive: string;
      interactiveInk: string;
    };
    danger: string;
  };

  type: {
    /** Serif display face for the wordmark and ceremonial headings.
     *  No font file ships yet (F26): these are platform stacks. */
    display: { fontFamily: string; weight: '400' | '600' | '700' };
    scale: { hero: number; title: number; body: number; sub: number; caption: number };
  };

  radius: { card: number; button: number; input: number; chip: number };
  space: (n: number) => number;
}

export type BrandId = 'astro' | 'jyotish';
