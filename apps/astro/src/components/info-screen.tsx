// The shape every leaf screen behind a settings row takes: the cosmic strip
// at the top with a back chevron, then the light sheet with prose.
//
// One component, because Privacy, Help and About are the same screen with
// different words, and three copies of a header is how three headers end up
// different.

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft } from '@/components/glyphs';
import { SkyDefs, SkyField, Stars } from '@/components/sky';
import { tokens } from '@/theme';

const STRIP = 120;

export function InfoScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      <View style={s.strip}>
        <Svg width="100%" height={STRIP}>
          <SkyDefs id="info" />
          <SkyField id="info" width={2000} height={STRIP} />
          <Stars width={2000} height={STRIP} until={0.28} scale={0.7} />
        </Svg>
      </View>
      <SafeAreaView style={s.fill} edges={['top']}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <ChevronLeft size={tokens.size.icon} color={tokens.palette.ink.onCosmic} />
        </Pressable>
        <ScrollView style={s.sheet} contentContainerStyle={s.body}>
          <Text style={s.title}>{title}</Text>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** A paragraph of the screen's own prose. */
export function Para({ children }: { children: ReactNode }) {
  return <Text style={s.para}>{children}</Text>;
}

/** A short heading over a group of paragraphs. */
export function Head({ children }: { children: ReactNode }) {
  return <Text style={s.head}>{children}</Text>;
}

/** One line of a plain list — used for "what this holds" and "what it does not". */
export function Item({ children }: { children: ReactNode }) {
  return (
    <View style={s.item}>
      <View style={s.bullet} />
      <Text style={s.itemText}>{children}</Text>
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: t.palette.paper.base },
  strip: {
    position: 'absolute', top: 0, left: 0, right: 0, height: STRIP,
    backgroundColor: t.palette.cosmic.deep,
    overflow: 'hidden',
  },
  back: { paddingHorizontal: t.space(3), paddingVertical: t.space(2), alignSelf: 'flex-start' },
  sheet: {
    flex: 1,
    marginTop: t.space(3),
    backgroundColor: t.palette.paper.base,
    borderTopLeftRadius: t.radius.card,
    borderTopRightRadius: t.radius.card,
  },
  body: { padding: t.space(5), paddingBottom: t.space(12), gap: t.space(3) },
  title: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.primary },
  head: {
    ...t.type.scale.caption,
    color: t.palette.ink.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: t.space(2),
  },
  para: { ...t.type.scale.sub, color: t.palette.ink.secondary },
  item: { flexDirection: 'row', gap: t.space(2.5), alignItems: 'flex-start' },
  bullet: {
    width: t.space(1.5), height: t.space(1.5), borderRadius: t.radius.pill,
    backgroundColor: t.palette.accent.interactive, marginTop: t.space(2),
  },
  itemText: { ...t.type.scale.sub, color: t.palette.ink.secondary, flex: 1 },
});
