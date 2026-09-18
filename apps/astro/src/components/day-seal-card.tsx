// The Day Seal — the 9:16 card a day is shared as (docs/69 loop 2).
//
// It draws ONLY a `DaySeal` (lib/share-card.ts), which is the ASTRAL-63
// allowlist made a type: verdict, stance, one window, the week's colours, the
// hook and the brand. It is mounted off-screen on Home and photographed by
// `lib/share-image.ts`; nobody ever sees this component directly.
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { Horizon, SkyDefs, SkyField, Stars } from '@/components/sky';
import type { DaySeal } from '@/lib/share-card';
import { tokens } from '@/theme';

/** 9:16 at a Status-friendly size; captured at 3× → 1080 × 1920. */
export const SEAL_WIDTH = 360;
export const SEAL_HEIGHT = 640;

export const DaySealCard = forwardRef<View, { seal: DaySeal }>(function DaySealCard(
  { seal }, ref,
) {
  const ink = tokens.palette.day[`${seal.band}Ink`];
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SEAL_WIDTH} height={SEAL_HEIGHT}>
          <SkyDefs id="seal" />
          <SkyField id="seal" width={SEAL_WIDTH} height={SEAL_HEIGHT} />
          <Stars width={SEAL_WIDTH} height={SEAL_HEIGHT} until={0.7} scale={1.1} />
          <Horizon id="seal" width={SEAL_WIDTH} height={SEAL_HEIGHT} at={1.02} />
        </Svg>
      </View>

      <View style={s.top}>
        <View style={[s.pill, { backgroundColor: tokens.palette.day[seal.band] }]}>
          <Text style={[s.pillText, { color: ink }]}>{seal.label.toUpperCase()}</Text>
        </View>
        <Text style={s.date}>{seal.dateLabel}</Text>
      </View>

      <View style={s.middle}>
        <Text style={s.stance}>{seal.stance}.</Text>
        {seal.windowLabel && seal.window ? (
          <View style={s.windowBlock}>
            <Text style={s.windowLabel}>{seal.windowLabel}</Text>
            <Text style={s.window}>{seal.window}</Text>
          </View>
        ) : null}
        <View style={s.dots}>
          {seal.dots.map((band, i) => (
            <View
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={[
                s.dot,
                { backgroundColor: band ? tokens.palette.day[band] : tokens.palette.cosmic.line },
                i === seal.todayIndex ? s.dotToday : null,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={s.foot}>
        <Text style={s.hook}>{seal.hook}</Text>
        <Text style={s.brand}>{seal.brand.toUpperCase()}</Text>
      </View>
    </View>
  );
});

const t = tokens;
const s = StyleSheet.create({
  card: {
    width: SEAL_WIDTH,
    height: SEAL_HEIGHT,
    backgroundColor: t.palette.cosmic.deep,
    padding: t.space(8),
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: { gap: t.space(2), alignItems: 'flex-start' },
  pill: { borderRadius: t.radius.pill, paddingVertical: t.space(1.5), paddingHorizontal: t.space(3.5) },
  pillText: { ...t.type.scale.label, fontWeight: '700', letterSpacing: 1.2 },
  date: { ...t.type.scale.sub, color: t.palette.ink.onCosmicMuted },
  middle: { gap: t.space(6) },
  stance: { ...t.type.scale.hero, ...t.type.display, color: t.palette.ink.onCosmic, textTransform: 'capitalize' },
  windowBlock: { gap: t.space(1) },
  windowLabel: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
  window: { ...t.type.scale.title, color: t.palette.accent.ceremonial, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: t.space(2.5), alignItems: 'center' },
  dot: { width: t.space(4), height: t.space(4), borderRadius: t.radius.pill },
  dotToday: { borderWidth: 2, borderColor: t.palette.ink.onCosmic },
  foot: { gap: t.space(1) },
  hook: { ...t.type.scale.lead, color: t.palette.ink.onCosmic },
  brand: { ...t.type.scale.caption, color: t.palette.accent.ceremonial, letterSpacing: 2.4, fontWeight: '700' },
});
