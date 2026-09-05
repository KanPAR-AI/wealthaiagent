// The follow-along session — the canvas's flagship flow made real:
// announce (EN/हिन्दी) → beat of silence → count aloud at the stored pace →
// auto-advance → one pain question → the day recorded server-side.
//
// The muted demo clip loops under the voice; the full video is one tap away.
// Every voice action has an on-screen twin (Next / Finish buttons), so the
// session is complete with the sound off.

import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';

import { fetchPhase, recordSession } from '@/lib/api';
import { getLang, speechLocale, t, type Lang } from '@/lib/i18n';
import {
  announcement,
  buildPlan,
  doseLabel,
  localDate,
  setCues,
  spokenNumber,
  type RecipeId,
  type SessionPlan,
} from '@/lib/session-view';
import { phaseColor, tokens as tk } from '@/theme';

function speak(text: string, lang: Lang) {
  Speech.stop();
  Speech.speak(text, { language: speechLocale(lang), rate: 0.95 });
}

export default function Session() {
  const params = useLocalSearchParams<{ phase?: string; recipe?: string }>();
  const phase = params.phase ?? '2';
  const recipe = (params.recipe ?? 'full') as RecipeId;
  const lang = getLang();

  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [index, setIndex] = useState(0);
  const [setNo, setSetNo] = useState(1);
  const [count, setCount] = useState<string | null>(null);
  const [phaseOfSet, setPhaseOfSet] = useState<'announce' | 'counting' | 'rest'>('announce');
  const [finished, setFinished] = useState(false);
  const [pain, setPain] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    void fetchPhase(phase).then((d) => setPlan(buildPlan(d, recipe)))
      .catch(() => setPlan(null));
    return () => { clearTimers(); Speech.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exercise = plan?.exercises[index] ?? null;

  // one player, source swapped per exercise — clip if cut, else full video.
  // A clip that fails to LOAD (owner-reported: black player while the clip
  // route deployed) falls back to the full video rather than a dead card.
  const [brokenClips, setBrokenClips] = useState<Set<string>>(new Set());
  const clipOk = exercise?.clipUrl && !brokenClips.has(exercise.clipUrl);
  const source = (clipOk ? exercise?.clipUrl : exercise?.videoUrl)
    ?? exercise?.videoUrl ?? '';
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    if (!source) return;
    void player.replaceAsync(source).then(() => {
      player.loop = true;
      player.muted = true;
      player.play();
    }).catch(() => {
      if (exercise?.clipUrl && source === exercise.clipUrl) {
        setBrokenClips((prev) => new Set(prev).add(exercise.clipUrl!));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // The system back button leaves the session — fullScreenModal +
  // gestureEnabled:false must never mean trapped (owner-reported).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearTimers();
      Speech.stop();
      router.back();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Run one set: schedule the cues, advance set/exercise when it ends. */
  const runSet = useCallback((exIndex: number, whichSet: number) => {
    if (!plan) return;
    const x = plan.exercises[exIndex];
    clearTimers();
    setPhaseOfSet('counting');
    const { cues, durationS } = setCues(x, lang);
    if (!cues.length) {
      // follow-the-video mode: no counting; the user taps Next when done
      setCount(null);
      return;
    }
    for (const cue of cues) {
      timers.current.push(setTimeout(() => {
        if (cue.show !== undefined) setCount(cue.show);
        if (cue.say) speak(cue.say, lang);
      }, cue.at * 1000));
    }
    timers.current.push(setTimeout(() => {
      const sets = x.dose?.sets ?? 1;
      if (whichSet < sets) {
        setSetNo(whichSet + 1);
        setPhaseOfSet('rest');
        setCount(null);
        speak(lang === 'hi' ? 'आराम कीजिए' : 'rest', lang);
        timers.current.push(setTimeout(() => runSet(exIndex, whichSet + 1), 8000));
      } else {
        advance(exIndex);
      }
    }, (durationS + 1) * 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, lang]);

  /** Announce exercise i, then start its first set after the beat. */
  const announce = useCallback((i: number) => {
    if (!plan) return;
    const x = plan.exercises[i];
    clearTimers();
    setIndex(i);
    setSetNo(1);
    setCount(null);
    setPhaseOfSet('announce');
    speak(announcement(x, i, plan.exercises.length, lang), lang);
    timers.current.push(setTimeout(() => runSet(i, 1), 4500));
  }, [plan, lang, runSet]);

  const advance = useCallback((fromIndex: number) => {
    if (!plan) return;
    const next = fromIndex + 1;
    if (next >= plan.exercises.length) {
      clearTimers();
      Speech.stop();
      setFinished(true);
      speak(lang === 'hi' ? 'सत्र पूरा! बहुत बढ़िया.' : 'Session complete. Well done!', lang);
    } else {
      announce(next);
    }
  }, [plan, lang, announce]);

  // kick off once the plan lands
  const kicked = useRef(false);
  useEffect(() => {
    if (plan && plan.exercises.length && !kicked.current) {
      kicked.current = true;
      announce(0);
    }
  }, [plan, announce]);

  const finish = async (painValue: number | null) => {
    if (!plan || saved) return;
    setPain(painValue);
    try {
      await recordSession({
        date: localDate(),
        phase,
        recipe,
        exercises_done: plan.exercises.slice(0, index + 1).map((x) => x.name),
        duration_s: Math.round((Date.now() - startedAt.current) / 1000),
        pain_0_10: painValue,
      });
      setSaved(true);
    } catch {
      // leave the buttons up — the user can retry; nothing is silently lost
    }
  };

  const closeAll = () => {
    clearTimers();
    Speech.stop();
    router.back();
  };

  if (finished) {
    return (
      <View style={s.fillLight}>
        <StatusBar style="dark" />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.completeBody}>
            <View style={s.ring}>
              <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
                <Path d="M14 30 24 40 43 18" stroke={tk.palette.success}
                  strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={s.completeTitle}>{t('session.complete', lang)}</Text>
            <Text style={s.completeSub}>
              {plan ? `${Math.min(index + 1, plan.exercises.length)} · ` : ''}
              {t('session.recorded', lang)}
            </Text>
            {!saved ? (
              <View style={s.painBlock}>
                <Text style={s.painQ}>{t('session.painQ', lang)}</Text>
                <View style={s.painRow}>
                  {[1, 4, 7].map((v, i) => (
                    <Pressable key={v} onPress={() => void finish(v)}
                      accessibilityRole="button" style={s.painBtn}>
                      <Text style={s.painText}>{['0–2', '3–5', '6+'][i]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={s.savedText}>✓</Text>
            )}
            <Pressable onPress={closeAll} accessibilityRole="button" style={s.doneBtn}>
              <Text style={s.doneBtnText}>{t('session.doneBtn', lang)}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topBar}>
          <Pressable
            onPress={() => index > 0 && announce(index - 1)}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous exercise"
            style={[s.close, index === 0 && { opacity: 0.35 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path d="M12.5 4 6.5 10l6 6" stroke="#F7F5F0" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.topLabel}>
            {t('session.exercise', lang)} {plan ? index + 1 : '–'} / {plan?.exercises.length ?? '–'}
          </Text>
          <Pressable onPress={closeAll} accessibilityRole="button"
            accessibilityLabel="Close" style={s.close}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path d="M5 5l10 10M15 5 5 15" stroke="#F7F5F0" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {source ? (
          <VideoView player={player} nativeControls={false} contentFit="cover" style={s.video} />
        ) : <View style={s.video} />}

        <View style={s.info}>
          <Text style={s.name} numberOfLines={2}>{exercise?.name ?? '…'}</Text>
          <Text style={s.dose}>
            {exercise ? doseLabel(exercise, lang) : ''}
            {exercise?.dose && exercise.dose.sets > 1
              ? `  ·  ${t('session.sets', lang)} ${spokenNumber(setNo, 'en')}/${exercise.dose.sets}`
              : ''}
          </Text>
        </View>

        <View style={s.countBlock}>
          {count ? (
            <Text style={s.count}>{count}</Text>
          ) : (
            <Text style={s.countIdle}>
              {phaseOfSet === 'rest'
                ? (lang === 'hi' ? 'आराम…' : 'rest…')
                : exercise && !exercise.dose
                  ? t('session.followVideo', lang)
                  : '…'}
            </Text>
          )}
        </View>

        <View style={s.actions}>
          <Pressable onPress={() => advance(index)} accessibilityRole="button" style={s.next}>
            <Text style={s.nextText}>
              {plan && index + 1 >= plan.exercises.length
                ? t('session.finish', lang)
                : t('session.next', lang)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { clearTimers(); Speech.stop(); router.push('/chat' as never); }}
            accessibilityRole="button" style={s.hurts}>
            <Text style={s.hurtsText}>{t('session.hurts', lang)}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#10160F' },
  fillLight: { flex: 1, backgroundColor: tk.palette.paper.base },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tk.space(4), paddingVertical: tk.space(3),
  },
  topLabel: { ...tk.type.scale.eyebrow, color: '#C9C4B6', textTransform: 'uppercase' },
  close: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(247,245,240,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  video: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#000' },
  info: { paddingHorizontal: tk.space(6), paddingTop: tk.space(4), gap: 4 },
  name: { ...tk.type.scale.title, ...tk.type.display, color: '#F7F5F0' },
  dose: { ...tk.type.scale.body, color: '#C9C4B6' },
  countBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: {
    fontSize: 96, lineHeight: 104, fontWeight: '700',
    color: phaseColor('2'), fontVariant: ['tabular-nums'],
  },
  countIdle: { ...tk.type.scale.heading, color: '#6B7365' },
  actions: { padding: tk.space(6), gap: tk.space(3) },
  next: {
    minHeight: 56, borderRadius: tk.radius.button,
    backgroundColor: tk.palette.paper.base,
    alignItems: 'center', justifyContent: 'center',
  },
  nextText: { ...tk.type.scale.label, fontSize: 18, color: tk.palette.ink.primary },
  hurts: {
    minHeight: 52, borderRadius: tk.radius.button,
    borderWidth: 1, borderColor: '#4A5443',
    alignItems: 'center', justifyContent: 'center',
  },
  hurtsText: { ...tk.type.scale.label, color: '#E8B4A0' },
  completeBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tk.space(8), gap: tk.space(4) },
  ring: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 10, borderColor: tk.palette.success,
    alignItems: 'center', justifyContent: 'center',
  },
  completeTitle: { ...tk.type.scale.title, ...tk.type.display, color: tk.palette.ink.primary },
  completeSub: { ...tk.type.scale.body, color: tk.palette.ink.muted, textAlign: 'center' },
  painBlock: { alignItems: 'center', gap: tk.space(3), marginTop: tk.space(2) },
  painQ: { ...tk.type.scale.label, color: tk.palette.ink.primary },
  painRow: { flexDirection: 'row', gap: tk.space(2.5) },
  painBtn: {
    width: 72, height: 52, borderRadius: tk.radius.button,
    backgroundColor: tk.palette.paper.card,
    borderWidth: 1, borderColor: tk.palette.paper.line,
    alignItems: 'center', justifyContent: 'center',
  },
  painText: { ...tk.type.scale.label, color: tk.palette.ink.primary },
  savedText: { fontSize: 32, color: tk.palette.success },
  doneBtn: {
    minHeight: 56, borderRadius: tk.radius.button, alignSelf: 'stretch',
    backgroundColor: tk.palette.accent.interactive,
    alignItems: 'center', justifyContent: 'center', marginTop: tk.space(4),
  },
  doneBtnText: { ...tk.type.scale.label, fontSize: 18, color: tk.palette.accent.interactiveInk },
});
