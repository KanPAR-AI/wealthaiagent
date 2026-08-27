/**
 * @wealthai/astral — the astrology renderers (docs/49 PH-3, ASTRAL-15..20).
 *
 * Read `primitives.ts` first: it explains why the components in here take a
 * `ui` object instead of rendering elements directly, and therefore why the
 * SAME scorecard file serves the 380 px extension panel and the native app.
 */

export * from './payloads';
export * from './format';
export * from './geometry';
export * from './primitives';
export * from './block-registry';
export * from './input-request';

export * from './view/natal';
export * from './view/match';
export * from './view/muhurta';

export { ChartDiamond, NatalChartView } from './components/natal-chart';
export type {
  ChartDiamondProps,
  NatalChartViewProps,
} from './components/natal-chart';
export { MatchScorecard } from './components/match-scorecard';
export type { MatchScorecardProps } from './components/match-scorecard';
export { MuhurtaWindowsView } from './components/muhurta-windows';
export type { MuhurtaWindowsProps } from './components/muhurta-windows';

export { InputRequestView, inputFieldRegistry } from './components/input-request';
export type { InputRequestViewProps } from './components/input-request';
