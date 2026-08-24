// The cosmic field the board draws on every ceremonial surface (frames 1, 3,
// 6, 11, 12) — the night-sky gradient, a hand-placed star field, the beaded
// ring, the sparkle bursts, the small ringed planet and the warm horizon.
//
// One module, because screen 1 and screen 12's header are the SAME sky at two
// heights. Two copies would drift the moment one of them was tuned.
//
// Everything here is drawn rather than shipped as artwork: no illustration
// asset exists yet (the board's mountain-and-water scene is asset-blocked),
// and a flat empty field would read as "unfinished" rather than "night".

import { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tokens } from '@/theme';

/** [x, y, radius, opacity, gold?] — fractions of the field's own box. */
type Star = [number, number, number, number, number?];

/**
 * A LITERAL sky, not a formula.
 *
 * The first version hashed the index (`(i * 73) % 97`), which produces a
 * lattice: evenly-spread dots at three repeating sizes that read as texture,
 * not as stars. Real skies clump. These 62 are placed in seven loose clusters
 * with scatter between them, sizes and opacities varying continuously, and
 * roughly a third of them warm — which is what the board's field does.
 */
const STARS: Star[] = [
  [0.189, 0.119, 1.3, 0.58, 1], [0.337, 0.177, 1.8, 0.64, 1], [0.070, 0.111, 1.6, 0.78],
  [0.250, 0.179, 1.8, 0.33, 1], [0.281, 0.126, 1.1, 0.71], [0.255, 0.022, 1.0, 0.83, 1],
  [0.100, 0.071, 1.3, 0.75], [0.753, 0.142, 1.6, 0.84, 1], [0.643, 0.020, 1.1, 0.40],
  [0.721, 0.055, 1.3, 0.34], [0.396, 0.074, 0.8, 0.53], [0.446, 0.100, 1.6, 0.45],
  [0.725, 0.031, 1.6, 0.44, 1], [0.555, 0.027, 1.1, 0.60], [0.690, 0.020, 1.8, 0.75],
  [0.610, 0.221, 0.9, 0.79, 1], [0.897, 0.294, 1.0, 0.55], [0.985, 0.300, 1.6, 0.46],
  [0.887, 0.306, 1.1, 0.47, 1], [0.984, 0.226, 1.3, 0.67], [0.833, 0.232, 1.8, 0.57],
  [0.764, 0.226, 1.3, 0.50], [0.605, 0.388, 1.0, 0.84, 1], [0.419, 0.290, 0.7, 0.65],
  [0.404, 0.493, 0.7, 0.40], [0.493, 0.262, 1.8, 0.64], [0.253, 0.078, 0.8, 0.50],
  [0.166, 0.398, 1.1, 0.33, 1], [0.235, 0.444, 0.7, 0.37], [0.020, 0.347, 1.1, 0.41, 1],
  [0.127, 0.549, 0.9, 0.44], [0.098, 0.310, 1.6, 0.62, 1], [0.103, 0.505, 0.8, 0.69],
  [0.166, 0.501, 1.1, 0.79, 1], [0.131, 0.421, 0.9, 0.46], [0.095, 0.401, 1.0, 0.62],
  [0.750, 0.561, 1.3, 0.72, 1], [0.693, 0.479, 0.7, 0.89, 1], [0.887, 0.332, 1.3, 0.68],
  [0.482, 0.397, 1.1, 0.82, 1], [0.351, 0.356, 1.6, 0.78, 1], [0.341, 0.050, 0.8, 0.78],
  [0.343, 0.174, 0.8, 0.31], [0.611, 0.044, 1.6, 0.86], [0.964, 0.641, 0.7, 0.80],
  [0.067, 0.354, 1.6, 0.72], [0.187, 0.354, 0.8, 0.63, 1], [0.023, 0.121, 1.3, 0.75],
  [0.714, 0.098, 1.0, 0.79, 1], [0.569, 0.472, 0.7, 0.42, 1], [0.883, 0.587, 1.6, 0.69],
  [0.817, 0.526, 0.7, 0.46, 1], [0.550, 0.107, 0.9, 0.38], [0.034, 0.610, 1.1, 0.43, 1],
  [0.030, 0.259, 0.8, 0.50, 1], [0.687, 0.344, 0.9, 0.52], [0.338, 0.507, 1.6, 0.80],
  [0.890, 0.475, 1.1, 0.61], [0.106, 0.688, 1.6, 0.88], [0.274, 0.681, 1.6, 0.34],
  [0.749, 0.374, 0.9, 0.55], [0.451, 0.371, 1.6, 0.41, 1],
];

