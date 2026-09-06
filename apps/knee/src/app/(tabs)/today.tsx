// Today — pick a session recipe and start the follow-along (the canvas's
// "Today · pick a session" board). Live since the user_progress store
// shipped; renders server data + the pure recipe rules and decides nothing.

import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlatform } from '@wealthai/core';

import { fetchPhase, fetchProgress } from '@/lib/api';
import { getLang, subscribeLang, t } from '@/lib/i18n';
import type { WirePhaseDetail } from '@/lib/library-view';
import { buildCustomPlan, buildPlan, localDate, nearDuplicateWarnings, type RecipeId } from '@/lib/session-view';
import { phaseColor, tokens as tk } from '@/theme';

// The user's current phase, chosen HERE and remembered on-device (owner:
// "can I not change the phase"). The formal phase-gate assignment (Flow 3)
// still arrives server-side later; until then the choice is the user's.
const PHASE_KEY = 'knee.phase';

export default function Today() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);

  const [detail, setDetail] = useState<WirePhaseDetail | null>(null);
  const [todayDone, setTodayDone] = useState(false);
  const [recipe, setRecipe] = useState<RecipeId>('full');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhaseState] = useState('2');

  useEffect(() => {
    void getPlatform().storage.getItem(PHASE_KEY).then((v) => {
      if (v && ['1', '2', '3', '4'].includes(v)) setPhaseState(v);
    });
  }, []);

  const setPhase = (ph: string) => {
    setPhaseState(ph);
    setPicked(new Set()); // picks belong to a phase
    void getPlatform().storage.setItem(PHASE_KEY, ph);
  };

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        fetchPhase(phase),
        fetchProgress(localDate()),
      ]);
      setDetail(d);
      setTodayDone(p.today_done);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [phase]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const plans = detail
    ? {
        full: buildPlan(detail, 'full'),
        short: buildPlan(detail, 'short'),
        gentle: buildPlan(detail, 'gentle'),
        custom: buildCustomPlan(detail, [...picked]),
      }
    : null;

  const start = () => {
    if (!plans) return;
    if (recipe === 'custom' && picked.size === 0) return;
    router.push({
      pathname: '/session',
      params: recipe === 'custom'
        ? { phase, recipe, names: [...picked].join('|') }
        : { phase, recipe },
    } as never);
  };

  const togglePick = (name: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const card = (id: RecipeId, title: string, sub: string, badge?: string) => {
    const on = recipe === id;
    const plan = plans?.[id];
    return (
      <Pressable
        key={id}
        onPress={() => setRecipe(id)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={[s.card, on && { borderWidth: 2, borderColor: phaseColor(phase) }]}
      >
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {badge ? <Text style={[s.badge, { color: phaseColor(phase) }]}>{badge}</Text> : null}
        </View>
        <Text style={s.cardSub}>
          {plan ? `${plan.exercises.length} · ~${plan.estimatedMinutes} ${t('today.minutes', lang)} — ` : ''}
          {sub}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>{t('tab.today', lang)}</Text>
        <Text style={s.title}>{t('today.title', lang)}</Text>

        {/* which phase today runs in — remembered on this device */}
        <View style={s.phaseRow}>
          {(['1', '2', '3', '4'] as const).map((ph) => {
            const on = phase === ph;
            return (
              <Pressable
                key={ph}
                onPress={() => setPhase(ph)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[s.phaseItem, on && {
                  backgroundColor: phaseColor(ph), borderColor: phaseColor(ph),
                }]}
              >
                <Text style={[s.phaseText, on && { color: '#FFFFFF', fontWeight: '700' }]}>
                  {t('library.phase', lang)} {ph}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {todayDone ? (
          <View style={s.doneCard}>
            <Text style={s.doneText}>{t('today.done', lang)}</Text>
          </View>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {card('full', t('today.full', lang), t('today.fullSub', lang),
              t('today.recommended', lang))}
        {card('short', t('today.short', lang), t('today.shortSub', lang))}
        {card('gentle', t('today.gentle', lang), t('today.gentleSub', lang))}
        {card('custom', t('today.custom', lang), t('today.customSub', lang))}

        {/* The design's "Build my own from the library": tapping the custom
            card opens the phase's playable exercises as toggle rows —
            selection never reorders; the program's order is kept. */}
        {recipe === 'custom' && detail ? (
          <View style={s.pickerCard}>
            <Text style={s.pickerHint}>{t('today.customPick', lang)}</Text>
            {detail.exercises.filter((e) => e.url || e.clip_url).map((e) => {
              const on = picked.has(e.name);
              return (
                <Pressable
                  key={e.name}
                  onPress={() => togglePick(e.name)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={s.pickRow}
                >
                  <View style={[s.pickBox, on && s.pickBoxOn]}>
                    {on ? <Text style={s.pickTick}>✓</Text> : null}
                  </View>
                  <Text style={[s.pickName, on && { fontWeight: '700' }]}
                    numberOfLines={1}>
                    {e.name}
                  </Text>
                </Pressable>
              );
            })}

            {/* Near-duplicate warning (owner request): the engine decides the
                movement group; we only surface a collision and let the user
                keep both or swap one. Never removes a pick. */}
            {nearDuplicateWarnings(detail, [...picked]).map((w) => (
              <View key={w.group} style={s.dupWarn}>
                <Text style={s.dupTitle}>⚠ {t('today.dupTitle', lang)}</Text>
                <Text style={s.dupBody}>
                  {w.names.join(' + ')} {t('today.dupBody', lang)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={start}
          disabled={!plans || (recipe === 'custom' && picked.size === 0)}
          accessibilityRole="button"
          style={[s.start,
            (!plans || (recipe === 'custom' && picked.size === 0)) && { opacity: 0.5 }]}
        >
          <Text style={s.startText}>{t('today.start', lang)}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tk.palette.paper.base },
  scroll: { padding: tk.space(6), gap: tk.space(3), paddingBottom: tk.space(10) },
  eyebrow: {
    ...tk.type.scale.eyebrow,
    color: tk.palette.ink.muted,
    textTransform: 'uppercase',
  },
  title: { ...tk.type.scale.title, ...tk.type.display, color: tk.palette.ink.primary },
  doneCard: {
    backgroundColor: tk.palette.successSoft,
    borderWidth: 1,
    borderColor: tk.palette.successLine,
    borderRadius: tk.radius.card,
    padding: tk.space(4),
  },
  doneText: { ...tk.type.scale.body, color: tk.palette.ink.secondary, fontWeight: '700' },
  error: { ...tk.type.scale.sub, color: tk.palette.danger },
  // caution, not alarm: a warm ochre banner (red is reserved for pain, green
  // for done) that advises without blocking the pick.
  dupWarn: {
    backgroundColor: '#FBF3E2',
    borderWidth: 1,
    borderColor: '#E9D9AE',
    borderRadius: tk.radius.card,
    padding: tk.space(3),
    gap: tk.space(1),
    marginTop: tk.space(2),
  },
  dupTitle: { ...tk.type.scale.sub, color: '#8A6A1F', fontWeight: '700' },
  dupBody: { ...tk.type.scale.sub, color: tk.palette.ink.secondary },
  card: {
    backgroundColor: tk.palette.paper.card,
    borderWidth: 1,
    borderColor: tk.palette.paper.line,
    borderRadius: tk.radius.card,
    padding: tk.space(4.5),
    gap: tk.space(1.5),
  },
  cardOn: { borderWidth: 2, borderColor: phaseColor('2') }, // superseded inline
  phaseRow: { flexDirection: 'row', gap: tk.space(2) },
  phaseItem: {
    flex: 1, minHeight: 44, borderRadius: tk.radius.button,
    borderWidth: 1, borderColor: tk.palette.paper.line,
    backgroundColor: tk.palette.paper.card,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseText: { ...tk.type.scale.sub, color: tk.palette.ink.primary },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { ...tk.type.scale.label, fontSize: 18, color: tk.palette.ink.primary },
  badge: { ...tk.type.scale.caption, fontWeight: '700', letterSpacing: 0.8 },
  cardSub: { ...tk.type.scale.sub, color: tk.palette.ink.muted },
  pickerCard: {
    backgroundColor: tk.palette.paper.card,
    borderWidth: 1,
    borderColor: tk.palette.paper.line,
    borderStyle: 'dashed',
    borderRadius: tk.radius.card,
    padding: tk.space(3.5),
    gap: 2,
  },
  pickerHint: { ...tk.type.scale.sub, color: tk.palette.ink.muted, marginBottom: tk.space(1.5) },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: tk.space(3),
    minHeight: 44, paddingHorizontal: tk.space(1),
  },
  pickBox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#C9C4B6',
    alignItems: 'center', justifyContent: 'center',
  },
  pickBoxOn: { backgroundColor: phaseColor('2'), borderColor: phaseColor('2') }, // overridden inline
  pickTick: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pickName: { ...tk.type.scale.body, color: tk.palette.ink.primary, flex: 1 },
  start: {
    minHeight: 56,
    borderRadius: tk.radius.button,
    backgroundColor: tk.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tk.space(2),
  },
  startText: { ...tk.type.scale.label, fontSize: 18, color: tk.palette.accent.interactiveInk },
});
