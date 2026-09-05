// The exercise library — the design's Library board, rendered from
// `GET /knee/program*` and nothing else. The screen states the server's
// count verbatim ("20 exercises — the complete set" only when the server's
// completeness cross-check says so), renders rows in server order, and
// offers play only where footage exists.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { setStatusBarStyle } from 'expo-status-bar';

import { fetchPhase, fetchProgram } from '@/lib/api';
import {
  exerciseRows,
  phaseSubtitle,
  type ExerciseRow,
  type WirePhaseDetail,
  type WireProgram,
} from '@/lib/library-view';
import { getLang, subscribeLang, t as tr } from '@/lib/i18n';
import { phaseColor, tokens as t } from '@/theme';

export default function Library() {
  useFocusEffect(useCallback(() => setStatusBarStyle('dark'), []));

  const [lang, setLangState] = useState(getLang());
  useEffect(() => subscribeLang(setLangState), []);
  const [program, setProgram] = useState<WireProgram | null>(null);
  const [phase, setPhase] = useState('2');
  const [detail, setDetail] = useState<WirePhaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (ph: string) => {
    setError(null);
    try {
      const [overview, d] = await Promise.all([fetchProgram(), fetchPhase(ph)]);
      setProgram(overview);
      setDetail(d);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, []);

  useEffect(() => {
    void load(phase);
  }, [phase, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(phase);
    setRefreshing(false);
  }, [phase, load]);

  const current = program?.phases.find((p) => p.phase === phase) ?? null;
  const rows = detail && detail.phase === phase ? exerciseRows(detail) : [];
  const accent = phaseColor(phase);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.title}>Exercise library</Text>

        {/* phase segmented control */}
        <View style={s.segment}>
          {(program?.phases ?? []).map((p) => {
            const on = p.phase === phase;
            return (
              <Pressable
                key={p.phase}
                onPress={() => setPhase(p.phase)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.segmentItem, on && s.segmentOn]}
              >
                <Text style={[s.segmentText, on && s.segmentTextOn]}>
                  Phase {p.phase}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {current ? (
          <View style={s.phaseHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.phaseName, { color: accent }]}>
                Phase {current.phase} · {current.name}
              </Text>
              <Text style={s.phaseSub}>{phaseSubtitle(current)}</Text>
            </View>
          </View>
        ) : null}

        {/* About row — strategy/plan videos, ON TOP, never counted
            (owner ruling 2026-09-05; served separately as `about`). */}
        {detail && detail.phase === phase && detail.about?.length ? (
          <View style={s.card}>
            {detail.about.map((a, i) => (
              <Pressable
                key={`about:${i}`}
                onPress={() => a.url && router.push({
                  pathname: '/player',
                  params: {
                    name: a.name, url: a.url,
                    start: a.start_seconds == null ? '' : String(a.start_seconds),
                    end: '', hindi: a.dub_langs.includes('hi') ? '1' : '',
                  },
                } as never)}
                disabled={!a.url}
                accessibilityRole={a.url ? 'button' : undefined}
                style={[s.row, i < (detail.about?.length ?? 0) - 1 && s.rowLine]}
              >
                <View style={[s.thumb, { backgroundColor: '#3A4632' }]}>
                  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                    <Path d="M9 4v6M9 12.5v1" stroke="rgba(247,245,240,0.92)"
                      strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowName} numberOfLines={2}>{a.name}</Text>
                  <Text style={s.rowClock}>{tr('library.about', lang)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error ? (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable onPress={() => void load(phase)} style={s.retry}
              accessibilityRole="button">
              <Text style={s.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.card}>
          {rows.map((row, i) => (
            <ExerciseLine key={row.key} row={row} last={i === rows.length - 1} accent={accent} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseLine({ row, last, accent }: { row: ExerciseRow; last: boolean; accent: string }) {
  const open = () => {
    if (!row.playable || !row.url) return;
    router.push({
      pathname: '/player',
      params: {
        name: row.name,
        url: row.url,
        start: row.startSeconds == null ? '' : String(row.startSeconds),
        end: row.endSeconds == null ? '' : String(row.endSeconds),
        hindi: row.hasHindi ? '1' : '',
      },
    } as never);
  };
  return (
    <Pressable
      onPress={open}
      disabled={!row.playable}
      accessibilityRole={row.playable ? 'button' : undefined}
      style={[s.row, !last && s.rowLine]}
    >
      <View style={[s.thumb, !row.playable && s.thumbOff]}>
        {row.playable ? (
          <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
            <Path d="M6 4 14 9 6 14Z" fill="rgba(247,245,240,0.92)" />
          </Svg>
        ) : null}
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowName} numberOfLines={2}>{row.name}</Text>
        <View style={s.rowMeta}>
          {row.clock ? <Text style={s.rowClock}>at {row.clock}</Text> : null}
          {row.hasHindi ? (
            <View style={[s.langBadge, { borderColor: accent }]}>
              <Text style={[s.langBadgeText, { color: accent }]}>EN + हिन्दी</Text>
            </View>
          ) : null}
          {!row.playable ? <Text style={s.rowClock}>no footage yet</Text> : null}
        </View>
      </View>
      {row.playable ? (
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Circle cx={11} cy={11} r={10} stroke={t.palette.paper.line} strokeWidth={2} />
          <Path d="M8.4 6.8 14 11l-5.6 4.2V6.8Z" fill={t.palette.ink.muted} />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.palette.paper.base },
  scroll: { padding: t.space(6), paddingBottom: t.space(10), gap: t.space(3.5) },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  segment: {
    flexDirection: 'row',
    gap: t.space(1.5),
    backgroundColor: '#EEEBE2',
    borderRadius: t.radius.button,
    padding: 5,
  },
  segmentItem: {
    flex: 1,
    minHeight: t.size.disc,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
  },
  segmentText: { ...t.type.scale.body, color: t.palette.ink.muted },
  segmentTextOn: { color: t.palette.ink.primary, fontWeight: '700' },
  phaseHeader: { flexDirection: 'row', alignItems: 'center' },
  phaseName: { ...t.type.scale.heading },
  phaseSub: { ...t.type.scale.sub, color: t.palette.ink.muted, marginTop: 2 },
  errorCard: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.card,
    padding: t.space(4.5),
    gap: t.space(3),
  },
  errorText: { ...t.type.scale.body, color: t.palette.ink.secondary },
  retry: {
    minHeight: t.size.disc,
    borderRadius: t.radius.button,
    backgroundColor: t.palette.accent.interactive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space(5),
    alignSelf: 'flex-start',
  },
  retryText: { ...t.type.scale.label, color: t.palette.accent.interactiveInk },
  card: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1,
    borderColor: t.palette.paper.line,
    borderRadius: t.radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3.5),
    paddingHorizontal: t.space(4),
    paddingVertical: t.space(3),
    minHeight: 56,
  },
  rowLine: { borderBottomWidth: 1, borderBottomColor: '#F0EDE5' },
  thumb: {
    width: t.size.thumb,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#26301F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOff: { backgroundColor: '#EEEBE2' },
  rowBody: { flex: 1, gap: 3 },
  rowName: { ...t.type.scale.label, color: t.palette.ink.primary },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: t.space(2) },
  rowClock: { ...t.type.scale.sub, color: t.palette.ink.muted },
  langBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  langBadgeText: { ...t.type.scale.caption, fontWeight: '700' },
});