/**
 * The night-sky gradient, as SVG defs.
 *
 * `id` is a prop because gradient ids are document-global on web: two skies
 * mounted at once (screen 12's header over a cached screen 1) would otherwise
 * share one definition.
 */
export function SkyDefs({ id }: { id: string }) {
  return (
    <Defs>
      <RadialGradient id={id} cx="50%" cy="38%" r="78%">
        {tokens.gradients.nightSky.map((stop) => (
          <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
        ))}
      </RadialGradient>
      <RadialGradient id={`${id}-horizon`} cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={tokens.palette.cosmic.horizon} stopOpacity={0.5} />
        <Stop offset="60%" stopColor={tokens.palette.cosmic.horizon} stopOpacity={0.14} />
        <Stop offset="100%" stopColor={tokens.palette.cosmic.horizon} stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

export function SkyField({ id, width, height }: { id: string; width: number; height: number }) {
  return <Rect width={width} height={height} fill={`url(#${id})`} />;
}

/** Stars, scaled into a box. `until` crops the field for short headers. */
export function Stars({
  width, height, until = 1, scale = 1,
}: { width: number; height: number; until?: number; scale?: number }) {
  return (
    <G>
      {STARS.filter(([, y]) => y <= until).map(([x, y, r, o, gold], i) => (
        <Circle
          key={i}
          cx={x * width}
          cy={(y / until) * height}
          r={r * scale}
          opacity={o}
          fill={gold ? tokens.palette.accent.ceremonial : tokens.palette.ink.onCosmic}
        />
      ))}
    </G>
  );
}

/**
 * A four-point burst with cross flares — the board's big sparkles.
 *
 * Drawn as a concave-flanked star plus two long, faint flares, because a plain
 * polygon star reads as a logo and this has to read as light.
 */
export function Sparkle({
  x, y, size, color = tokens.palette.accent.ceremonial, opacity = 1,
}: { x: number; y: number; size: number; color?: string; opacity?: number }) {
  const w = size * 0.16;
  const star =
    `M 0 ${-size} C ${w} ${-size * 0.3} ${size * 0.3} ${-w} ${size} 0 ` +
    `C ${size * 0.3} ${w} ${w} ${size * 0.3} 0 ${size} ` +
    `C ${-w} ${size * 0.3} ${-size * 0.3} ${w} ${-size} 0 ` +
    `C ${-size * 0.3} ${-w} ${-w} ${-size * 0.3} 0 ${-size} Z`;
  return (
    <G x={x} y={y} opacity={opacity}>
      <Path d={star} fill={color} opacity={0.28} scale={1.9} />
      <Path d={star} fill={color} />
    </G>
  );
}

/**
 * The beaded ring — a fine dashed circle with brighter node dots and a gap at
 * the crown for a star to sit in, as frame 1 draws it.
 */
export function BeadedRing({
  cx, cy, r, beads = 60,
}: { cx: number; cy: number; r: number; beads?: number }) {
  const gold = tokens.palette.accent.ceremonial;
  const circumference = 2 * Math.PI * r;
  const gap = circumference * 0.055; // the crown opening
  const crown = 0.2; // radians of bead-free arc either side of the top
  return (
    <G>
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={gold} strokeWidth={0.7} fill="none" opacity={0.28}
        strokeDasharray={`${circumference - gap} ${gap}`}
        // An SVG circle's path starts at 3 o'clock and runs clockwise, so a
        // naive offset of `dash/2 + C/4` puts the opening at the BOTTOM. It
        // did, until this was rendered and looked at. The crown is at 0.75C,
        // so `0.25C - gap/2` lands the gap centred there.
        strokeDashoffset={circumference * 0.25 - gap / 2}
      />
      {Array.from({ length: beads }, (_, i) => {
        const a = (2 * Math.PI * i) / beads - Math.PI / 2;
        // leave the crown clear for the star that sits in it
        const fromTop = Math.abs(((a + Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI);
        if (fromTop < crown) return null;
        const bright = i % 5 === 0;
        return (
          <Circle
            key={i}
            cx={cx + r * Math.cos(a)}
            cy={cy + r * Math.sin(a)}
            r={bright ? 1.5 : 0.9}
            fill={gold}
            opacity={bright ? 0.85 : 0.5}
          />
        );
      })}
    </G>
  );
}

/** The small ringed planet the board hangs in the top right. */
export function RingedPlanet({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <G x={x} y={y}>
      <Circle r={r} fill={tokens.palette.cosmic.glow} opacity={0.95} />
      <Circle r={r} cx={-r * 0.3} cy={-r * 0.3} fill={tokens.palette.accent.interactive} opacity={0.5} />
      <Ellipse
        rx={r * 1.75} ry={r * 0.42}
        stroke={tokens.palette.accent.ceremonial} strokeWidth={1} fill="none"
        opacity={0.7} rotation={-18}
      />
    </G>
  );
}

/** The warm apricot glow where the board's sky meets its water. */
export function Horizon({
  id, width, height, at = 0.63,
}: { id: string; width: number; height: number; at?: number }) {
  return (
    <Ellipse
      cx={width / 2}
      cy={height * at}
      rx={width * 0.62}
      ry={height * 0.2}
      fill={`url(#${id}-horizon)`}
    />
  );
}

/**
 * The wash the board bleeds out of screen 4's top-right corner: the cosmic
 * field arriving on a working surface, and gone again within half the width.
 *
 * Two things were got wrong first and fixed by rendering it and looking:
 *  - a flat rectangle at low opacity does not do what the frame does. Frame 4
 *    is near-opaque navy in the corner and clean paper a short way in, so the
 *    fade is IN the paint — the nightSky stops, anchored at the corner,
 *    running to zero alpha.
 *  - and it must stay OFF the wordmark. The first version spanned the header
 *    and put a grey haze across "Your cosmic advisor". This one is drawn into
 *    a box the caller keeps narrow, and its falloff is tight.
 *
 * `width`/`height` are the box, not the screen; the corner stars are mapped
 * into it so they arrive with the wash rather than floating past it.
 */
export function CornerWash({
  id, width, height,
}: { id: string; width: number; height: number }) {
  const [near, mid, far] = tokens.gradients.nightSky;
  return (
    <G>
      <Defs>
        <RadialGradient id={`${id}-corner`} cx="100%" cy="0%" r="75%">
          <Stop offset="0%" stopColor={near.color} stopOpacity={0.96} />
          <Stop offset="40%" stopColor={mid.color} stopOpacity={0.5} />
          <Stop offset="75%" stopColor={far.color} stopOpacity={0.1} />
          <Stop offset="100%" stopColor={far.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id}-corner)`} />
      <G>
        {STARS.filter(([x, y]) => x > 0.5 && y < 0.36).map(([x, y, r, o, gold], i) => (
          <Circle
            key={i}
            cx={(x - 0.5) * 2 * width}
            cy={(y / 0.36) * height}
            r={r * 0.7}
            opacity={o * 0.75}
            fill={gold ? tokens.palette.accent.ceremonial : tokens.palette.ink.onCosmic}
          />
        ))}
      </G>
    </G>
  );
}
