// This app's WIDGET SET — allowance (b) of the owner's one-surface ruling
// (docs/49 ASTRAL-105) — dispatched through a REGISTRY keyed by widget type
// (docs/49 ASTRAL-20).
//
// What is shared with `apps/astro` is the surface: the lifecycle, the
// transcript, the bubble, the composer, and the three interactive widgets
// every chat has (`action_tiles`, `specialist_picker`, `multi_select` — now
// in `@wealthai/chat-native`, one implementation, one send channel). What is
// NOT shared is which types exist, and this is that list: this app is the
// general-purpose one, so it draws charts, tables, palm views and the
// dietician's onboarding form as well as the astral blocks.
//
// Three outcomes, and the third is the point of ASTRAL-20:
//   1. a registered type renders its view;
//   2. a type on DEFERRED_TYPES — known to the backend, native view not built
//      yet — renders a labelled chip, visible structure rather than silence;
//   3. anything else renders NOTHING and warns once, naming the type.
//
// (3) replaces the old `if (type === 'natal_chart' || ...) return null` and the
// catch-all chip. The hardcoded null is how three computed block types went
// unrendered for months: the server sent a chart, the client dropped it, and
// dropping it looked exactly like never receiving one.

import { createBlockRegistry } from '@wealthai/astral';
import { AstralBlock } from '@wealthai/astral-native';
import {
  Chip,
  sharedWidgetHandlers,
  type ChatTheme,
  type ChatWidgetHandler,
} from '@wealthai/chat-native';
import { type Widget } from '@wealthai/core';

import { ChartWidget, TableWidget } from '@/components/chat/chart-widgets';
import { OnboardingForm } from '@/components/chat/onboarding-form';
import { PalmPredictionsView, PalmView } from '@/components/chat/palm-view';

export { QUICK_REPLY_EVENT } from '@/lib/events';

const handlers: Record<string, ChatWidgetHandler> = {
  // The three any chat has, from the shared surface rather than copied here.
  ...sharedWidgetHandlers,

  onboarding_form: (data) =>
    Array.isArray(data.fields) && data.fields.length ? <OnboardingForm data={data} /> : null,

  palm_analysis: (data) => <PalmView data={data} />,

  // Transient status marker streamed while the vision pass runs; the
  // palm_analysis widget follows it in the same message.
  palm_scanning: (_data, _widget, theme) => <Chip label="Scanning palm…" plain theme={theme} />,

  // Chip-only snapshot pinned atop holistic follow-ups.
  palm_predictions: (data) => <PalmPredictionsView data={data} />,

  // Charts + tables — native SVG renders (bug aef2e65d: these piled up
  // as "coming soon" chips at the end of every IRR analysis).
  table: (_data, widget) => <TableWidget widget={widget} />,
  line_chart: (_data, widget) => <ChartWidget widget={widget} kind="line" />,
  bar_chart: (_data, widget) => <ChartWidget widget={widget} kind="bar" />,
  composed_chart: (_data, widget) => <ChartWidget widget={widget} kind="composed" />,

  // docs/49 ASTRAL-83: the engine asks, the client collects.
  input_request: (data) => <AstralBlock type="input_request" data={data} />,

  // docs/49 PH-3: the three blocks both clients used to discard.
  natal_chart: (data) => <AstralBlock type="natal_chart" data={data} />,
  match_report: (data) => <AstralBlock type="match_report" data={data} />,
  muhurta_results: (data) => <AstralBlock type="muhurta_results" data={data} />,
};

export const widgetRegistry = createBlockRegistry<ChatWidgetHandler>(handlers, {
  surface: 'widget-view',
});

/**
 * Types the backend really emits and this app has no native view for yet.
 * They keep the labelled chip on purpose — "visible structure, never silently
 * dropped" — and they are DECLARED, so an undeclared type still trips the
 * ASTRAL-20 warning instead of hiding behind a friendly chip.
 */
const DEFERRED_TYPES = new Set([
  'pie_chart',
  'compound_interest_calculator',
  'sip_calculator',
  'mortgage_calculator',
  'retirement_calculator',
  'cuisine_proportions',
  'bedtime_video',
]);

export function WidgetView({ widget, theme }: { widget: Widget; theme: ChatTheme }) {
  const type = (widget.type || '').replace(/^widget_/, '');
  const data: any = widget.data ?? widget;

  const handler = widgetRegistry.get(type);
  if (handler) return handler(data, widget, theme);

  if (DEFERRED_TYPES.has(type)) return <Chip label={type.replace(/_/g, ' ')} theme={theme} />;

  widgetRegistry.reportUnknown(type);
  return null;
}
