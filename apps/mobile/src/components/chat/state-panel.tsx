// "What I've learned (this chat)" — the mobile port of the web debug/control
// panel. Pinned at the top of the chat screen: shows the slots + belief +
// overlay + event log the assistant is carrying, with per-slot delete and a
// full wipe. Collapsed by default; hidden until there's something to show.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import {
  ChatState,
  StateEvent,
  fetchChatState,
  forgetAllState,
  forgetSlot,
} from '@/lib/chat-state';

const KIND_COLOR: Record<string, string> = {
  asserted: '#22a06b',
  hypothetical: '#d9880a',
  committed: '#2f7ed8',
  cleared: '#8a8a8a',
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 48 ? s.slice(0, 45) + '…' : s;
  }
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

function ageLabel(days?: number | null): string {
  if (days == null) return '';
  if (days >= 60) return `${Math.round(days / 30)}mo`;
  if (days >= 1) return `${days}d`;
  return 'today';
}

function latestKinds(events: StateEvent[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of events) {
    const k = `${e.domain}|${e.slot}`;
    if (!(k in out)) out[k] = e.kind;
  }
  return out;
}

function domainLabel(d: string): string {
  return d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatePanel({ chatId, refreshSignal }: { chatId: string | null; refreshSignal: number }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [state, setState] = useState<ChatState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!chatId) {
      setState(null);
      return;
    }
    try {
      setState(await fetchChatState(chatId));
    } catch {
      /* non-fatal — panel just stays hidden */
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const onForget = async (domain: string, slot: string) => {
    if (!chatId) return;
    setBusy(true);
    try {
      await forgetSlot(chatId, domain, slot);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onWipe = () => {
    if (!chatId) return;
    Alert.alert('Forget everything?', 'Clears all saved values and their history for this chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget all',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await forgetAllState(chatId);
            await load();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const slotCount = state?.domains.reduce((n, d) => n + d.slots.length, 0) ?? 0;
  const belief = state?.belief as { intent?: string } | null | undefined;
  const hasBelief = Boolean(belief?.intent && belief.intent !== 'general');
  if (!state || (slotCount === 0 && !hasBelief)) return null;

  const kinds = latestKinds(state.events);

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.backgroundSelected }]}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <ThemedText type="small" themeColor="textSecondary">
          {open ? '▾' : '▸'} 🧠 What I've learned · {slotCount} value{slotCount === 1 ? '' : 's'}
          {hasBelief ? ` · ${belief?.intent}` : ''}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={styles.body}>
          {state.domains.map((d) => (
            <View key={d.domain} style={styles.domain}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.domainTitle}>
                {domainLabel(d.domain)}
              </ThemedText>

              {d.overlay && Object.keys(d.overlay).length > 0 && (
                <View style={styles.overlay}>
                  <ThemedText type="small" style={{ color: '#d9880a' }}>
                    ⚡ What-if{d.overlay_label ? ` (${d.overlay_label})` : ''}:{' '}
                    {Object.entries(d.overlay).map(([k, v]) => `${k}=${fmtValue(v)}`).join(', ')}
                  </ThemedText>
                </View>
              )}

              {d.slots.map((s) => {
                const kind = kinds[`${d.domain}|${s.key}`] || 'asserted';
                return (
                  <View key={s.key} style={styles.row}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.slotLabel}>
                      {s.label}
                    </ThemedText>
                    <ThemedText type="small" style={styles.slotValue}>
                      {fmtValue(s.value)}
                    </ThemedText>
                    <View style={[styles.badge, { backgroundColor: (KIND_COLOR[kind] || '#22a06b') + '22' }]}>
                      <ThemedText type="small" style={{ color: KIND_COLOR[kind] || '#22a06b', fontSize: 9 }}>
                        {kind}
                      </ThemedText>
                    </View>
                    {s.stale && (
                      <View style={[styles.badge, { backgroundColor: '#e8850022' }]}>
                        <ThemedText type="small" style={{ color: '#e88500', fontSize: 9 }}>
                          ⚠ {ageLabel(s.age_days)}
                        </ThemedText>
                      </View>
                    )}
                    <Pressable
                      hitSlop={8}
                      disabled={busy}
                      onPress={() => onForget(d.domain, s.key)}
                      style={styles.trash}>
                      <ThemedText type="small" style={{ color: '#e5484d' }}>
                        🗑
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}

          <Pressable onPress={onWipe} disabled={busy} style={styles.wipe}>
            <ThemedText type="small" style={{ color: '#e5484d' }}>
              ↺ Forget everything
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four },
  header: { paddingVertical: Spacing.two },
  body: { paddingBottom: Spacing.three, gap: Spacing.two },
  domain: { gap: 2 },
  domainTitle: { textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 },
  overlay: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  slotLabel: { flexShrink: 1 },
  slotValue: { flexShrink: 1, fontWeight: '600' },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  trash: { marginLeft: 'auto', paddingHorizontal: 4 },
  wipe: { paddingTop: Spacing.two },
});
