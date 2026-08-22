/**
 * The React-DOM adapter for `@wealthai/astral` (docs/49 ASTRAL-18).
 *
 * This file knows nothing about charts, kootas or muhurtas. It maps the tiny
 * primitive contract in `packages/astral/src/primitives.ts` onto DOM elements,
 * which is what lets the scorecard exist exactly ONCE in the workspace while
 * still rendering in the browser, in the AstroMatch extension side panel and,
 * through the React Native adapter, in the app.
 *
 * Two mappings that are not cosmetic:
 *   - `display: flex` + `flexDirection: column` are forced ON, because CSS
 *     defaults to block/row and React Native defaults to flex/column. Without
 *     this every shared layout would be laid out differently on the two
 *     platforms from one source file, which defeats the point.
 *   - numeric style values become `px`. RN numbers are density-independent
 *     pixels; CSS numbers are unitless and mostly invalid.
 */

import type { CSSProperties } from 'react';
import type {
  AstralBoxStyle,
  AstralPrimitives,
  AstralTextStyle,
  BoxProps,
  GroupProps,
  SvgCircleProps,
  SvgLineProps,
  SvgProps,
  SvgRectProps,
  SvgTextProps,
  TextProps,
} from '@wealthai/astral';

const PX_PROPS = new Set([
  'gap', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'marginTop', 'marginBottom', 'borderRadius', 'borderWidth', 'borderTopWidth',
  'borderLeftWidth', 'width', 'height', 'minWidth', 'maxWidth', 'fontSize',
  'letterSpacing', 'lineHeight',
]);

function toCss(style: AstralBoxStyle | AstralTextStyle | undefined): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'number' && PX_PROPS.has(key) ? `${value}px` : value;
  }
  return out as CSSProperties;
}

function Box({ style, testID, children }: BoxProps) {
  return (
    <div
      data-testid={testID}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...toCss(style) }}
    >
      {children}
    </div>
  );
}

function Text({ style, testID, children }: TextProps) {
  return (
    <span data-testid={testID} style={{ ...toCss(style) }}>
      {children}
    </span>
  );
}

function Svg({ width, height, viewBox, testID, children }: SvgProps) {
  return (
    <svg
      data-testid={testID}
      width={width}
      height={height}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function Group({ rotation, originX, originY, children }: GroupProps) {
  const transform =
    rotation === undefined
      ? undefined
      : `rotate(${rotation} ${originX ?? 0} ${originY ?? 0})`;
  return <g transform={transform}>{children}</g>;
}

function SvgRect(p: SvgRectProps) {
  return (
    <rect
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
  return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
}

function SvgCircle(p: SvgCircleProps) {
  return (
    <circle
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
    <text
      x={p.x}
      y={p.y}
      fontSize={p.fontSize}
      fill={p.fill}
      fontWeight={p.fontWeight}
      textAnchor={p.textAnchor}
    >
      {p.children}
    </text>
  );
}

export const domPrimitives: AstralPrimitives = {
  Box, Text, Svg, Group, SvgRect, SvgLine, SvgCircle, SvgText,
};
