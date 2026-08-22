/**
 * Test harness for the shared `@wealthai/astral` components.
 *
 * These tests deliberately drive the REAL DOM adapter (`dom-primitives`), not
 * a test double: half the risk in the ASTRAL-18 arrangement lives in the
 * adapter, and a stubbed one would launder it.
 *
 * `WIDE` and `PANEL` are the two widths ASTRAL-18 names — the AstroMatch
 * extension's 380 px side panel, and a comfortable app/desktop width.
 */

import { render } from '@testing-library/react';
import {
  InputRequestView,
  LIGHT_THEME,
  MatchScorecard,
  MuhurtaWindowsView,
  NatalChartView,
  inputFieldRegistry,
  parseInputRequest,
  parseMatchReport,
  parseMuhurtaResults,
  parseNatalChart,
} from '@wealthai/astral';

import { domPrimitives } from '@/components/astral/dom-primitives';

export const PANEL_WIDTH = 380;
export const APP_WIDTH = 900;

export function renderNatal(payload: unknown, width = APP_WIDTH) {
  const chart = parseNatalChart(payload);
  if (!chart) throw new Error('fixture did not parse');
  return render(
    <NatalChartView ui={domPrimitives} theme={LIGHT_THEME} width={width} chart={chart} />,
  );
}

export function renderMatch(payload: unknown, width = APP_WIDTH) {
  const report = parseMatchReport(payload);
  if (!report) throw new Error('fixture did not parse');
  return render(
    <MatchScorecard ui={domPrimitives} theme={LIGHT_THEME} width={width} report={report} />,
  );
}

export function renderMuhurta(payload: unknown, width = APP_WIDTH) {
  const results = parseMuhurtaResults(payload);
  if (!results) throw new Error('fixture did not parse');
  return render(
    <MuhurtaWindowsView ui={domPrimitives} theme={LIGHT_THEME} width={width} results={results} />,
  );
}

/**
 * docs/49 ASTRAL-91 — the input widget through the same real adapter.
 *
 * `onSend` is captured rather than dispatched: the send CHANNEL is the
 * clients' existing quick-reply event and is tested where it is wired; what
 * matters here is WHAT the widget hands it.
 */
export function renderInputRequest(
  payload: unknown,
  width = APP_WIDTH,
  warn?: (message: string) => void,
) {
  const request = parseInputRequest(payload);
  if (!request) throw new Error('fixture did not parse');
  inputFieldRegistry.resetWarnings();
  const sent: string[] = [];
  const view = render(
    <InputRequestView
      ui={domPrimitives}
      theme={LIGHT_THEME}
      width={width}
      request={request}
      onSend={(text) => sent.push(text)}
      warn={warn}
    />,
  );
  return { ...view, sent };
}
