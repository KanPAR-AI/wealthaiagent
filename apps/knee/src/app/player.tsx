// The exercise player — the design's "loops this move" rule made real.
//
// CLIP-FIRST (owner ruling 2026-09-19): a Library tap opens the instant
// ~300 KB demo loop when one exists — the phone's own telemetry showed
// clips always load while full sources were slow from the US bucket and
// twice refused ("Cannot Open") on iOS. The narrated full video is ONE tap
// away ("Full video ▸"), which swaps the source on the same player and
// seeks to this exercise's segment (start–end from the corpus, carried on
// the route), looping it, with the Hindi track where the server declared
// one. The set timer / done-marking half of the Player board is
// user_progress work and ships with that store.

import { useLocalSearchParams, router } from 'expo-router';
import { useEventListener } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';

import { getLang, t as tr } from '@/lib/i18n';
import { dubUrl, formatClock } from '@/lib/library-view';
import { createPlayerGate, useCachingFor } from '@/lib/player-view';
import { track } from '@/lib/telemetry';
import { tokens as t } from '@/theme';

export default function Player() {
  // fullScreenModal on iOS can report a 0 top inset on first render — the
  // Back pill rendered under the status-bar clock (owner screenshot,
  // 2026-09-06). Floor it: Dynamic-Island iPhones need ~59pt.
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'ios' ? 59 : 24);
  const params = useLocalSearchParams<{
    name?: string; url?: string; start?: string; end?: string;
    hindi?: string; hindiUrl?: string; full?: string; mode?: string;
  }>();
  const name = params.name ?? 'Exercise';
  const url = params.url ?? '';
  const start = params.start ? Number(params.start) : 0;
  const end = params.end ? Number(params.end) : null;
  const fullUrl = params.full || url;
  // The Hindi FULL track arrives ready-made (`hindiUrl`, resolved by
  // library-view's playbackPlan — a signed URL cannot take the &kind=
  // transform). The legacy `hindi='1'` route still resolves via dubUrl for
  // pushers not yet migrated.
  const hindiFull = params.hindiUrl
    || (params.hindi === '1' && fullUrl ? dubUrl(fullUrl, 'hi') : '');
  const hasHindi = Boolean(hindiFull);

  // 'clip' plays the loop from 0 with no segment gate; 'full' is the
  // narrated source seeked to the segment. A screen only opens in clip mode
  // when it also has a full URL to offer.
  const [mode, setMode] = useState<'clip' | 'full'>(
    params.mode === 'clip' && params.full ? 'clip' : 'full');

  // '' = original audio; a switch swaps the source on the SAME player and
  // restores position (the apps/mobile replaceAsync pattern). Hindi mode
  // opens ON the Hindi track when one exists — the language setting's
  // promise, kept here. Language applies to the FULL source; clips are mute.
  const [lang, setLang] = useState(getLang() === 'hi' && hasHindi ? 'hi' : '');

  // iOS caching is per-SOURCE: on for direct storage URLs (stable 3.5–7 days,
  // content-keyed — the owner's 7-day device cache), off for the ticketed
  // redirect its cache layer choked on. player-view owns the rule.
  const srcFor = useMemo(() => (l: string, m: 'clip' | 'full') => {
    const uri = m === 'clip' ? url : (l ? hindiFull : fullUrl);
    return { uri, useCaching: useCachingFor(Platform.OS, uri) };
  }, [url, fullUrl, hindiFull]);

  // Seek/loop timing lives in the pure gate (lib/player-view.ts): the
  // initial #t seek used to be issued in the setup callback — before the
  // item was ready — so expo-video dropped it and every Library tap played
  // from 0:00, the wrong exercise (measured, 2026-09-10 RCA). Clip mode
  // needs no seek and loops the whole file.
  const gate = useMemo(
    () => createPlayerGate(mode === 'clip' ? 0 : start,
                           mode === 'clip' ? null : end),
    [mode, start, end]);

  const player = useVideoPlayer(
    srcFor(getLang() === 'hi' && hasHindi ? 'hi' : '',
           params.mode === 'clip' && params.full ? 'clip' : 'full') as never,
    (p) => {
      p.timeUpdateEventInterval = 0.25;
      p.play();
    });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    // Surface a refused load via telemetry — iOS reports load failures HERE,
    // not as promise rejections (owner iPhone 2026-09-17: crossed-out glyph
    // with zero evidence anywhere). The msg is the actual AVFoundation reason.
    if (status === 'error') {
      track('video_error', {
        where: 'player', kind: mode, lang: lang || 'en',
        msg: String((error as any)?.message ?? error ?? 'unknown').slice(0, 110),
      });
      return;
    }
    const to = gate.onStatus(status);
    if (to !== null) player.currentTime = to;
  });

  // The loop: reaching the segment's end returns to its start. The gate
  // guards re-entry — a slow seek keeps reporting past `end` for a few more
  // ticks and must not restart the seek each time.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const to = gate.onTime(currentTime);
    if (to !== null) {
      player.currentTime = to;
      player.play(); // reaching the end pauses natively; a loop must resume
    }
  });
  useEventListener(player, 'playToEnd', () => {
    player.currentTime = gate.onPlayToEnd();
    player.play();
  });

  const swapSource = (l: string, m: 'clip' | 'full', seekTo: number | null) => {
    void (async () => {
      try {
        await player.replaceAsync(srcFor(l, m) as never);
        if (seekTo !== null) player.currentTime = seekTo;
        player.play();
      } catch {
        // A failed swap leaves the current track playing — never a dead card.
      }
    })();
  };

  const switchLang = (l: string) => {
    if (l === lang || mode === 'clip') return;
    setLang(l);
    swapSource(l, 'full', player.currentTime);
  };

  // The one-tap escalation to narration: state + source + seek in one
  // gesture. The mode flip re-arms the gate for the segment loop.
  const openFullVideo = () => {
    if (mode === 'full') return;
    setMode('full');
    swapSource(lang, 'full', start);
  };

  const lg = getLang();
  const span = mode === 'clip'
    ? (lg === 'hi' ? 'छोटा लूप · पूरे वीडियो में निर्देश हैं' : 'quick loop · narration is in the full video')
    : end !== null
      ? `${formatClock(start) ?? '0:00'}–${formatClock(end)} · loops this move`
      : formatClock(start)
        ? `from ${formatClock(start)}`
        : null;

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={[s.topBar, { justifyContent: 'flex-start', paddingTop: topPad }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[s.close, { width: undefined, minWidth: 88, flexDirection: 'row', gap: 4, paddingHorizontal: 12 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path d="M12.5 4 6.5 10l6 6" stroke="#F7F5F0" strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={{ color: '#F7F5F0', fontSize: 15, fontWeight: '700' }}>
              {lg === 'hi' ? 'वापस' : 'Back'}
            </Text>
          </Pressable>
        </View>

        <VideoView player={player} nativeControls contentFit="contain" style={s.video} />

        <View style={s.caption}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={2}>{name}</Text>
            {span ? <Text style={s.span}>{span}</Text> : null}
          </View>
          {mode === 'clip' ? (
            <Pressable onPress={openFullVideo} accessibilityRole="button"
              style={s.fullBtn}>
              <Text style={s.fullBtnText}>{tr('session.fullVideo', lg)} ▸</Text>
            </Pressable>
          ) : hasHindi ? (
            <View style={s.langRow} accessibilityRole="radiogroup">
              {([['', 'EN'], ['hi', 'हिन्दी']] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => switchLang(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: lang === value }}
                  style={[s.langPill, lang === value && s.langPillOn]}
                >
                  <Text style={[s.langText, lang === value && s.langTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#10160F' },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: t.space(3) },
  close: {
    width: t.size.disc,
    height: t.size.disc,
    borderRadius: t.size.disc / 2,
    backgroundColor: 'rgba(247,245,240,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { flex: 1, backgroundColor: '#000' },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space(3),
    padding: t.space(4),
  },
  name: { ...t.type.scale.label, color: '#F7F5F0' },
  span: { ...t.type.scale.sub, color: '#C9C4B6' },
  fullBtn: {
    minHeight: t.size.disc,
    paddingHorizontal: t.space(4),
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: '#F7F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullBtnText: { ...t.type.scale.sub, color: '#F7F5F0', fontWeight: '700' },
  langRow: { flexDirection: 'row', gap: t.space(1.5) },
  langPill: {
    minHeight: t.size.disc,
    paddingHorizontal: t.space(4),
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: '#4A5443',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillOn: { backgroundColor: '#F7F5F0', borderColor: '#F7F5F0' },
  langText: { ...t.type.scale.sub, color: '#C9C4B6' },
  langTextOn: { color: '#202B22', fontWeight: '700' },
});
