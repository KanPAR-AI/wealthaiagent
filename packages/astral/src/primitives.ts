/**
 * The renderer contract that lets ASTRAL-18 be literally true.
 *
 * ASTRAL-18: "the extension's 380 px side panel and the app's compatibility
 * screen are the same artifact, built once as a responsive component in the
 * shared workspace with width as a prop. A second implementation of the match
 * scorecard anywhere in the workspace is a SPEC-DEVIATION."
 *
 * The obstacle is physical: the extension and the web app render through React
 * DOM, the app renders through React Native. `<div>` and `<View>` cannot be
 * the same element. So the scorecard is written ONCE against the small set of
 * primitives below, and each host supplies a ~100-line adapter that maps them
 * to its element family. The adapter is not a scorecard renderer — it knows
 * nothing about kootas, gunas or wheels — so the grep at the gate finds
 * exactly one implementation of each artifact, which is the property the row
 * is actually asking for.
 *
 * The style vocabulary is deliberately tiny and is the INTERSECTION of what
 * both platforms mean the same way. Two traps it exists to avoid:
 *   - `flexDirection` defaults to `row` in CSS and `column` in RN, so `Box`
 *     is specified as column-by-default and the web adapter must set that.
 *   - RN `Text` does not inherit style through an intervening `View`, so
 *     every piece of text carries its own style. Do not rely on inheritance.
 */

import type { ComponentType, ReactNode } from 'react';

export interface AstralBoxStyle {
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  flexWrap?: 'wrap' | 'nowrap';
  flex?: number;
  flexShrink?: number;
  gap?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderTopWidth?: number;
  borderLeftWidth?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  alignSelf?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  opacity?: number;
}

/**
 * Layout keys that are legal on TEXT as well as on a box.
 *
 * React Native's `Text` accepts layout style, and in the DOM adapter every
 * `Text` is a `<span>` inside a `display:flex` parent, so it is a flex item
 * and `flex` / `width` apply there too. Sharing the exact key set is what
 * keeps a row laid out the same on both platforms from one source file.
 */
type AstralTextLayout = Pick<
  AstralBoxStyle,
  'width' | 'minWidth' | 'maxWidth' | 'flex' | 'flexShrink' | 'alignSelf' | 'marginTop' | 'marginBottom' | 'opacity'
>;

export interface AstralTextStyle extends AstralTextLayout {
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700';
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase';
}

export interface BoxProps {
  style?: AstralBoxStyle;
  /** surfaced on the host element for tests and for accessibility tooling */
  testID?: string;
  children?: ReactNode;
}

export interface TextProps {
  style?: AstralTextStyle;
  testID?: string;
  children?: ReactNode;
}

export interface SvgProps {
  width: number;
  height: number;
  viewBox: string;
  testID?: string;
  children?: ReactNode;
}

export interface GroupProps {
  rotation?: number;
  originX?: number;
  originY?: number;
  children?: ReactNode;
}

export interface SvgRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  rx?: number;
}

export interface SvgLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface SvgCircleProps {
  cx: number;
  cy: number;
  r: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round';
}

export interface SvgTextProps {
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight?: '400' | '500' | '600' | '700';
  textAnchor?: 'start' | 'middle' | 'end';
  children?: ReactNode;
}

export interface AstralPrimitives {
  Box: ComponentType<BoxProps>;
  Text: ComponentType<TextProps>;
  Svg: ComponentType<SvgProps>;
  Group: ComponentType<GroupProps>;
  SvgRect: ComponentType<SvgRectProps>;
  SvgLine: ComponentType<SvgLineProps>;
  SvgCircle: ComponentType<SvgCircleProps>;
  SvgText: ComponentType<SvgTextProps>;
}

/** Colour tokens a host supplies so the shared components carry no palette. */
export interface AstralTheme {
  text: string;
  textMuted: string;
  /** the "this is not known" ink — used for pending/absent rows */
  textPending: string;
  line: string;
  surface: string;
  surfaceAlt: string;
  accent: string;
  warn: string;
  border: string;
}

export const LIGHT_THEME: AstralTheme = {
  text: '#1a1523',
  textMuted: '#6b6577',
  textPending: '#8a8494',
  line: '#3b3548',
  surface: '#ffffff',
  surfaceAlt: '#f5f3f8',
  accent: '#7c3aed',
  warn: '#b45309',
  border: '#e3dfea',
};

export const DARK_THEME: AstralTheme = {
  text: '#f2eefb',
  textMuted: '#a49db4',
  textPending: '#8a8397',
  line: '#cfc7e0',
  surface: '#17141f',
  surfaceAlt: '#221d2e',
  accent: '#a78bfa',
  warn: '#fbbf24',
  border: '#332c42',
};

/**
 * Every shared component takes exactly this. `width` is the prop ASTRAL-18
 * names: 380 for the extension side panel, the measured screen width in the
 * app, the container width on the web compatibility screen.
 */
export interface AstralRenderProps {
  ui: AstralPrimitives;
  theme: AstralTheme;
  width: number;
}

/**
 * The one breakpoint. Below it the layout is a single column (the extension
 * panel and every phone); at or above it, side-by-side blocks are allowed.
 * 380 px — the extension's declared panel width — must land BELOW it, so the
 * panel and a phone get the same treatment.
 */
export const WIDE_LAYOUT_MIN_WIDTH = 520;

export const isWide = (width: number): boolean => width >= WIDE_LAYOUT_MIN_WIDTH;
