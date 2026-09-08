// The follow-along session — the canvas's flagship flow made real:
// announce (EN/हिन्दी) → beat of silence → count aloud at the stored pace →
// auto-advance → one pain question → the day recorded server-side.
//
// The muted demo clip loops under the voice; the full video is one tap away.
// Every voice action has an on-screen twin (Next / Finish buttons), so the
// session is complete with the sound off.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';

import { fetchPhase, recordSession } from '@/lib/api';
import { setPendingCoachPrompt } from '@/lib/chat-session';
import { getLang, speechLocale, t, type Lang } from '@/lib/i18n';
import { track } from '@/lib/telemetry';
import {
  announcement,
  buildCustomPlan,
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
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'ios' ? 59 : 24);
  const params = useLocalSearchParams<{ phase?: string; recipe?: string; names?: string }>();
  const phase = params.phase ?? '2';
  const recipe = (params.recipe ?? 'full') as RecipeId;
  const customNames = (params.names ?? '').split('|').filter(Boolean);
  const lang = getLang();

  useEffect(() => { track('session_start', { phase, recipe }); }, [phase, recipe]);

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
  const [paused, setPaused] = useState(false);
  // The current set's context, so pause() can reschedule what's left.
  const setCtx = useRef<{ exIndex: number; whichSet: number;
                          setStart: number } | null>(null);
  const elapsedRef = useRef(0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    void fetchPhase(phase).then((d) => setPlan(
      recipe === 'custom' ? buildCustomPlan(d, customNames) : buildPlan(d, recipe)))
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
  // useCaching: expo-video's native disk cache (in the binary already; the
  // flag is JS). Clips are ~300 KB loops replayed constantly — cache hits
  // whenever the URL is unchanged (tickets rotate hourly, so within-session
  // and same-hour replays are free). A content-keyed cache that survives
  // ticket rotation needs expo-file-system and rides the next native build.
  const player = useVideoPlayer({ uri: source, useCaching: Platform.OS === 'android' }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    if (!source) return;
    void player.replaceAsync({ uri: source, useCaching: Platform.OS === 'android' }).then(() => {
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
     
  }, []);

  /** Schedule (or re-schedule from `offsetMs`) one set's cues. */
  const runSet = useCallback((exIndex: number, whichSet: number, offsetMs = 0) => {
    if (!plan) return;
    const x = plan.exercises[exIndex];
    clearTimers();
    setPhaseOfSet('counting');
    setCtx.current = { exIndex, whichSet, setStart: Date.now() - offsetMs };
    const { cues, durationS } = setCues(x, lang);
    if (!cues.length) {
      setCount(null); // follow-the-video mode: user taps Next
      return;
    }
    for (const cue of cues) {
      const at = cue.at * 1000 - offsetMs;
      if (at < 0) { if (cue.show !== undefined) setCount(cue.show); continue; }
      timers.current.push(setTimeout(() => {
        if (cue.show !== undefined) setCount(cue.show);
        if (cue.say) speak(cue.say, lang);
      }, at));
    }
    const endAt = (durationS + 1) * 1000 - offsetMs;
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
    }, Math.max(0, endAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, lang]);

  /** Halt everything, remembering how far into the current set we are. */
  const pause = useCallback(() => {
    if (paused) return;
    clearTimers();
    Speech.stop();
    try { player.pause(); } catch {}
    if (setCtx.current) elapsedRef.current = Date.now() - setCtx.current.setStart;
    setPaused(true);
  }, [paused, player]);

  const resume = useCallback(() => {
    if (!paused) return;
    setPaused(false);
    try { player.play(); } catch {}
    const c = setCtx.current;
    if (c) runSet(c.exIndex, c.whichSet, elapsedRef.current);
  }, [paused, player, runSet]);

  // Leaving the screen (Full video, coach, background) PAUSES the sequence —
  // the timer and video must not run unseen (owner-reported: Full video left
  // the sequence running). Coming back leaves it paused; resume is deliberate.
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useFocusEffect(useCallback(() => () => { pauseRef.current(); }, []));

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
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={[s.topBar, { paddingTop: topPad }]}>
          {/* Back where iOS hands expect it — top-left, labelled, leaves the
              session (owner: "back button is still not shown in iOS, make it
              easy ux"). Previous-exercise moved DOWN beside Next, into thumb
              reach. */}
          <Pressable onPress={closeAll} accessibilityRole="button"
            accessibilityLabel="Leave session" style={s.backBtn}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path d="M12.5 4 6.5 10l6 6" stroke="#F7F5F0" strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={s.backText}>{lang === 'hi' ? 'बंद करें' : 'Exit'}</Text>
          </Pressable>
          <Text style={s.topLabel}>
            {t('session.exercise', lang)} {plan ? index + 1 : '–'} / {plan?.exercises.length ?? '–'}
          </Text>
          <Pressable
            onPress={() => (paused ? resume() : pause())}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume' : 'Pause'}
            style={s.pausePill}
          >
            {paused ? (
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M5 3.5 12.5 8 5 12.5Z" fill="#F7F5F0" />
              </Svg>
            ) : (
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M5 3h2.2v10H5zM8.8 3H11v10H8.8z" fill="#F7F5F0" />
              </Svg>
            )}
            <Text style={s.pausePillText}>
              {paused ? (lang === 'hi' ? 'जारी' : 'Resume') : (lang === 'hi' ? 'रुकें' : 'Pause')}
            </Text>
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

        <Pressable
          style={s.countBlock}
          onPress={() => (paused ? resume() : pause())}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Resume' : 'Pause'}
        >
          {paused ? (
            <View style={s.pausedWrap}>
              <View style={s.playBtn}>
                <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
                  <Path d="M11 8 26 17 11 26Z" fill="#202B22" />
                </Svg>
              </View>
              <Text style={s.pausedText}>{lang === 'hi' ? 'रुका हुआ — जारी रखने के लिए टैप करें' : 'Paused — tap to resume'}</Text>
            </View>
          ) : count ? (
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
        </Pressable>

        <View style={s.actions}>
          <View style={s.navRow}>
            <Pressable
              onPress={() => index > 0 && announce(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous exercise"
              style={[s.prev, index === 0 && { opacity: 0.35 }]}
            >
              <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
                <Path d="M12.5 4 6.5 10l6 6" stroke="#F7F5F0" strokeWidth={2.2}
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable onPress={() => advance(index)} accessibilityRole="button"
              style={[s.next, { flex: 1 }]}>
              <Text style={s.nextText}>
                {plan && index + 1 >= plan.exercises.length
                  ? t('session.finish', lang)
                  : t('session.next', lang)}
              </Text>
            </Pressable>
          </View>
          {exercise?.videoUrl ? (
            <Pressable
              onPress={() => router.push({
                pathname: '/player',
                params: {
                  name: exercise.name,
                  url: exercise.videoUrl!,
                  start: String(exercise.startSeconds ?? 0),
                  end: exercise.endSeconds == null ? '' : String(exercise.endSeconds),
                  hindi: exercise.hasHindi ? '1' : '',
                },
              } as never)}
              accessibilityRole="button" style={s.watch}>
              <Text style={s.watchText}>{t('session.fullVideo', lang)} ▸</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              clearTimers();
              Speech.stop();
              // Carry the context into the coach: which exercise, which phase.
              const ex = exercise?.name;
              setPendingCoachPrompt(
                `I'm doing ${ex ? `"${ex}"` : 'my session'} in Phase ${phase} and my `
                + 'knee is hurting during it. Is that normal, and what should I adjust?');
              router.push('/chat' as never);
            }}
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
  pausePill: {
    minWidth: 92, minHeight: 44, borderRadius: 22,
    backgroundColor: 'rgba(247,245,240,0.15)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: 12,
  },
  pausePillText: { ...tk.type.scale.sub, color: '#F7F5F0', fontWeight: '700' },
  pausedWrap: { alignItems: 'center', gap: tk.space(3) },
  playBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F7F5F0',
    alignItems: 'center', justifyContent: 'center',
  },
  pausedText: { ...tk.type.scale.body, color: '#C9C4B6' },
  navRow: { flexDirection: 'row', gap: tk.space(3) },
  prev: {
    width: 56, minHeight: 56, borderRadius: tk.radius.button,
    borderWidth: 1, borderColor: '#4A5443',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    minHeight: 44, minWidth: 92, borderRadius: 22,
    backgroundColor: 'rgba(247,245,240,0.15)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: 12,
  },
  backText: { ...tk.type.scale.sub, color: '#F7F5F0', fontWeight: '700' },
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
  watch: {
    minHeight: 52, borderRadius: tk.radius.button,
    borderWidth: 1, borderColor: '#4A5443',
    alignItems: 'center', justifyContent: 'center',
  },
  watchText: { ...tk.type.scale.label, color: '#F7F5F0' },
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
