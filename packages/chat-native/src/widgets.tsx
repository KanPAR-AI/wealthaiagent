// The interactive widgets that are not a domain — the ones any chat has
// (docs/49 ASTRAL-105).
//
// Moved out of `apps/mobile/src/components/chat/widget-view.tsx`. The
// REGISTRY stays per-app, because which types a surface draws is allowance
// (b): mobile registers charts, tables, palm views and the dietician's
// onboarding form; astro registers the astral blocks. But `action_tiles`,
// `specialist_picker` and `multi_select` are the same three affordances on
// both, and a second copy of them is how a chip works on one surface and
// quietly does nothing on the other — which is exactly what nearly happened:
// astro's chat screen special-cased `widget_action_tiles` in the screen and
// pinned the labels above the composer, on its own state, off its own event
// name.
//
// Everything a tap sends leaves through ONE channel (`CHAT_SEND_EVENT`), and
// the screen that owns the send path listens on it. No widget introduces a
// second send path (F18(a)).

import { useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getPlatform, type Widget } from '@wealthai/core';

import { CHAT_SEND_EVENT } from './host';
import { ChatText } from './message-bubble';
import type { ChatTheme } from './theme';

export function sendFromWidget(text: string): void {
  getPlatform().events.emit(CHAT_SEND_EVENT, { text });
}

export function TileRow({
  items,
  theme,
}: {
  items: { label: string; message: string }[];
  theme: ChatTheme;
}) {
  const s = stylesFor(theme);
  return (
    <View style={s.tiles}>
      {items.map((t, i) => (
        <Pressable
          key={`${t.label}-${i}`}
          onPress={() => sendFromWidget(t.message)}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          style={({ pressed }) => [s.tile, { opacity: pressed ? 0.7 : 1 }]}>
          <ChatText theme={theme} step="small">{t.label}</ChatText>
        </Pressable>
      ))}
    </View>
  );
}

export function MultiSelect({ data, theme }: { data: any; theme: ChatTheme }) {
  const s = stylesFor(theme);
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
    sendFromWidget(`${data.message_prefix || ''}${labels}`);
  };

  return (
    <View style={s.multiSelect}>
      <View style={s.tiles}>
        {options.map((o) => {
          const on = picked.has(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => toggle(o.id)}
              style={[s.tile, on && { backgroundColor: theme.colors.primary }]}>
              <ChatText theme={theme} step="small" tone={on ? 'onPrimary' : 'default'}>
                {o.label}
              </ChatText>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={submit}
        disabled={picked.size === 0}
        style={[
          s.submit,
          { backgroundColor: picked.size ? theme.colors.primary : theme.colors.surfaceStrong },
        ]}>
        <ChatText theme={theme} step="smallBold" tone="onPrimary">
          {data.submit_label || 'Confirm'}
        </ChatText>
      </Pressable>
    </View>
  );
}

/** Visible structure for something the surface knows about but cannot draw
 *  yet. Never used for an UNDECLARED type — that one is reported. */
export function Chip({
  label,
  plain,
  theme,
}: {
  label: string;
  plain?: boolean;
  theme: ChatTheme;
}) {
  const s = stylesFor(theme);
  return (
    <View style={s.chip}>
      <ChatText theme={theme} step="small" tone="muted">
        ✦ {label}{plain ? '' : ' — interactive view coming to mobile soon'}
      </ChatText>
    </View>
  );
}

export type ChatWidgetHandler = (
  data: any,
  widget: Widget,
  theme: ChatTheme,
) => ReactElement | null;

/**
 * The three handlers every chat surface has.
 *
 * Spread into an app's own registry, so the app's registry stays the place
 * that decides WHICH types exist while these three cannot drift apart.
 *
 * A plain record, not a factory taking the theme: the registry an app builds
 * from it is created ONCE at module load, because `reportUnknown` warns once
 * per type per SESSION and a registry rebuilt on every render would warn on
 * every render. The theme therefore arrives per call, at dispatch.
 */
export const sharedWidgetHandlers: Record<string, ChatWidgetHandler> = {
  action_tiles: (data, _widget, theme) => {
      const items: { label: string; message: string }[] = data.actions?.length
        ? data.actions.map((a: any) => ({ label: a.label, message: a.message ?? a.label }))
        : (data.tiles || []).map((t: any) => ({
            label: t.label,
            message: `${data.message_prefix || ''}${t.id}`,
          }));
      return items.length ? <TileRow items={items} theme={theme} /> : null;
    },

  specialist_picker: (data, _widget, theme) => {
      const items = (data.specialists || []).map((sp: any) => ({
        label: sp.name || sp.label || sp.id,
        message: `${data.message_prefix || ''}${sp.id}`,
      }));
      return items.length ? <TileRow items={items} theme={theme} /> : null;
    },

  multi_select: (data, _widget, theme) =>
    Array.isArray(data.options) && data.options.length ? (
      <MultiSelect data={data} theme={theme} />
    ) : null,
};

function stylesFor(theme: ChatTheme) {
  const { colors, metrics, radius } = theme;
  return StyleSheet.create({
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: metrics.widgetGap,
      marginVertical: metrics.widgetGap,
    },
    tile: {
      backgroundColor: colors.surface,
      borderRadius: radius.chip,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.bubblePaddingY,
    },
    multiSelect: { marginVertical: metrics.widgetGap, gap: metrics.widgetGap },
    submit: {
      alignSelf: 'flex-start',
      borderRadius: radius.chip,
      paddingHorizontal: metrics.rowPaddingX,
      paddingVertical: metrics.bubblePaddingY,
    },
    chip: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: metrics.bubblePaddingX,
      paddingVertical: metrics.widgetGap,
      marginVertical: metrics.widgetGap,
      alignSelf: 'flex-start',
    },
  });
}
