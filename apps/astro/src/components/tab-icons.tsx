// The five tab glyphs (docs/astral-board frames 3, 8 and 9 draw the bar).
//
// Same arrangement as `field-icons.tsx`: iOS gets the real SF Symbol because
// it is sharper than anything drawn here and costs nothing, and every symbol
// passes a DRAWN fallback so Android and web render the same shape rather
// than a hole. On a tab bar the fallback matters more than anywhere else —
// `SymbolIcon`'s default is a neutral dot, and five identical dots is a
// navigation bar nobody can read.
//
// Keyed by the tab id declared in `lib/tabs.ts`, so a tab that exists always
// has a glyph and a glyph cannot outlive its tab.

import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { SymbolIcon } from '@/components/glyphs';
import type { TabId } from '@/lib/tabs';
import { tokens } from '@/theme';

const STROKE = 1.8;

function House({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 11 L12 4 L20 11 V20 H14 V15 H10 V20 H4 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Insights: a four-point star, the board's own mark for the daily reading. */
function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3 C12.6 8.4 15.6 11.4 21 12 C15.6 12.6 12.6 15.6 12 21 C11.4 15.6 8.4 12.6 3 12 C8.4 11.4 11.4 8.4 12 3 Z"
        fill={color}
      />
    </Svg>
  );
}

function Bubble({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6 H20 V16 H12 L7 20 V16 H4 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Timeline: three rising bars — the board's mark for the yearly forecast. */
function Bars({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={13} width={4} height={7} rx={1} fill={color} />
      <Rect x={10} y={9} width={4} height={11} rx={1} fill={color} />
      <Rect x={16} y={5} width={4} height={15} rx={1} fill={color} />
    </Svg>
  );
}

function Person({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path
        d="M5 20 C5 16.2 8.1 13.6 12 13.6 C15.9 13.6 19 16.2 19 20"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

const DRAWN: Record<TabId, (p: { size: number; color: string }) => ReactNode> = {
  home: House,
  insights: Sparkle,
  chat: Bubble,
  timeline: Bars,
  profile: Person,
};

/** The glyph for one tab, at the size the bar uses. */
export function TabIcon({
  id, name, color, size = tokens.size.icon,
}: {
  id: TabId;
  name: Parameters<typeof SymbolIcon>[0]['name'];
  color: string;
  size?: number;
}) {
  const Drawn = DRAWN[id];
  return <SymbolIcon name={name} size={size} color={color} fallback={<Drawn size={size} color={color} />} />;
}
