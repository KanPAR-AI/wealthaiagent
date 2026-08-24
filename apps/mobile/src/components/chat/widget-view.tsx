// Widget rendering for assistant messages, dispatched through a REGISTRY
// keyed by widget type (docs/49 ASTRAL-20).
//
// Interactive (tap → quick reply, dispatched through the core platform
// event bus — the mobile analogue of web's `chat-quick-reply` CustomEvent):
//   action_tiles      {actions:[{label,message}]} or {tiles:[{id,label}],
//                     message_prefix}
//   specialist_picker {specialists:[{id,name,...}], message_prefix?}
//   multi_select      {options:[{id,label}], message_prefix?, submit_label?,
//                     max_select?} — proper select-then-submit
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
import { useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { getPlatform, type Widget } from '@wealthai/core';

import { AstralBlock } from '@wealthai/astral-native';

import { ChartWidget, TableWidget } from '@/components/chat/chart-widgets';
import { OnboardingForm } from '@/components/chat/onboarding-form';
import { PalmPredictionsView, PalmView } from '@/components/chat/palm-view';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

export { QUICK_REPLY_EVENT } from '@/lib/events';
import { QUICK_REPLY_EVENT } from '@/lib/events';

function quickReply(text: string) {
  getPlatform().events.emit(QUICK_REPLY_EVENT, { text });
}

function TileRow({ items }: { items: { label: string; message: string }[] }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  return (
    <View style={styles.tiles}>
      {items.map((t, i) => (
        <Pressable
          key={`${t.label}-${i}`}
          onPress={() => quickReply(t.message)}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="small">{t.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function MultiSelect({ data }: { data: any }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const options: { id: string; label: string }[] = data.options || [];
  const maxSelect = data.max_select ?? options.length;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxSelect) next.add(id);
      return next;
    });
  };

  const submit = () => {
    const labels = options.filter((o) => picked.has(o.id)).map((o) => o.label).join(', ');
    if (!labels) return;
    quickReply(`${data.message_prefix || ''}${labels}`);
  };

  return (
    <View style={styles.multiSelect}>
      <View style={styles.tiles}>
        {options.map((o) => {
          const on = picked.has(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => toggle(o.id)}
              style={[
                styles.tile,
                { backgroundColor: on ? colors.text : colors.backgroundElement },
              ]}>
              <ThemedText type="small" style={on ? { color: colors.background } : undefined}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={submit}
        disabled={picked.size === 0}
        style={[
          styles.submit,
          { backgroundColor: picked.size ? colors.text : colors.backgroundSelected },
        ]}>
        <ThemedText type="smallBold" style={{ color: colors.background }}>
          {data.submit_label || 'Confirm'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Chip({ label, plain }: { label: string; plain?: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  return (
    <View style={[styles.chip, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        ✦ {label}{plain ? '' : ' — interactive view coming to mobile soon'}
      </ThemedText>
    </View>
  );
}

type WidgetHandler = (data: any, widget: Widget) => ReactElement | null;

const handlers: Record<string, WidgetHandler> = {
  action_tiles: (data) => {
    const items: { label: string; message: string }[] = data.actions?.length
      ? data.actions.map((a: any) => ({ label: a.label, message: a.message }))
      : (data.tiles || []).map((t: any) => ({
          label: t.label,
          message: `${data.message_prefix || ''}${t.id}`,
        }));
    return items.length ? <TileRow items={items} /> : null;
  },

  specialist_picker: (data) => {
    const items = (data.specialists || []).map((sp: any) => ({
      label: sp.name || sp.label || sp.id,
      message: `${data.message_prefix || ''}${sp.id}`,
    }));
    return items.length ? <TileRow items={items} /> : null;
  },

  multi_select: (data) =>
    Array.isArray(data.options) && data.options.length ? <MultiSelect data={data} /> : null,

  onboarding_form: (data) =>
    Array.isArray(data.fields) && data.fields.length ? <OnboardingForm data={data} /> : null,

  palm_analysis: (data) => <PalmView data={data} />,

  // Transient status marker streamed while the vision pass runs; the
  // palm_analysis widget follows it in the same message.
  palm_scanning: () => <Chip label="Scanning palm…" plain />,

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

export const widgetRegistry = createBlockRegistry<WidgetHandler>(handlers, {
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

export function WidgetView({ widget }: { widget: Widget }) {
  const type = (widget.type || '').replace(/^widget_/, '');
  const data: any = widget.data ?? widget;

  const handler = widgetRegistry.get(type);
  if (handler) return handler(data, widget);

  if (DEFERRED_TYPES.has(type)) return <Chip label={type.replace(/_/g, ' ')} />;

  widgetRegistry.reportUnknown(type);
  return null;
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  tile: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  multiSelect: { marginVertical: Spacing.two, gap: Spacing.two },
  submit: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginVertical: Spacing.two,
    alignSelf: 'flex-start',
  },
});
