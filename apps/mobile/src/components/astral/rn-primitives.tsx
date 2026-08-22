/**
 * The React Native adapter for `@wealthai/astral` (docs/49 ASTRAL-18).
 *
 * Counterpart to `wealthaiagent/src/components/astral/dom-primitives.tsx`.
 * Between them, ONE chart implementation and ONE scorecard implementation
 * serve the web app, the 380 px AstroMatch extension panel and this app. This
 * file knows nothing about kootas, grahas or muhurtas — it maps a dozen style
 * keys onto `View`, `Text` and `react-native-svg`, and nothing else.
 *
 * Keep it that way. The moment domain rendering appears here, the workspace
 * has two scorecards and ASTRAL-18 is broken.
 */

import type {
  AstralPrimitives,
  BoxProps,
  GroupProps,
  SvgCircleProps,
  SvgLineProps,
  SvgProps,
  SvgRectProps,
  SvgTextProps,
  TextProps,
} from '@wealthai/astral';
import { Text as RNText, View } from 'react-native';
import Svg2, { Circle, G, Line, Rect, Text as SvgTextEl } from 'react-native-svg';

function Box({ style, testID, children }: BoxProps) {
  return (
    <View testID={testID} style={style}>
      {children}
    </View>
  );
}

function Text({ style, testID, children }: TextProps) {
  return (
    <RNText testID={testID} style={style}>
      {children}
    </RNText>
  );
}

function SvgRoot({ width, height, viewBox, testID, children }: SvgProps) {
  return (
    <Svg2 testID={testID} width={width} height={height} viewBox={viewBox}>
      {children}
    </Svg2>
  );
}

function Group({ rotation, originX, originY, children }: GroupProps) {
  // `rotation` + `originX/originY` is react-native-svg's own API for this and
  // is the reason the primitive is shaped as a group rather than a `transform`
  // string: the string form is not portable between the two SVG stacks.
  return (
    <G rotation={rotation} originX={originX} originY={originY}>
      {children}
    </G>
  );
}

function SvgRect(p: SvgRectProps) {
  return (
    <Rect
      x={p.x}
      y={p.y}
      width={p.width}
      height={p.height}
      rx={p.rx}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
    />
  );
}

function SvgLine(p: SvgLineProps) {
  return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
}

function SvgCircle(p: SvgCircleProps) {
  return (
    <Circle
      cx={p.cx}
      cy={p.cy}
      r={p.r}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
      strokeDasharray={p.strokeDasharray}
      strokeLinecap={p.strokeLinecap}
    />
  );
}

function SvgText(p: SvgTextProps) {
  return (
    <SvgTextEl
      x={p.x}
      y={p.y}
      fontSize={p.fontSize}
      fill={p.fill}
      fontWeight={p.fontWeight}
      textAnchor={p.textAnchor}>
      {p.children}
    </SvgTextEl>
  );
}

export const rnPrimitives: AstralPrimitives = {
  Box,
  Text,
  Svg: SvgRoot,
  Group,
  SvgRect,
  SvgLine,
  SvgCircle,
  SvgText,
};
