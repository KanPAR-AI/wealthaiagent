/**
 * The web host for the three astrology blocks (docs/49 ASTRAL-15/16/17/20).
 *
 * It supplies the three things `@wealthai/astral` deliberately does not know:
 * the DOM primitives, a palette, and a measured width. Everything a user reads
 * is decided inside the shared package, so this file and its React Native
 * counterpart cannot drift into two different scorecards.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
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

import { domPrimitives } from './dom-primitives';

/**
 * Start narrow and widen after measuring.
 *
 * 380 is the AstroMatch extension's declared side-panel width, and it is
 * BELOW `WIDE_LAYOUT_MIN_WIDTH`, so the first paint is the single-column
 * layout. Getting this backwards would flash the wide layout inside a narrow
 * chat bubble on every streamed chunk.
 */
const INITIAL_WIDTH = 380;

function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(INITIAL_WIDTH);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    // jsdom has no ResizeObserver, and neither do some older webviews. The
    // measured-once value is correct for a chat bubble that does not resize;
    // the observer is the upgrade, not the requirement.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

function useAstralTheme(): AstralTheme {
  // Read straight off the class `ThemeProvider` writes to <html>. Deliberately
  // not `useTheme()`: that returns "system" until resolved, which needs
  // matchMedia and makes component tests environment-dependent.
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  return isDark ? DARK_THEME : LIGHT_THEME;
}

/**
 * Render one already-parsed data block, or nothing.
 *
 * `value` is whatever `JSON.parse` produced. Each parser returns null for a
 * payload it cannot vouch for, and null renders nothing — never the raw JSON
 * (PH-3 gate: "No raw JSON is ever visible to a user").
 */
export function AstralBlock({ type, value }: { type: string; value: unknown }) {
  const { ref, width } = useMeasuredWidth();
  const theme = useAstralTheme();
  const ui = domPrimitives;

  let body: ReactNode = null;
  if (type === 'input_request') {
    const request = parseInputRequest(value);
    if (request) {
      body = (
        <InputRequestView
          ui={ui}
          theme={theme}
          width={width}
          request={request}
          // The answer rides the SAME channel the shipped quick-reply
          // widgets use (`chat-window.tsx`'s `chat-quick-reply` listener),
          // so no new send path is introduced on the client either. What is
          // different is what travels: a typed fence, not a sentence for the
          // extractor to re-parse (docs/49 ASTRAL-85, F18).
          onSend={(text) =>
            window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text } }))
          }
        />
      );
    }
  } else if (type === 'natal_chart') {
    const chart = parseNatalChart(value);
    if (chart) body = <NatalChartView ui={ui} theme={theme} width={width} chart={chart} />;
  } else if (type === 'match_report') {
    const report = parseMatchReport(value);
    if (report) body = <MatchScorecard ui={ui} theme={theme} width={width} report={report} />;
  } else if (type === 'muhurta_results') {
    const results = parseMuhurtaResults(value);
    if (results) body = <MuhurtaWindowsView ui={ui} theme={theme} width={width} results={results} />;
  }

  if (!body) return null;
  return <div ref={ref}>{body}</div>;
}
