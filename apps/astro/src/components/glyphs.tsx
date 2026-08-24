// Drawn glyphs — chevrons, the 3x3 dot grid, the send arrow and the stop
// square (docs/astral-board frames 4 and 12).
//
// They are SVG rather than text characters on purpose. "↑" and "◼" render at
// whatever weight and baseline the platform font decides, which is why the
// send disc looked off-centre, and a glyph in a `Text` needs a `fontSize` —
// a call-site type decision the token layer forbids (ASTRAL-97).
//
// iOS gets the real SF Symbol where one exists, because it is sharper than
// anything drawn here and costs nothing; every symbol passes a drawn
// `fallback`, so Android and web render the same shape rather than a hole.

import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Circle, Path } from 'react-native-svg';

import { tokens } from '@/theme';

const STROKE = 1.9;

export function ChevronLeft({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M15 4 L7 12 L15 20"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function ChevronRight({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 4 L17 12 L9 20"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** The board's menu mark: three rows of three dots. */
export function DotGrid({ size, color }: { size: number; color: string }) {
  const at = [4, 12, 20];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {at.map((cy) => at.map((cx) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill={color} />
      )))}
    </Svg>
  );
}

export function ArrowUp({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 19 L12 6 M6 11 L12 5 L18 11"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function StopSquare({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 8 H16 V16 H8 Z" fill={color} />
    </Svg>
  );
}

/** A neutral marker: what a settings row shows where no SF Symbol resolves. */
export function DotMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={7} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={12} cy={12} r={2} fill={color} />
    </Svg>
  );
}

/**
 * An SF Symbol on iOS, a drawn shape everywhere else.
 *
 * `SymbolView` renders its `fallback` whenever the platform has no symbol for
 * the name, so the fallback is not optional decoration — on Android and web it
 * IS the icon.
 */
export function Symbol({
  name, size = tokens.size.icon, color, fallback,
}: {
  name: SFSymbol;
  size?: number;
  color: string;
  fallback?: React.ReactNode;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      fallback={fallback ?? <DotMark size={size} color={color} />}
    />
  );
}
