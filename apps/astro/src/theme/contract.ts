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

  /**
   * Per-brand COPY (docs/49 ASTRAL-104, amended 2026-08-24).
   *
   * Colour is not the only thing a brand owns. The board's frame 2 hints
   * "Austin, Texas, USA" and "City, State, or ZIP code" — US postal
   * conventions, and a ZIP-code hint in India is a form asking for something
   * that does not exist. So the hint is a token like every other value, and
   * the screen that shows it names the token rather than the sentence.
   *
   * `fieldHints` is keyed the way the shared widget reads it: by the
   * engine's field `key` first, then by field `kind`. An engine-supplied
   * `hint` always wins — the engine knows things about a particular ask that
   * a brand does not.
   */
  copy: {
    /** the heading over the birth-details form (screen 2) */
    birthDetailsTitle: string;
    /** the line under it */
    birthDetailsSubtitle: string;
    /** the reassurance the board puts at the foot of screen 2 */
    privacyFooter: string;
    fieldHints: { placeBirthHint: string; dateBirthHint: string; timeBirthHint: string };
  };

  palette: {
    /** Ceremonial ground — the deep cosmic field (screens 1, 3, 6, 12's header).
     *  `horizon` is the warm apricot the board burns into the lower third of
     *  screen 1 where the sky meets the water. */
    cosmic: { base: string; deep: string; glow: string; horizon: string };
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
    /** The screen-1 illustration's layers (drawn, not an asset). */
    scene: {
      ridgeFar: string; ridgeNear: string;
      waterTop: string; waterBottom: string;
      silhouette: string; rock: string;
      cloud: string; cloudNear: string;
    };
  };

  type: {
    /** Serif display face for the wordmark and ceremonial headings.
     *
     *  F26 — INTERIM STACK, not a decision: no font file exists anywhere in
     *  the workspace, so this resolves to Georgia on iOS and to the platform
     *  serif on Android. ASTRAL-97 makes the face an asset decision with a
     *  test that FAILS when the asset is missing; that test cannot be written
     *  until an asset exists, and this token is the single place it lands. */
    display: { fontFamily: string; fontWeight: '400' | '600' | '700' };
    /** Named steps that carry their own leading. ASTRAL-97: "as named steps
     *  with line-heights, not call-site numbers" — a screen SPREADS a step, so
     *  leading can never drift away from the size it belongs to. */
    scale: Record<TypeStep, TypeStyle>;
  };

  /** The two gradients the board actually draws (ASTRAL-97). Data, not a
   *  component: each platform paints them with its own primitive. */
  gradients: {
    /** The night-sky field — radial, brightest just above centre. */
    nightSky: ReadonlyArray<{ offset: string; color: string }>;
    /** The gold CTA — vertical, with a lighter rim along the top edge. */
    goldCta: { from: string; to: string; rim: string };
  };

  /** Elevation for surfaces the board floats rather than outlines. */
  elevation: { card: { color: string; opacity: number; radius: number; offsetY: number } };

  radius: { card: number; button: number; input: number; chip: number; tail: number; pill: number };
  /** Fixed control sizes, so a 42px disc is one decision and not four. */
  size: { disc: number; avatar: number; icon: number };
  space: (n: number) => number;
}

/** The seven steps the board actually uses across screens 1, 4 and 12. */
export type TypeStep =
  | 'hero'
  | 'title'
  | 'lead'
  | 'body'
  | 'label'
  | 'sub'
  | 'caption';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export type BrandId = 'astro' | 'jyotish';
