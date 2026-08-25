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
  copy: {
    // Frame 02's own words for the heading and the footer. The HINTS are not
    // the board's: "Austin, Texas, USA" and "City, State, or ZIP code" are US
    // postal conventions (docs/49 ASTRAL-104, amended) and this brand ships in
    // a market with no ZIP codes. What replaces them is the same information
    // the resolver actually wants — a city, and enough to tell two of them
    // apart, which is exactly what the contested-place ask is about.
    birthDetailsTitle: "Let's Build\nYour Chart",
    correctionTitle: 'Correct Your\nDetails',
    birthDetailsSubtitle: 'Accurate birth details help us deliver precise insights.',
    privacyFooter: 'Your data is private & secure',
    stillNeeded: 'Still needed',
    casting: 'Casting your chart…',
    fieldHints: {
      placeBirthHint: 'City or town — add the state or country if the name is common',
      dateBirthHint: '',
      // The board captions this "Exact time is important". It is not a
      // caption: under AMB-13(c) the birth time decides whether there is a
      // Lagna, a bhava chart, a pada, a dasha and a full gun milan at all —
      // so the ENGINE says it, in the ask's own `reason`, and nothing here
      // repeats it in grey. Empty on purpose, not unfinished.
      timeBirthHint: '',
    },
  },
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
    // The cosmic deep, carried under a sheet — the ceremonial ground doing
    // the dimming rather than a neutral black nobody chose.
    scrim: 'rgba(2, 6, 27, 0.45)',
    // The illustrated scene, tuned by rendering it (scratchpad scene2.png):
    // ridges and silhouette sit BELOW the sky's values so the glow carries.
    scene: {
      ridgeFar: '#0d1737', ridgeNear: '#070d26',
      waterTop: '#131c40', waterBottom: '#050a20',
      silhouette: '#05091f', rock: '#04081c',
      cloud: '#243468', cloudNear: '#2c3a6b',
    },
  },
  type: {
    // Playfair Display (OFL, bundled at assets/fonts/) — the high-contrast
    // transitional serif the board's wordmark reads as (F26). Loaded in
    // _layout via useFonts under this exact key; the F26 test fails the
    // suite when the asset or the wiring drifts, so the OS never silently
    // substitutes. Weight 400: Playfair's Didone contrast carries the
    // presence Georgia faked with 600.
    display: { fontFamily: 'PlayfairDisplay', fontWeight: '400' },
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
  jyotish: {
    ...astro,
    wordmark: 'Jyotish AI',
    tagline: 'Your Kundli, Explained.',
    copy: {
      ...astro.copy,
      birthDetailsTitle: "Let's Build\nYour Kundli",
      fieldHints: {
        ...astro.copy.fieldHints,
        placeBirthHint: 'City or town — add the district or state if the name is common',
      },
    },
  },
};
