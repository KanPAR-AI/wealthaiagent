/**
 * The native host for the three astrology blocks (docs/49 ASTRAL-15/16/17).
 *
 * Mirror of `wealthaiagent/src/components/astral/astral-block.tsx`. It supplies
 * primitives, a palette and a width; every decision about what a user reads
 * lives in `@wealthai/astral`, shared with web.
 */

import {
  DARK_THEME,
  InputRequestView,
  LIGHT_THEME,
  MatchScorecard,
  MuhurtaWindowsView,
  NatalChartView,
  parseInputRequest,
  parseMatchReport,
  parseMuhurtaResults,
  parseNatalChart,
  type AstralTheme,
} from '@wealthai/astral';
import { getPlatform } from '@wealthai/core';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { rnPrimitives } from '@/components/astral/rn-primitives';
import { QUICK_REPLY_EVENT } from '@/lib/events';

/** chat bubble padding either side; keeps the wheel off the screen edge */
const BUBBLE_INSET = 48;

function useAstralTheme(): AstralTheme {
  return useColorScheme() === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function AstralBlock({ type, data }: { type: string; data: unknown }) {
  const theme = useAstralTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(280, screenWidth - BUBBLE_INSET);
  const ui = rnPrimitives;

  if (type === 'input_request') {
    const request = parseInputRequest(data);
    // The answer rides the platform event bus — the same channel the shipped
    // quick-reply widgets use — so no new send path is introduced. What
    // travels is a typed fence, never the "Key: value" sentence
    // `onboarding-form.tsx:63-70` posts for an LLM to re-parse (F18).
    return request ? (
      <InputRequestView
        ui={ui}
        theme={theme}
        width={width}
        request={request}
        onSend={(text) => getPlatform().events.emit(QUICK_REPLY_EVENT, { text })}
      />
    ) : null;
  }
  if (type === 'natal_chart') {
    const chart = parseNatalChart(data);
    // An unparseable payload renders NOTHING — never the raw JSON, and never
    // a "coming soon" chip standing in for a chart the server did compute.
    return chart ? <NatalChartView ui={ui} theme={theme} width={width} chart={chart} /> : null;
  }
  if (type === 'match_report') {
    const report = parseMatchReport(data);
    return report ? <MatchScorecard ui={ui} theme={theme} width={width} report={report} /> : null;
  }
  if (type === 'muhurta_results') {
    const results = parseMuhurtaResults(data);
    return results ? <MuhurtaWindowsView ui={ui} theme={theme} width={width} results={results} /> : null;
  }
  return null;
}
