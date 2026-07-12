// Widget rendering for assistant messages.
//
// Interactive (tap → quick reply, dispatched through the core platform
// event bus — the mobile analogue of web's `chat-quick-reply` CustomEvent):
//   action_tiles      {actions:[{label,message}]} or {tiles:[{id,label}],
//                     message_prefix}
//   specialist_picker {specialists:[{id,name,...}], message_prefix?}
//   multi_select      {options:[{id,label}], message_prefix?, submit_label?,
//                     max_select?} — proper select-then-submit
//
// Everything else (natal_chart, palm_analysis, charts, tables, onboarding
// form) renders as a labeled chip until its native view lands in Phase 4 —
// visible structure, never silently dropped.

import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { getPlatform, type Widget } from '@wealthai/core';

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

export function WidgetView({ widget }: { widget: Widget }) {
  const type = (widget.type || '').replace(/^widget_/, '');
  const data: any = widget.data ?? widget;

  if (type === 'action_tiles') {
    const items: { label: string; message: string }[] = data.actions?.length
      ? data.actions.map((a: any) => ({ label: a.label, message: a.message }))
      : (data.tiles || []).map((t: any) => ({
          label: t.label,
          message: `${data.message_prefix || ''}${t.id}`,
        }));
    if (items.length) return <TileRow items={items} />;
  }

  if (type === 'specialist_picker') {
    const items = (data.specialists || []).map((sp: any) => ({
      label: sp.name || sp.label || sp.id,
      message: `${data.message_prefix || ''}${sp.id}`,
    }));
    if (items.length) return <TileRow items={items} />;
  }

  if (type === 'multi_select' && Array.isArray(data.options) && data.options.length) {
    return <MultiSelect data={data} />;
  }

  if (type === 'onboarding_form' && Array.isArray(data.fields) && data.fields.length) {
    return <OnboardingForm data={data} />;
  }

  if (type === 'palm_analysis') {
    return <PalmView data={data} />;
  }

  // Transient status marker streamed while the vision pass runs; the
  // palm_analysis widget follows it in the same message.
  if (type === 'palm_scanning') {
    return <Chip label="Scanning palm…" plain />;
  }

  // Chip-only snapshot pinned atop holistic follow-ups.
  if (type === 'palm_predictions') {
    return <PalmPredictionsView data={data} />;
  }

  // Charts + tables — native SVG renders (bug aef2e65d: these piled up
  // as "coming soon" chips at the end of every IRR analysis).
  if (type === 'table') {
    return <TableWidget widget={widget} />;
  }
  if (type === 'line_chart') {
    return <ChartWidget widget={widget} kind="line" />;
  }
  if (type === 'bar_chart') {
    return <ChartWidget widget={widget} kind="bar" />;
  }
  if (type === 'composed_chart') {
    return <ChartWidget widget={widget} kind="composed" />;
  }

  // Web parity: these JSON blocks are data for the formatted markdown that
  // follows them — never shown raw, never chipped.
  if (type === 'natal_chart' || type === 'muhurta_results' || type === 'match_report') {
    return null;
  }

  return <Chip label={type.replace(/_/g, ' ')} />;
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
