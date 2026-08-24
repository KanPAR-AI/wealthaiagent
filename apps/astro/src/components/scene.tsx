/** The screen-1 illustration — frame 01's lower half, drawn rather than
 *  shipped as an asset (docs/49 ASTRAL-123, F28): the meditating figure on
 *  still water, ridge lines either side, a warm horizon glow, thin clouds.
 *
 *  Vector on purpose: crisp at every size, colored from the token layer so
 *  a second brand re-tints it, and reviewable as geometry. Tuned by
 *  rendering the identical paths standalone and looking (scene2.png in the
 *  session scratchpad) — the same discipline that fixed the beaded ring.
 *
 *  Coordinates live in a 400×360 design box scaled to the given width.
 */
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tokens } from '@/theme';

const sc = tokens.palette.scene;
const horizon = tokens.palette.cosmic.horizon;

export const SCENE_RATIO = 360 / 400;

/** Mount inside an <Svg> sized width × width*SCENE_RATIO. */
export function LakeScene({ width }: { width: number }) {
  const s = width / 400;
  return (
    <G scale={s}>
      <Defs>
        <RadialGradient id="scene-glow" cx="50%" cy="55%" r="40%">
          <Stop offset="0%" stopColor={horizon} stopOpacity={0.85} />
          <Stop offset="45%" stopColor={horizon} stopOpacity={0.38} />
          <Stop offset="100%" stopColor={horizon} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="scene-water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={sc.waterTop} />
          <Stop offset="100%" stopColor={sc.waterBottom} />
        </LinearGradient>
        <LinearGradient id="scene-water-glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={horizon} stopOpacity={0.4} />
          <Stop offset="100%" stopColor={horizon} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <Ellipse cx={70} cy={150} rx={95} ry={10} fill={sc.cloud} opacity={0.35} />
      <Ellipse cx={330} cy={130} rx={105} ry={9} fill={sc.cloud} opacity={0.32} />
      <Ellipse cx={250} cy={166} rx={75} ry={6} fill={sc.cloudNear} opacity={0.28} />

      <Rect width={400} height={360} fill="url(#scene-glow)" />

      <Path d="M0 205 L60 168 L110 200 L160 178 L205 210 L400 210 L400 240 L0 240 Z"
        fill={sc.ridgeFar} opacity={0.9} />
      <Path d="M400 208 L340 170 L295 202 L255 185 L215 212 L400 212 Z"
        fill={sc.ridgeFar} opacity={0.9} />
      <Path d="M0 226 L48 196 L96 224 L140 206 L190 230 L0 230 Z" fill={sc.ridgeNear} />
      <Path d="M400 228 L352 198 L308 226 L262 208 L210 232 L400 232 Z" fill={sc.ridgeNear} />

      <Rect y={228} width={400} height={132} fill="url(#scene-water)" />
      <Rect y={228} width={400} height={80} fill="url(#scene-water-glow)" />

      <G stroke={horizon} strokeLinecap="round">
        <Line x1={150} y1={252} x2={250} y2={252} strokeWidth={2} opacity={0.5} />
        <Line x1={120} y1={266} x2={200} y2={266} strokeWidth={2} opacity={0.35} />
        <Line x1={220} y1={278} x2={300} y2={278} strokeWidth={2} opacity={0.3} />
        <Line x1={90} y1={294} x2={160} y2={294} strokeWidth={2} opacity={0.2} />
        <Line x1={240} y1={306} x2={330} y2={306} strokeWidth={2} opacity={0.16} />
      </G>

      <Ellipse cx={200} cy={247} rx={42} ry={9} fill={sc.rock} />

      <G fill={sc.silhouette}>
        <Circle cx={200} cy={196} r={11} />
        <Path d="M200 205 C 191 206, 185 212, 183 224 C 181 230, 179 233, 176 236 L 224 236 C 221 233, 219 230, 217 224 C 215 212, 209 206, 200 205 Z" />
        <Path d="M170 242 C 178 233, 191 229, 200 229 C 209 229, 222 233, 230 242 C 220 238, 210 236, 200 236 C 190 236, 180 238, 170 242 Z" />
        <Path d="M166 244 L 234 244 C 226 238, 212 235, 200 235 C 188 235, 174 238, 166 244 Z" />
      </G>

      <Path d="M189 190 A 11 11 0 0 1 211 196" stroke={horizon} strokeWidth={1.6}
        fill="none" opacity={0.8} />
      <Path d="M185 222 C 187 213, 192 207, 198 205" stroke={horizon} strokeWidth={1.2}
        fill="none" opacity={0.5} />
      <Path d="M172 240 C 180 233, 190 230, 199 229" stroke={horizon} strokeWidth={1}
        fill="none" opacity={0.35} />

      <G fill={horizon} opacity={0.18}>
        <Ellipse cx={200} cy={258} rx={16} ry={4} />
        <Ellipse cx={200} cy={268} rx={11} ry={3} />
      </G>
    </G>
  );
}
