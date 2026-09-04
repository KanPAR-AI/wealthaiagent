// The five tab glyphs, drawn — stroke SVG on a 24px grid, matching the
// design canvas's icons (no emoji, no icon-font dependency).

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { TabId } from '@/lib/tabs';

export function TabIcon({ id, color, size }: { id: TabId; color: string; size: number }) {
  const s = { width: size, height: size };
  switch (id) {
    case 'today':
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8Z"
            stroke={color} strokeWidth={2} strokeLinejoin="round"
          />
        </Svg>
      );
    case 'library':
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={4} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
          <Path d="M10 9.2 15 12l-5 2.8V9.2Z" fill={color} />
        </Svg>
      );
    case 'coach':
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 12a8 8 0 1 0-3.2 6.4L20 20l-.9-3.4A7.96 7.96 0 0 0 20 12Z"
            stroke={color} strokeWidth={2} strokeLinejoin="round"
          />
        </Svg>
      );
    case 'progress':
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'profile':
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
          <Path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
  }
}
