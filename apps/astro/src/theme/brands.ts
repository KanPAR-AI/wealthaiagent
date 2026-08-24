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
    cosmic: { base: '#171233', deep: '#0e0a24', glow: '#2c2158' },
    paper: { base: '#faf6ef', card: '#ffffff', line: '#e7e0d4' },
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
      interactive: '#6d4fc1',
      interactiveInk: '#ffffff',
    },
    danger: '#b3453e',
  },
  type: {
    display: { fontFamily: 'Georgia', weight: '600' },
    scale: { hero: 34, title: 22, body: 16, sub: 14, caption: 12 },
  },
  radius: { card: 16, button: 26, input: 22, chip: 18 },
  space: (n) => n * SPACE_UNIT,
};

export const BRANDS: Record<BrandId, BrandTokens> = {
  astro,
  jyotish: { ...astro, wordmark: 'Jyotish AI', tagline: 'Your Kundli, Explained.' },
};
