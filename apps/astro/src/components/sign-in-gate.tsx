// The gate CARD a reading tab renders in place of its content when the
// viewer is a guest (owner ruling, 2026-09-12: sign-in is mandatory for
// any reading). One component so the sentence is the same on every
// surface; the decision strings live in lib/auth-gate.ts, tested at the
// root. Pushed reading screens redirect instead — see useReadingGate.

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GATE_BODY, GATE_CTA, GATE_TITLE } from '@/lib/auth-gate';
import { tokens } from '@/theme';

export function SignInGateCard({ dark = false }: { dark?: boolean }) {
  return (
    <View style={[s.card, dark && s.cardDark]}>
      <Text style={[s.title, dark && s.titleDark]}>{GATE_TITLE}</Text>
      <Text style={[s.body, dark && s.bodyDark]}>{GATE_BODY}</Text>
      <Pressable
        style={s.cta}
        onPress={() => router.push('/sign-in')}
        accessibilityRole="button"
        accessibilityLabel={GATE_CTA}
      >
        <Text style={s.ctaText}>{GATE_CTA}</Text>
      </Pressable>
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  card: {
    backgroundColor: t.palette.paper.card,
    borderWidth: 1, borderColor: t.palette.paper.line,
    borderRadius: t.radius.card,
    padding: t.space(5), gap: t.space(3),
  },
  cardDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  title: { ...t.type.display, ...t.type.scale.lead,
           color: t.palette.ink.primary },
  titleDark: { color: t.palette.ink.onCosmic },
  body: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  bodyDark: { color: t.palette.ink.onCosmicMuted },
  cta: {
    backgroundColor: t.palette.accent.ceremonial,
    borderRadius: t.radius.button,
    paddingVertical: t.space(3.5), alignItems: 'center',
    marginTop: t.space(1),
  },
  ctaText: { ...t.type.scale.label, color: t.palette.accent.ceremonialInk },
});
