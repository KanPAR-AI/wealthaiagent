/** Per-brand token VALUES (AMB-20 ruled (a): shared contract, per-brand
 *  values, selected from app.json). Colors are read off the concept board
 *  (docs/astral-board/), which is the design's only source of truth.
 *
 *  The jyotish entry exists so the contract is honest about having two
 *  implementors — its values start as the astro set minus the wordmark and
 *  diverge when that brand gets its own board. The final brand NAMES are
 *  undecided (owner, 2026-08-24); the wordmark being a token is the point.
 */
import type { BrandId, BrandTokens } from './contract';

const SPACE_UNIT = 4;

const astro: BrandTokens = {
  wordmark: 'Astral AI',
  tagline: 'Your Birth Chart, Explained.',
  palette: {
    // Sampled off the board rather than guessed: frame 01's sky runs #010518
    // at the crown, #0b173a at mid-height and #1e2b5b through the glow, and
    // frame 12's header sits at #04112f. The values that shipped first
    // (#171233 / #0e0a24 / #2c2158) were a purple-leaning invention and read
    // as mauve next to the frames.
    cosmic: { base: '#0a1330', deep: '#02061b', glow: '#182651', horizon: '#eeb49c' },
    paper: { base: '#faf6ef', card: '#fbf9f5', line: '#e7e0d4' },
    ink: {
      primary: '#23203a',
      secondary: '#4c4767',
      muted: '#8b86a3',
      onCosmic: '#f4efe6',
      onCosmicMuted: '#a9a3c4',
    },
    accent: {
      ceremonial: '#e8c986',
      ceremonialInk: '#2b2043',
      // frame 04's user bubble and send disc sample #5b3a93 / #583794.
      interactive: '#5a378e',
      interactiveInk: '#ffffff',
    },
    danger: '#b3453e',
  },
  type: {
    display: { fontFamily: 'Georgia', fontWeight: '600' },
    scale: {
      hero: { fontSize: 34, lineHeight: 40, letterSpacing: 0.5 },
      title: { fontSize: 22, lineHeight: 28 },
      lead: { fontSize: 17, lineHeight: 23 },
      body: { fontSize: 16, lineHeight: 24 },
      label: { fontSize: 15, lineHeight: 20 },
      sub: { fontSize: 14, lineHeight: 21 },
      caption: { fontSize: 12, lineHeight: 16 },
    },
  },
  gradients: {
    nightSky: [
      { offset: '0%', color: '#1e2b5b' },
      { offset: '55%', color: '#0a1330' },
      { offset: '100%', color: '#02061b' },
    ],
    // frame 01's "Get Started" runs #f1d195 along the top edge to #e8c588 at
    // the bottom, with a paler rim catching the light across the top.
    goldCta: { from: '#f1d195', to: '#e8c588', rim: '#fbeccb' },
  },
  elevation: { card: { color: '#2b2043', opacity: 0.08, radius: 14, offsetY: 4 } },
  radius: { card: 16, button: 26, input: 22, chip: 18, tail: 4, pill: 999 },
  size: { disc: 42, avatar: 76, icon: 22 },
  space: (n) => n * SPACE_UNIT,
};

export const BRANDS: Record<BrandId, BrandTokens> = {
  astro,
  jyotish: { ...astro, wordmark: 'Jyotish AI', tagline: 'Your Kundli, Explained.' },
};
