// Today — pick a session recipe and start the follow-along (the canvas's
// "Today · pick a session" board). Live since the user_progress store
// shipped; renders server data + the pure recipe rules and decides nothing.

import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPhase, fetchProgress } from '@/lib/api';
import { getLang, subscribeLang, t } from '@/lib/i18n';
import type { WirePhaseDetail } from '@/lib/library-view';
import { buildPlan, localDate, type RecipeId } from '@/lib/session-view';
import { phaseColor, tokens as tk } from '@/theme';

const PHASE = '2'; // until phase assignment ships, the program's active phase

export default function Today() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);

  const [detail, setDetail] = useState<WirePhaseDetail | null>(null);
  const [todayDone, setTodayDone] = useState(false);
  const [recipe, setRecipe] = useState<RecipeId>('full');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        fetchPhase(PHASE),
        fetchProgress(localDate()),
      ]);
      setDetail(d);
      setTodayDone(p.today_done);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const plans = detail
    ? {
        full: buildPlan(detail, 'full'),
        short: buildPlan(detail, 'short'),
        gentle: buildPlan(detail, 'gentle'),
      }
    : null;

  const start = () => {
    if (!plans) return;
    router.push({ pathname: '/session', params: { phase: PHASE, recipe } } as never);
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
        style={[s.card, on && s.cardOn]}
      >
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {badge ? <Text style={[s.badge, { color: phaseColor(PHASE) }]}>{badge}</Text> : null}
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
        <Text style={s.eyebrow}>{t('tab.today', lang)} · {t('library.phase', lang)} {PHASE}</Text>
        <Text style={s.title}>{t('today.title', lang)}</Text>

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

        <Pressable
          onPress={start}
          disabled={!plans}
          accessibilityRole="button"
          style={[s.start, !plans && { opacity: 0.5 }]}
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
  card: {
    backgroundColor: tk.palette.paper.card,
    borderWidth: 1,
    borderColor: tk.palette.paper.line,
    borderRadius: tk.radius.card,
    padding: tk.space(4.5),
    gap: tk.space(1.5),
  },
  cardOn: { borderWidth: 2, borderColor: phaseColor('2') },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { ...tk.type.scale.label, fontSize: 18, color: tk.palette.ink.primary },
  badge: { ...tk.type.scale.caption, fontWeight: '700', letterSpacing: 0.8 },
  cardSub: { ...tk.type.scale.sub, color: tk.palette.ink.muted },
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
