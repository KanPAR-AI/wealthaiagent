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
  PalmReadingView,
  createBlockRegistry,
  parseInputRequest,
  parseMatchReport,
  parseMuhurtaResults,
  parseNatalChart,
  parsePalmAnalysis,
  type AstralTheme,
  parseBestDays,
  BestDaysView,
} from '@wealthai/astral';
import type { ReactElement, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  getAstralHost,
  hostMaskBirth,
  hostMaskRequest,
  isAstralHostInstalled,
} from './host';
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
  /** docs/65 B2: the host's place lookup, when it has one */
  suggestPlaces?: (query: string) => Promise<Array<{ name: string; country?: string | null; timezone?: string | null }>>;
  /** docs/64 W-3: the host's door to a day's card, when it has one */
  openDay?: (isoDate: string) => void;
  /** owner 2026-09-19: draw a kundli card's birth block masked. Absent on a
   *  host that does not lock birth details, which is today's behaviour. */
  maskBirth?: boolean;
  /** …and the host's transform for a FORM's pre-filled values (see `host.ts`
   *  for why a form needs the host to decide rather than a boolean). */
  maskRequest?: <T>(request: T) => T;
}

type BlockRenderer = (ctx: BlockContext) => ReactElement | null;

const handlers: Record<string, BlockRenderer> = {
  input_request: ({ data, theme, width, send, fieldHints, fieldIcons, suggestPlaces, maskRequest }) => {
    // The engine attaches the CURRENT value to a `field_correction` ask so
    // the picker opens at it (ASTRAL-138). In the Astral AI app that is the
    // user's exact stored birth time, drawn on a wheel in the transcript —
    // reachable with no authentication at all, because the correction turn
    // Profile sends lands in the SHARED chat. The host is asked to strip it;
    // a host without the hook gets today's behaviour.
    const parsed = parseInputRequest(data);
    const request = parsed && maskRequest ? maskRequest(parsed) : parsed;
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
        suggestPlaces={suggestPlaces}
      />
    ) : null;
  },

  natal_chart: ({ data, theme, width, maskBirth }) => {
    const chart = parseNatalChart(data);
    return chart ? (
      <NatalChartView
        ui={rnPrimitives}
        theme={theme}
        width={width}
        chart={chart}
        maskBirth={maskBirth}
      />
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

  // docs/49 ASTRAL-48/49. This entry is the registry's own argument, made
  // twice: `palm_analysis` was UNREGISTERED here, so the Astral app answered
  // a palm upload with a full two-hand reading and drew none of it — the
  // block was dropped, and a dropped block is indistinguishable from a block
  // that never arrived. No photo is passed: the chat bubble has no bearer
  // token to fetch an authorised file with, and the reading stands without
  // one. The palm SCREEN passes its own.
  // docs/64 W-3: the ranked days under a "when should I…?" reply. The
  // engine ranked and banded them; a row's tap is the host's door.
  best_days: ({ data, theme, width, openDay }) => {
    const payload = parseBestDays(data);
    return payload ? (
      <BestDaysView ui={rnPrimitives} theme={theme} width={width} payload={payload} onOpenDay={openDay} />
    ) : null;
  },

  palm_analysis: ({ data, theme, width }) => {
    const analysis = parsePalmAnalysis(data);
    return analysis ? (
      <PalmReadingView ui={rnPrimitives} theme={theme} width={width} analysis={analysis} />
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
  const suggestPlaces = isAstralHostInstalled() ? getAstralHost().suggestPlaces : undefined;
  const openDay = isAstralHostInstalled() ? getAstralHost().openDay : undefined;
  // Asked HERE and not captured at install time: the answer expires (the
  // Astral AI unlock lasts a minute and dies on background), so a block
  // painted after it expired must paint masked. A host without the
  // capability answers by not having it, which is `false` — today's card.
  // The two mask reads live in `host.ts` — a file with no React Native in
  // it, so the join between a host's answer and a rendered card can be
  // driven by a test (Role-3's measured gap: an always-false here was
  // invisible to the whole suite).
  return render({
    data, theme, width, send, fieldHints, fieldIcons, suggestPlaces, openDay,
    maskBirth: hostMaskBirth(),
    maskRequest: hostMaskRequest,
  });
}
