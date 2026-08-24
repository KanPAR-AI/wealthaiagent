// Screen 1 — Splash / Onboarding, as the board draws it (docs/astral-board/
// 01-splash-onboarding.png; docs/49 ASTRAL-123): the cosmic field, the serif
// wordmark in a gold ring, the positioning line, the gold "Get Started" and
// the log-in line. Campaign-parameterised entry variants are ASTRAL-123's
// later clause; this is the base frame.
//
// A returning user skips the ceremony: the flag flips the first time they
// proceed, and the entry route becomes a redirect. The chart-reveal arc
// (details → cast → reveal) arrives with PH-11/12's birth-details form.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { track } from '@/lib/analytics';
import { tokens } from '@/theme';

const ENTERED_KEY = 'astro.entered';

/** Deterministic star field — index-hashed positions, no Math.random, so the
 *  frame is stable across renders and snapshot tests. */
function stars(count: number, w: number, h: number) {
  const out: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const x = (i * 73) % 97 / 97 * w;
    const y = (i * 151) % 89 / 89 * h * 0.72;
    out.push({ x, y, r: i % 5 === 0 ? 1.6 : 0.9, o: 0.35 + ((i * 37) % 50) / 100 });
  }
  return out;
}

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const [checked, setChecked] = useState(false);

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

  const ringR = Math.min(width * 0.42, 175);

  return (
    <View style={s.field}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="38%" r="75%">
            <Stop offset="0%" stopColor={tokens.palette.cosmic.glow} />
            <Stop offset="55%" stopColor={tokens.palette.cosmic.base} />
            <Stop offset="100%" stopColor={tokens.palette.cosmic.deep} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#glow)" />
        {stars(70, width, height).map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r}
            fill={tokens.palette.accent.ceremonial} opacity={st.o} />
        ))}
        <Circle cx={width / 2} cy={height * 0.38} r={ringR}
          stroke={tokens.palette.accent.ceremonial} strokeWidth={1.2}
          opacity={0.75} fill="none" />
      </Svg>

      <SafeAreaView style={s.safe}>
        <View style={s.hero}>
          <Text style={s.wordmark}>{tokens.wordmark}</Text>
          <Text style={s.tagline}>{tokens.tagline}</Text>
          <Text style={s.sub}>Understand your path.{'\n'}Align with the cosmos.</Text>
        </View>

        <View style={s.foot}>
          <Pressable style={s.cta} onPress={() => begin('/chat')}
            accessibilityRole="button" accessibilityLabel="Get Started">
            <Text style={s.ctaText}>Get Started</Text>
          </Pressable>
          <Pressable onPress={() => begin('/settings')} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Log in">
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
  safe: { flex: 1, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: '38%', gap: t.space(3), paddingHorizontal: t.space(8) },
  wordmark: {
    color: t.palette.ink.onCosmic,
    fontFamily: t.type.display.fontFamily,
    fontWeight: t.type.display.weight,
    fontSize: t.type.scale.hero,
    letterSpacing: 0.5,
  },
  tagline: {
    color: t.palette.ink.onCosmic,
    fontFamily: t.type.display.fontFamily,
    fontSize: t.type.scale.title,
    textAlign: 'center',
  },
  sub: {
    color: t.palette.ink.onCosmicMuted,
    fontSize: t.type.scale.sub,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: t.space(2),
  },
  foot: { alignItems: 'center', gap: t.space(4), paddingBottom: t.space(6), paddingHorizontal: t.space(6) },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(4),
    alignItems: 'center',
  },
  ctaText: { color: t.palette.accent.ceremonialInk, fontSize: t.type.scale.body, fontWeight: '600' },
  login: { color: t.palette.ink.onCosmicMuted, fontSize: t.type.scale.sub },
  loginLink: { color: t.palette.accent.ceremonial, fontWeight: '600' },
});
