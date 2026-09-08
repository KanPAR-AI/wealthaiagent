// The phase experience — "which phase am I in?" (docs/57). The four-phase
// journey, a live self-assessment on Dr. David's real criteria, and the phase
// detail. Renders server content + the pure phase-view rules; derives no phase
// itself (the finder rules come from the engine).

import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlatform } from '@wealthai/core';

import { fetchProgramPhases } from '@/lib/api';
import { setPendingCoachPrompt } from '@/lib/chat-session';
import { getLang, subscribeLang, t } from '@/lib/i18n';
import { track } from '@/lib/telemetry';
import {
  evaluateFinder,
  nextPhase,
  phaseById,
  type FinderAnswers,
  type WireFinder,
  type WireFinderQuestion,
  type WirePhaseContent,
} from '@/lib/phase-view';
import { phaseColor, tokens as tk } from '@/theme';

const PHASE_KEY = 'knee.phase'; // shared with Today — one current phase per device

export default function Phase() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));
  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);

  const [phases, setPhases] = useState<WirePhaseContent[]>([]);
  const [finder, setFinder] = useState<WireFinder | null>(null);
  const [current, setCurrent] = useState<string>('1');
  const [viewing, setViewing] = useState<string>('1');
  const [findOpen, setFindOpen] = useState(false);
  const [answers, setAnswers] = useState<FinderAnswers>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { track('phase_open'); }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [res, saved] = await Promise.all([
          fetchProgramPhases(),
          getPlatform().storage.getItem(PHASE_KEY),
        ]);
        if (!alive) return;
        setPhases(res.phases);
        setFinder(res.finder);
        const cur = saved && res.phases.some((p) => p.phase === saved) ? saved : '1';
        setCurrent(cur);
        setViewing(cur);
        setError(null);
      } catch (e: any) {
        if (alive) setError(String(e?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const total = finder?.questions.length ?? 0;
  const atResult = findOpen && step >= total;
  const result = finder ? evaluateFinder(finder, answers) : current;
  const resultPhase = phaseById(phases, result);

  const openFinder = () => { setAnswers({}); setStep(0); setFindOpen(true); };
  const answer = (id: string, v: number | string) =>
    setAnswers((prev) => ({ ...prev, [id]: v }));

  const setMyPhase = (ph: string) => {
    track('find_phase_result', { phase: ph });
    void getPlatform().storage.setItem(PHASE_KEY, ph);
    setCurrent(ph);
    setViewing(ph);
    setFindOpen(false);
  };

  const detail = phaseById(phases, viewing);
  const after = phaseById(phases, viewing) ? nextPhase(phases, viewing) : undefined;
  const hue = phaseColor(viewing);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>

        <Pressable onPress={() => router.back()} accessibilityRole="button" style={s.back}>
          <Text style={s.backTxt}>‹  {t('tab.today', lang)}</Text>
        </Pressable>

        <Text style={s.eyebrow}>{t('phase.eyebrow', lang)}</Text>
        <Text style={s.title}>{t('phase.title', lang)}</Text>
        <Text style={s.sub}>{t('phase.sub', lang)}</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* the climb */}
        <View style={s.journey}>
          {phases.map((p, i) => {
            const ph = p.phase;
            const c = phaseColor(ph);
            const isHere = ph === current;
            const isView = ph === viewing;
            return (
              <View key={ph} style={s.row}>
                <View style={s.spineCol}>
                  <View style={[s.node, { backgroundColor: c }]}>
                    <Text style={s.nodeN}>{ph}</Text>
                  </View>
                  {i < phases.length - 1 ? (
                    <View style={[s.spine, { backgroundColor: c + '55' }]} />
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setViewing(ph)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isView }}
                  style={[s.card, { borderColor: isView ? c : tk.palette.paper.line,
                                    borderWidth: isView ? 2 : 1 }]}
                >
                  <View style={s.cardHead}>
                    <Text style={s.cardName}>{p.name}</Text>
                    {isHere ? (
                      <Text style={[s.hereTag, { backgroundColor: c }]}>{t('phase.youreHere', lang)}</Text>
                    ) : null}
                  </View>
                  {p.tag ? <Text style={[s.phaseTag, { color: c }]}>{p.tag}</Text> : null}
                  <Text style={s.goal}>{p.goal}</Text>
                  <Text style={[s.count, { color: c }]}>{p.count} {t('phase.exercises', lang)}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* find my phase — a card stepper, one question at a time (owner: not
            one giant form; widgets, no text input) */}
        {!findOpen ? (
          <>
            <Pressable onPress={openFinder} accessibilityRole="button" style={s.findBtn}>
              <Text style={s.findBtnTxt}>{t('phase.find', lang)}</Text>
            </Pressable>
            <Text style={s.findSub}>{t('phase.findSub', lang)}</Text>
          </>
        ) : null}

        {findOpen && finder ? (
          <View style={s.finder}>
            <View style={s.dots}>
              {finder.questions.map((q, i) => (
                <View key={q.id} style={[s.progDot, {
                  backgroundColor: (!atResult && i <= step) || atResult
                    ? tk.palette.accent.interactive : tk.palette.paper.line }]} />
              ))}
            </View>

            {!atResult ? (
              <QuestionCard
                q={finder.questions[step]}
                value={answers[finder.questions[step].id]}
                onAnswer={(v) => answer(finder.questions[step].id, v)}
              />
            ) : resultPhase ? (
              <View style={[s.result, { borderColor: phaseColor(result) }]}>
                <View style={[s.resultDisc, { backgroundColor: phaseColor(result) }]}>
                  <Text style={s.resultN}>{result}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.resultLbl, { color: phaseColor(result) }]}>{t('phase.result', lang)}</Text>
                  <Text style={s.resultName}>{t('library.phase', lang)} {result} · {resultPhase.name}</Text>
                </View>
              </View>
            ) : null}

            <View style={s.nav}>
              <Pressable
                onPress={() => (atResult ? setStep(total - 1)
                  : step > 0 ? setStep(step - 1) : setFindOpen(false))}
                accessibilityRole="button" style={s.navBack}
              >
                <Text style={s.navBackTxt}>
                  {atResult ? t('phase.back', lang)
                    : step > 0 ? t('phase.back', lang) : t('phase.close', lang)}
                </Text>
              </Pressable>
              {!atResult ? (
                <Pressable
                  onPress={() => setStep(step + 1)}
                  disabled={answers[finder.questions[step].id] === undefined}
                  accessibilityRole="button"
                  style={[s.navNext, answers[finder.questions[step].id] === undefined && { opacity: 0.4 }]}
                >
                  <Text style={s.navNextTxt}>
                    {step === total - 1 ? t('phase.seeResult', lang) : t('phase.next', lang)}
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setMyPhase(result)} accessibilityRole="button" style={s.navNext}>
                  <Text style={s.navNextTxt}>{t('phase.setPhase', lang)}</Text>
                </Pressable>
              )}
            </View>
            {atResult ? <Text style={s.disclaimer}>{t('phase.notDiagnosis', lang)}</Text> : null}
          </View>
        ) : null}

        {/* the viewed phase's detail */}
        {detail ? (
          <View style={s.detail}>
            <View style={[s.detailBanner, { backgroundColor: hue }]}>
              <Text style={s.detailLbl}>
                {(viewing === current ? t('phase.youreHere', lang) : t('phase.viewing', lang))} · {t('library.phase', lang)} {viewing}
              </Text>
              <Text style={s.detailName}>{detail.name}</Text>
              <Text style={s.detailGoal}>{detail.goal}</Text>
            </View>

            <Text style={s.dh}>{t('phase.forThis', lang)}</Text>
            {detail.focus.map((f, i) => (
              <View key={i} style={s.focusRow}>
                <View style={[s.dot, { backgroundColor: hue }]} />
                <Text style={s.focusTxt}>{f}</Text>
              </View>
            ))}

            <Text style={s.dh}>{t('phase.whyHere', lang)}</Text>
            <View style={s.chips}>
              {detail.criteria.map((c, i) => (
                <Text key={i} style={s.chip}>{c}</Text>
              ))}
            </View>

            {after && detail.exit.length ? (
              <>
                <Text style={s.dh}>{t('phase.intoNext', lang)} {t('library.phase', lang)} {after.phase} · {after.name}</Text>
                {detail.exit.map((e, i) => (
                  <View key={i} style={s.focusRow}>
                    <View style={[s.ring, { borderColor: phaseColor(after.phase) }]} />
                    <Text style={s.focusTxt}>{e}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {detail.strategy_video?.url ? (
              <Pressable
                onPress={() => router.push({
                  pathname: '/player',
                  params: { name: detail.strategy_video!.title, url: detail.strategy_video!.url!,
                            start: String(detail.strategy_video!.start_seconds ?? 0) },
                } as never)}
                accessibilityRole="button"
                style={[s.video, { backgroundColor: hue }]}
              >
                <View style={s.playDisc}>
                  <Text style={[s.playTri, { color: tk.palette.accent.interactive }]}>▶</Text>
                </View>
                <Text style={s.videoTxt}>{t('phase.watchBrief', lang)}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setPendingCoachPrompt(
                  `I'm looking at Phase ${detail.phase} (${detail.name}) of the knee `
                  + 'program. Can you explain what it means for me and what to focus on?');
                router.push('/chat' as never);
              }}
              accessibilityRole="button" style={s.askCoach}
            >
              <Text style={s.askCoachTxt}>{t('phase.askCoach', lang)}  ›</Text>
            </Pressable>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

function QuestionCard({ q, value, onAnswer }: {
  q: WireFinderQuestion;
  value: number | string | undefined;
  onAnswer: (v: number | string) => void;
}) {
  const pine = tk.palette.accent.interactive;
  return (
    <View style={cs.card}>
      <Text style={cs.prompt}>{q.prompt}</Text>

      {q.kind === 'scale' ? (
        <>
          <View style={cs.scale}>
            {Array.from({ length: (q.max ?? 7) + 1 }, (_, n) => {
              const on = value === n;
              return (
                <Pressable key={n} onPress={() => onAnswer(n)} accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[cs.step, { backgroundColor: on ? pine : tk.palette.paper.base,
                                     borderColor: on ? pine : tk.palette.paper.line }]}>
                  <Text style={[cs.stepN, on && { color: '#FFFFFF', fontWeight: '700' }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={cs.scaleUnit}>
            {value === undefined ? `0–${q.max} ${q.unit ?? ''}`.trim()
              : `${value} ${q.unit ?? ''}`.trim()}
          </Text>
        </>
      ) : (
        <View style={cs.opts}>
          {(q.options ?? []).map((o) => {
            const on = value === o.value;
            return (
              <Pressable key={o.value} onPress={() => onAnswer(o.value)} accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[cs.opt, { borderColor: on ? pine : tk.palette.paper.line,
                                  borderWidth: on ? 2 : 1,
                                  backgroundColor: on ? '#EEF1EC' : tk.palette.paper.card }]}>
                <View style={[cs.radio, { borderColor: on ? pine : '#C7CBC0' }]}>
                  {on ? <View style={[cs.radioDot, { backgroundColor: pine }]} /> : null}
                </View>
                <Text style={cs.optLbl}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  card: { backgroundColor: tk.palette.paper.card, borderWidth: 1, borderColor: tk.palette.paper.line,
          borderRadius: 18, padding: tk.space(5), gap: tk.space(4) },
  prompt: { ...tk.type.scale.heading, ...tk.type.display, color: tk.palette.ink.primary },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: tk.space(2), justifyContent: 'space-between' },
  step: { width: 40, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepN: { ...tk.type.scale.label, color: tk.palette.ink.secondary },
  scaleUnit: { ...tk.type.scale.sub, color: tk.palette.ink.muted, textAlign: 'center', marginTop: -tk.space(1) },
  opts: { gap: tk.space(2.5) },
  opt: { flexDirection: 'row', alignItems: 'center', gap: tk.space(3), borderRadius: 14, padding: tk.space(4) },
  radio: { width: 22, height: 22, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioDot: { width: 10, height: 10, borderRadius: 999 },
  optLbl: { flex: 1, ...tk.type.scale.body, color: tk.palette.ink.primary, fontWeight: '600' },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tk.palette.paper.base },
  scroll: { padding: tk.space(5), paddingBottom: tk.space(12), gap: 0 },
  back: { marginBottom: tk.space(3) },
  backTxt: { ...tk.type.scale.sub, color: tk.palette.ink.muted, fontWeight: '700' },
  eyebrow: { ...tk.type.scale.eyebrow, color: tk.palette.ink.muted },
  title: { ...tk.type.scale.title, ...tk.type.display, color: tk.palette.ink.primary, marginTop: tk.space(1) },
  sub: { ...tk.type.scale.sub, color: tk.palette.ink.muted, marginTop: tk.space(1.5) },
  error: { ...tk.type.scale.sub, color: tk.palette.danger, marginTop: tk.space(3) },

  journey: { marginTop: tk.space(5), gap: tk.space(3) },
  row: { flexDirection: 'row', gap: tk.space(3.5) },
  spineCol: { width: 44, alignItems: 'center' },
  node: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nodeN: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  spine: { width: 3, flex: 1, marginTop: 2, borderRadius: 2 },
  card: { flex: 1, backgroundColor: tk.palette.paper.card, borderRadius: 16, padding: tk.space(4) },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: tk.space(2) },
  cardName: { ...tk.type.scale.heading, ...tk.type.display, color: tk.palette.ink.primary },
  hereTag: { marginLeft: 'auto', color: '#FFFFFF', fontSize: 10, fontWeight: '700',
             letterSpacing: 0.5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  phaseTag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginTop: tk.space(1) },
  goal: { ...tk.type.scale.sub, color: tk.palette.ink.secondary, marginTop: tk.space(1.5) },
  count: { fontSize: 13, fontWeight: '600', marginTop: tk.space(2) },

  findBtn: { marginTop: tk.space(5), backgroundColor: tk.palette.accent.interactive,
             height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  findBtnTxt: { ...tk.type.scale.label, color: tk.palette.accent.interactiveInk },
  findSub: { ...tk.type.scale.caption, color: tk.palette.ink.muted, textAlign: 'center', marginTop: tk.space(3) },

  finder: { marginTop: tk.space(4) },
  dots: { flexDirection: 'row', gap: tk.space(1.5), marginBottom: tk.space(3.5), justifyContent: 'center' },
  progDot: { height: 6, flex: 1, borderRadius: 999, maxWidth: 60 },
  nav: { flexDirection: 'row', gap: tk.space(3), marginTop: tk.space(4) },
  navBack: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
             borderWidth: 1.5, borderColor: tk.palette.paper.line },
  navBackTxt: { ...tk.type.scale.label, color: tk.palette.ink.secondary },
  navNext: { flex: 2, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
             backgroundColor: tk.palette.accent.interactive },
  navNextTxt: { ...tk.type.scale.label, color: tk.palette.accent.interactiveInk },
  result: { flexDirection: 'row', alignItems: 'center', gap: tk.space(3.5), marginTop: tk.space(4),
            borderWidth: 1.5, borderRadius: 18, padding: tk.space(4), backgroundColor: tk.palette.paper.card },
  resultDisc: { width: 54, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  resultN: { color: '#FFFFFF', fontWeight: '700', fontSize: 22 },
  resultLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  resultName: { ...tk.type.scale.heading, ...tk.type.display, color: tk.palette.ink.primary },
  setBtn: { marginTop: tk.space(3.5), backgroundColor: tk.palette.accent.interactive,
            height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  setBtnTxt: { ...tk.type.scale.label, color: tk.palette.accent.interactiveInk },
  disclaimer: { ...tk.type.scale.caption, color: tk.palette.ink.muted, textAlign: 'center', marginTop: tk.space(3) },

  detail: { marginTop: tk.space(6) },
  detailBanner: { borderRadius: 20, padding: tk.space(5) },
  detailLbl: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, opacity: 0.92 },
  detailName: { ...tk.type.scale.title, ...tk.type.display, color: '#FFFFFF', marginTop: tk.space(1.5) },
  detailGoal: { ...tk.type.scale.sub, color: '#FFFFFF', opacity: 0.95, marginTop: tk.space(2) },
  dh: { ...tk.type.scale.label, ...tk.type.display, color: tk.palette.ink.primary,
        marginTop: tk.space(5), marginBottom: tk.space(2.5) },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tk.space(3), marginBottom: tk.space(2.5) },
  dot: { width: 10, height: 10, borderRadius: 999, marginTop: 6 },
  ring: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, marginTop: 2 },
  focusTxt: { flex: 1, ...tk.type.scale.body, color: tk.palette.ink.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tk.space(2) },
  chip: { ...tk.type.scale.caption, color: tk.palette.ink.secondary, fontWeight: '600',
          backgroundColor: tk.palette.paper.card, borderWidth: 1, borderColor: tk.palette.paper.line,
          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  video: { flexDirection: 'row', alignItems: 'center', gap: tk.space(3), marginTop: tk.space(4),
           borderRadius: 16, padding: tk.space(4) },
  playDisc: { width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)',
              alignItems: 'center', justifyContent: 'center' },
  playTri: { fontSize: 16 },
  videoTxt: { ...tk.type.scale.label, color: '#FFFFFF' },
  askCoach: { alignSelf: 'flex-start', marginTop: tk.space(4), paddingVertical: tk.space(1) },
  askCoachTxt: { ...tk.type.scale.sub, color: tk.palette.accent.interactive, fontWeight: '700' },
});
