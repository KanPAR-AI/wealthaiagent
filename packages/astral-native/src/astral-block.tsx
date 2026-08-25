/**
 * The native host for the astrology blocks (docs/49 ASTRAL-15/16/17/20/99).
 *
 * Mirror of `wealthaiagent/src/components/astral/astral-block.tsx`. It
 * supplies primitives, a palette and a width; every decision about what a
 * user reads lives in `@wealthai/astral`, shared with web.
 *
 * ONE of these serves both native apps (ASTRAL-99). It used to live in
 * `apps/mobile` and import that app's event constant; the way an answer
 * becomes a turn is now a host capability (`host.ts`), so nothing here
 * resolves differently depending on which app compiled it.
 *
 * ── dispatch is a REGISTRY, and the third outcome is the point ─────────────
 *
 * A registered type renders its view. An unparseable payload for a
 * registered type renders NOTHING — never the raw JSON, and never a
 * "coming soon" chip standing in for a chart the server did compute. An
 * UNREGISTERED type renders nothing and says so ONCE, by name, in the
 * console (ASTRAL-20's `reportUnknown` contract).
 *
 * That third outcome is not decoration. A hardcoded `return null` is how
 * three computed block types went unrendered for months: the server sent a
 * chart, the client dropped it, and dropping it looked exactly like never
 * receiving one.
 */

import {
  InputRequestView,
  LIGHT_THEME,
  MatchScorecard,
  MuhurtaWindowsView,
  NatalChartView,
  createBlockRegistry,
  parseInputRequest,
  parseMatchReport,
  parseMuhurtaResults,
  parseNatalChart,
  type AstralTheme,
} from '@wealthai/astral';
import type { ReactElement, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { getAstralHost, isAstralHostInstalled } from './host';
import { rnPrimitives } from './rn-primitives';

/** chat bubble padding either side; keeps the wheel off the screen edge */
const BUBBLE_INSET = 48;

/**
 * docs/49 ASTRAL-124 (AMB-22 ruled (a)): the block does NOT follow the OS.
 *
 * These are working surfaces — a wheel, a scorecard, a form — so they take the
 * light theme always. Following the phone left the palette to nobody, and a
 * light block inside dark chrome (or the reverse) was the visible symptom.
 */
function useAstralTheme(): AstralTheme {
  return LIGHT_THEME;
}

interface BlockContext {
  data: unknown;
  theme: AstralTheme;
  width: number;
  /** the ONE way an answer leaves a block on this surface */
  send: (text: string) => void;
  /** the host's brand copy for field hints, if it has any (ASTRAL-104) */
  fieldHints?: Record<string, string>;
  /** …and its glyphs, so the bubble draws the board's rows too */
  fieldIcons?: Record<string, ReactNode>;
}

type BlockRenderer = (ctx: BlockContext) => ReactElement | null;

const handlers: Record<string, BlockRenderer> = {
  input_request: ({ data, theme, width, send, fieldHints, fieldIcons }) => {
    const request = parseInputRequest(data);
    // The answer rides the host's send capability. What travels is the typed
    // fence the shared component builds; nothing here assembles a sentence
    // for a model to re-parse (F18).
    return request ? (
      <InputRequestView
        ui={rnPrimitives}
        theme={theme}
        width={width}
        request={request}
        onSend={send}
        hints={fieldHints}
        fieldIcons={fieldIcons}
      />
    ) : null;
  },

  natal_chart: ({ data, theme, width }) => {
    const chart = parseNatalChart(data);
    return chart ? (
      <NatalChartView ui={rnPrimitives} theme={theme} width={width} chart={chart} />
    ) : null;
  },

  match_report: ({ data, theme, width }) => {
    const report = parseMatchReport(data);
    return report ? (
      <MatchScorecard ui={rnPrimitives} theme={theme} width={width} report={report} />
    ) : null;
  },

  muhurta_results: ({ data, theme, width }) => {
    const results = parseMuhurtaResults(data);
    return results ? (
      <MuhurtaWindowsView ui={rnPrimitives} theme={theme} width={width} results={results} />
    ) : null;
  },
};

/**
 * The types this binding can draw. Exported so a surface that splits data
 * fences out of a text stream can ask rather than restate — a second hand-kept
 * list of block types is how one of them goes stale.
 */
export const astralBlockRegistry = createBlockRegistry<BlockRenderer>(handlers, {
  surface: 'astral-block',
});

export function AstralBlock({ type, data }: { type: string; data: unknown }) {
  const theme = useAstralTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(280, screenWidth - BUBBLE_INSET);

  const render = astralBlockRegistry.get(type);
  if (!render) {
    astralBlockRegistry.reportUnknown(type);
    return null;
  }
  // Resolved at TAP time, not render time: a host that was never installed is
  // a wiring bug, and the throw belongs where somebody is watching rather
  // than in the middle of a paint.
  const send = (text: string) => getAstralHost().send(text);
  // …but the COPY is needed at paint time, so it is asked for explicitly
  // rather than through the throwing accessor: a missing host is a wiring
  // bug worth a loud throw when somebody taps, and not a reason for a chart
  // to fail to draw. Guarded, never swallowed — `isAstralHostInstalled` is
  // the honest question and there is no `try {} catch {}` here.
  const fieldHints = isAstralHostInstalled() ? getAstralHost().fieldHints : undefined;
  const fieldIcons = isAstralHostInstalled() ? getAstralHost().fieldIcons : undefined;
  return render({ data, theme, width, send, fieldHints, fieldIcons });
}
