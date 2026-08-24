// Screen 1 — Splash / Onboarding, as the board draws it (docs/astral-board/
// 01-splash-onboarding.png; docs/49 ASTRAL-123): the cosmic field, the serif
// wordmark inside a beaded gold ring, the positioning lines, the gold
// "Get Started" and the log-in line.
//
// Campaign-parameterised entry (four to six distinct flows, §4.2) is
// ASTRAL-123's other clause and is NOT deferred on engineering: it is
// awaiting the owner's sign-off on decision 13. Deliberately not guessed —
// a variant that promises what the build cannot draw is the row's own
// negative space.
//
// The board's illustration (mountains, water, the seated figure) is a
// commissioned asset that does not exist. Everything else in the frame is
// drawn: the field, the star clusters, the sparkle bursts, the ringed planet,
// the beaded ring and the warm horizon that keeps the lower half from reading
// as an empty rectangle. When the artwork lands it drops in behind these.
//
// A returning user skips the ceremony: the flag flips the first time they
// proceed, and the entry route becomes a redirect. The chart-reveal arc
// (details → cast → reveal) arrives with PH-11/12's birth-details form.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BeadedRing,
  Horizon,
  RingedPlanet,
  SkyDefs,
  SkyField,
  Sparkle,
  Stars,
} from '@/components/sky';
import { track } from '@/lib/analytics';
import { tokens } from '@/theme';

const ENTERED_KEY = 'astro.entered';

/** Where the board hangs its three bursts and its planet, as fractions. */
const SPARKLES: [number, number, number][] = [
  [0.14, 0.115, 13],
  [0.93, 0.218, 15],
  [0.51, 0.176, 6],
];
const PLANET: [number, number] = [0.79, 0.12];

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const [checked, setChecked] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ENTERED_KEY).then((v) => {
      if (v) router.replace('/chat');
      else {
        setChecked(true);
        track('onboarding_shown');
      }
    }).catch(() => setChecked(true));
  }, []);

  const begin = (to: '/chat' | '/settings') => {
    void AsyncStorage.setItem(ENTERED_KEY, '1');
    track('onboarding_proceed', { to });
    router.replace(to);
  };

  if (!checked) return <View style={s.field} />;

  // Frame 1's ring spans ~89% of the screen width and is centred a little
  // above the middle; the hero sits optically centred INSIDE it rather than
  // at a fixed margin, which is why the block is measured.
  const ringR = Math.min(width * 0.445, 190);
  const ringCx = width * 0.52;
  const ringCy = height * 0.357;

  return (
    <View style={s.field}>
      <StatusBar style="light" />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <SkyDefs id="entry" />
        <SkyField id="entry" width={width} height={height} />
        <Horizon id="entry" width={width} height={height} />
        <Stars width={width} height={height} />
        <BeadedRing cx={ringCx} cy={ringCy} r={ringR} />
        <RingedPlanet x={width * PLANET[0]} y={height * PLANET[1]} r={width * 0.05} />
        {SPARKLES.map(([x, y, size], i) => (
          <Sparkle key={i} x={width * x} y={height * y} size={size} />
        ))}
      </Svg>

      <SafeAreaView style={s.safe}>
        <View
          style={[s.hero, heroHeight ? { top: ringCy - heroHeight / 2 } : s.heroHidden]}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
        >
          <Text style={s.wordmark}>{tokens.wordmark}</Text>
          <Text style={s.tagline}>{tokens.tagline}</Text>
          <Text style={s.sub}>Understand your path.{'\n'}Align with the cosmos.</Text>
        </View>

        <View style={s.foot}>
          <Pressable style={s.cta} onPress={() => begin('/chat')}
            accessibilityRole="button" accessibilityLabel="Get Started">
            {/* Flat ceremonial fill, rim as a border: the board's vertical
                gold gradient was painted in SVG here, but react-native-svg
                composites its layer above sibling Text regardless of zIndex
                (sim pass, defect A) — a gradient nobody can read the button
                through is worse than a flat gold everyone can. The goldCta
                gradient token still paints non-interactive art. */}
            <Text style={s.ctaText}>Get Started</Text>
          </Pressable>

          <Pressable onPress={() => begin('/settings')} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Log in">
            {/* One cream string with a bold link inside it — the board does not
                colour this line gold; gold is reserved for ceremony. */}
            <Text style={s.login}>
              Already have an account? <Text style={s.loginLink}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  field: { flex: 1, backgroundColor: t.palette.cosmic.deep },
  safe: { flex: 1, justifyContent: 'flex-end' },
  hero: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: t.space(3),
    paddingHorizontal: t.space(8),
  },
  /** first paint only, before the block has been measured */
  heroHidden: { opacity: 0 },
  wordmark: {
    ...t.type.scale.hero,
    ...t.type.display,
    color: t.palette.ink.onCosmic,
  },
  tagline: {
    // SANS semibold: the serif is the WORDMARK's, and using it for the
    // tagline too made the two compete (F26 — one display face, one job).
    ...t.type.scale.title,
    color: t.palette.ink.onCosmic,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    ...t.type.scale.sub,
    color: t.palette.ink.onCosmicMuted,
    textAlign: 'center',
    marginTop: t.space(2),
  },
  foot: { alignItems: 'center', gap: t.space(4), paddingBottom: t.space(6), paddingHorizontal: t.space(6) },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: t.palette.accent.ceremonial,
    borderColor: t.gradients.goldCta.rim,
    borderWidth: 1,
    borderRadius: t.radius.button,
    paddingVertical: t.space(4),
    alignItems: 'center',
  },
  ctaText: {
    ...t.type.scale.body,
    color: t.palette.accent.ceremonialInk,
    fontWeight: '600',
  },
  login: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  loginLink: { color: t.palette.ink.onCosmic, fontWeight: '700' },
});
