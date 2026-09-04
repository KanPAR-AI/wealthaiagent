// KneeFit's brand tokens — the Terra direction from the approved design
// canvas ("KneeFit App Design", Directions page, option A).
//
// Same discipline as apps/astro's token module (docs/49 ASTRAL-97): this is
// the ONLY place a colour, size or type step is declared; a screen spreads a
// named step and never states a size. The shape deliberately mirrors astro's
// contract members that the shared chat surface reads (`palette.paper.*`,
// `ink.*`, `accent.interactive`, `type.scale`, `radius`, `space`, `size`,
// `elevation`) so `chat-theme.ts` reads identically in both apps.
//
// ── the phase ramp ─────────────────────────────────────────────────────────
// The design's one loud idea: the app wears the user's CURRENT phase colour.
// Four hues at the same lightness/chroma (the design states them in oklch;
// RN wants hex, so these are the sRGB conversions). CTAs stay deep pine;
// green is reserved for "done"; red only for pain warnings.

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight?: '400' | '600' | '700';
  letterSpacing?: number;
}

export const PHASE_COLORS: Record<string, string> = {
  '1': '#C56A45', // clay      oklch(0.62 0.13 45)
  '2': '#B08628', // ochre     oklch(0.62 0.13 80)
  '3': '#699A4E', // moss      oklch(0.62 0.13 140)
  '4': '#2E9D95', // pine teal oklch(0.62 0.13 190)
};

export const tokens = {
  wordmark: 'KneeFit',
  tagline: '20 minutes a day, guided by a physio’s program.',

  palette: {
    paper: { base: '#F7F5F0', card: '#FFFFFF', line: '#E5E1D8' },
    ink: { primary: '#202B22', secondary: '#35402F', muted: '#6B7365' },
    accent: {
      /** deep pine — every primary CTA and the active tab */
      interactive: '#2E4634',
      interactiveInk: '#F7F5F0',
      /** the current-phase colour; screens read it via `phaseColor()` */
      phase: PHASE_COLORS,
      /** soft ground/border pair for phase-tinted chips (phase 2 ochre) */
      phaseChipBg: '#F2E9D4',
      phaseChipLine: '#DFCFA3',
    },
    success: '#699A4E',
    successSoft: '#EFF3EA',
    successLine: '#D8E2CE',
    danger: '#B0402C',
  },

  type: {
    /** Bricolage Grotesque is the design's display face; until the font
     *  asset lands (same F26 situation as astro's serif), the platform
     *  system face carries the weight and nothing states the family. */
    display: { fontWeight: '700' as const },
    scale: {
      title: { fontSize: 28, lineHeight: 33, fontWeight: '700' } as TypeStyle,
      heading: { fontSize: 21, lineHeight: 26, fontWeight: '600' } as TypeStyle,
      body: { fontSize: 16, lineHeight: 23 } as TypeStyle,
      label: { fontSize: 17, lineHeight: 22, fontWeight: '700' } as TypeStyle,
      sub: { fontSize: 15, lineHeight: 20 } as TypeStyle,
      caption: { fontSize: 12, lineHeight: 16 } as TypeStyle,
      eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 1.1 } as TypeStyle,
    },
  },

  radius: { card: 16, button: 14, input: 22, chip: 999, tail: 4, pill: 999 },
  size: { disc: 44, icon: 24, thumb: 84 },
  space: (n: number) => n * 4,
  elevation: {
    card: { color: '#202B22', opacity: 0.06, radius: 12, offsetY: 4 },
  },
} as const;

/** The accent for a phase. Unknown phases fall back to deep pine rather
 *  than inventing a fifth colour. */
export function phaseColor(phase: string): string {
  return PHASE_COLORS[phase] ?? tokens.palette.accent.interactive;
}
