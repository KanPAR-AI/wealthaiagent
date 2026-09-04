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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';

import { dubUrl, formatClock } from '@/lib/library-view';
import { tokens as t } from '@/theme';

export default function Player() {
  const params = useLocalSearchParams<{
    name?: string; url?: string; start?: string; end?: string; hindi?: string;
  }>();
  const name = params.name ?? 'Exercise';
  const url = params.url ?? '';
  const start = params.start ? Number(params.start) : 0;
  const end = params.end ? Number(params.end) : null;
  const hasHindi = params.hindi === '1';

  // '' = original audio; a switch swaps the source on the SAME player and
  // restores position (the apps/mobile replaceAsync pattern).
  const [lang, setLang] = useState('');
  const urlFor = useMemo(() => (l: string) => (l ? dubUrl(url, l) : url), [url]);

  const player = useVideoPlayer(urlFor(''), (p) => {
    if (start > 0) p.currentTime = start;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  // The loop: reaching the segment's end returns to its start. The clip is
  // the demonstration; leaving the screen is how you move on.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (end !== null && currentTime >= end) {
      player.currentTime = start;
    }
  });

  const switchLang = (l: string) => {
    if (l === lang) return;
    setLang(l);
    const at = player.currentTime;
    void (async () => {
      try {
        await player.replaceAsync(urlFor(l));
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
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={s.close}
          >
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Path d="M5 5l10 10M15 5 5 15" stroke="#F7F5F0" strokeWidth={2} strokeLinecap="round" />
            </Svg>
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
