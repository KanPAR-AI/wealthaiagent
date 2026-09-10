// The exercise player — the design's "loops this move" rule made real:
// plays ONLY this exercise's segment of the program video (start–end from
// the corpus, carried on the route), loops it, and offers the Hindi track
// where the server declared one. The set timer / done-marking half of the
// Player board is user_progress work and ships with that store — what is
// here is complete without it (watch, loop, switch language, leave).

import { useLocalSearchParams, router } from 'expo-router';
import { useEventListener } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';

import { getLang } from '@/lib/i18n';
import { dubUrl, formatClock } from '@/lib/library-view';
import { createPlayerGate, useCachingFor } from '@/lib/player-view';
import { tokens as t } from '@/theme';

export default function Player() {
  // fullScreenModal on iOS can report a 0 top inset on first render — the
  // Back pill rendered under the status-bar clock (owner screenshot,
  // 2026-09-06). Floor it: Dynamic-Island iPhones need ~59pt.
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'ios' ? 59 : 24);
  const params = useLocalSearchParams<{
    name?: string; url?: string; start?: string; end?: string; hindi?: string;
  }>();
  const name = params.name ?? 'Exercise';
  const url = params.url ?? '';
  const start = params.start ? Number(params.start) : 0;
  const end = params.end ? Number(params.end) : null;
  const hasHindi = params.hindi === '1';

  // '' = original audio; a switch swaps the source on the SAME player and
  // restores position (the apps/mobile replaceAsync pattern). Hindi mode
  // opens ON the Hindi track when one exists — the language setting's
  // promise, kept here.
  const [lang, setLang] = useState(getLang() === 'hi' && hasHindi ? 'hi' : '');
  // useCaching stays ANDROID-only, deliberately — revisited 2026-09-10 when
  // the backend gained ETags on media 206s, and the answer is still no for
  // iOS: this `url` is the ticketed /files/corpus-media REDIRECT (302 +
  // Cache-Control: no-store by design), and the redirect is what expo-video's
  // iOS cache layer choked on — the can't-play glyph on a stream the server
  // serves fine (owner screenshot 2026-09-06; both tracks probed 206). ETags
  // make the downstream 206 cacheable; they change nothing about the
  // redirect. The full reasoning lives on CACHING_IOS in lib/player-view.ts.
  const urlFor = useMemo(() => (l: string) =>
    ({ uri: l ? dubUrl(url, l) : url,
       useCaching: useCachingFor(Platform.OS) }), [url]);

  // Seek/loop timing lives in the pure gate (lib/player-view.ts): the
  // initial #t seek used to be issued right here in the setup callback —
  // before the item was ready — so expo-video dropped it and every Library
  // tap played from 0:00, the wrong exercise (measured, 2026-09-10 RCA).
  const gate = useMemo(() => createPlayerGate(start, end), [start, end]);

  const player = useVideoPlayer(urlFor(getLang() === 'hi' && hasHindi ? 'hi' : '') as never, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  // The initial seek, applied when the player says it can honour it — once:
  // the language switch below restores its own position after replaceAsync,
  // and the second "readyToPlay" must not yank it back to the segment start.
  useEventListener(player, 'statusChange', ({ status }) => {
    const to = gate.onStatus(status);
    if (to !== null) player.currentTime = to;
  });

  // The loop: reaching the segment's end returns to its start. The clip is
  // the demonstration; leaving the screen is how you move on. The gate
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

  const switchLang = (l: string) => {
    if (l === lang) return;
    setLang(l);
    const at = player.currentTime;
    void (async () => {
      try {
        await player.replaceAsync(urlFor(l) as never);
        player.currentTime = at;
        player.play();
      } catch {
        // A failed swap leaves the current track playing — never a dead card.
      }
    })();
  };

  const span = end !== null
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
              {getLang() === 'hi' ? 'वापस' : 'Back'}
            </Text>
          </Pressable>
        </View>

        <VideoView player={player} nativeControls contentFit="contain" style={s.video} />

        <View style={s.caption}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={2}>{name}</Text>
            {span ? <Text style={s.span}>{span}</Text> : null}
          </View>
          {hasHindi ? (
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
