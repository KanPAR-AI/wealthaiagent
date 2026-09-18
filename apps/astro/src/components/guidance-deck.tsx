// docs/66 G-2 — Today's Guidance as a swipeable deck.
//
// Owner 2026-09-18: "multiple cards which are swipeable kind of views and
// text on first screen to be more intriguing so it drives engagement."
// The engine wrote the cards (hook first; headline and body in plain life,
// the astrology in `basis`); this pager shows them one per screen width
// with page dots, a door where the card has one, and the full paragraph
// collapsed underneath. Nothing here composes a word: every string is the
// card's own. A built-in horizontal ScrollView with paging — no native
// dependency, so it ships by OTA.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ChevronRight } from '@/components/glyphs';
import { track } from '@/lib/analytics';
import { DECK_KIND_LABEL, deckDoor } from '@/lib/daily-view';
import type { DeckCard } from '@/lib/people-shapes';
import { tokens } from '@/theme';

const GUTTER = tokens.space(4);

export function GuidanceDeck({ cards, paragraph }: { cards: DeckCard[]; paragraph: string }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(240, width - GUTTER * 2);
  const [index, setIndex] = useState(0);
  const [proseOpen, setProseOpen] = useState(false);
  const seen = useRef<Set<number>>(new Set([0]));

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + tokens.space(2)}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: tokens.space(2) }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + tokens.space(2)));
          const next = Math.min(Math.max(i, 0), cards.length - 1);
          if (next !== index) {
            setIndex(next);
            if (!seen.current.has(next)) {
              seen.current.add(next);
              track('guidance_deck_swipe', { index: next, kind: cards[next]?.kind });
              if (next === cards.length - 1) track('guidance_deck_complete', { cards: cards.length });
            }
          }
        }}
        accessibilityLabel={`Today's guidance, ${cards.length} cards. Swipe for the next.`}
      >
        {cards.map((card, i) => {
          const door = deckDoor(card.kind);
          const hook = card.kind === 'hook';
          return (
            <View key={`${card.kind}-${i}`} style={[s.card, { width: cardWidth }, hook && s.cardHook]}>
              <Text style={s.kicker}>{DECK_KIND_LABEL[card.kind] ?? card.kind}{hook ? '' : ` · ${i} of ${cards.length - 1}`}</Text>
              <Text style={[s.headline, hook && s.headlineHook]}>{card.headline}</Text>
              <Text style={s.body}>{card.body}</Text>
              {card.basis ? <Text style={s.basis}>{card.basis}</Text> : null}
              {door ? (
                <Pressable
                  style={s.door}
                  accessibilityRole="button"
                  accessibilityLabel={door.label}
                  onPress={() => {
                    track('guidance_deck_door', { kind: card.kind });
                    router.push({ pathname: door.pathname as never, params: { ...(door.params ?? {}), handoffKey: String(Date.now()) } as never });
                  }}
                >
                  <Text style={s.doorText}>{door.label}</Text>
                  <ChevronRight size={14} color={tokens.palette.accent.ceremonial} />
                </Pressable>
              ) : hook ? (
                <Text style={s.swipeHint}>Swipe for the day, card by card →</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={s.dots} accessibilityLabel={`Card ${index + 1} of ${cards.length}`}>
        {cards.map((c, i) => (
          <View key={`${c.kind}-dot`} style={[s.dot, i === index && s.dotOn]} />
        ))}
      </View>

      {paragraph ? (
        <View style={s.proseWrap}>
          <Pressable
            onPress={() => { track('guidance_deck_prose', { open: !proseOpen }); setProseOpen((v) => !v); }}
            accessibilityRole="button"
            accessibilityLabel={proseOpen ? 'Hide the full guidance' : 'Read the full guidance'}
            style={s.proseToggle}
          >
            <Text style={s.proseToggleText}>{proseOpen ? 'Hide the full guidance' : 'Read the full guidance'}</Text>
            <ChevronRight size={14} color={tokens.palette.accent.ceremonial} />
          </Pressable>
          {proseOpen ? (
            <View style={s.prose}>
              <Text style={s.proseText}>{paragraph}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const t = tokens;
const s = StyleSheet.create({
  wrap: { gap: t.space(2), marginHorizontal: -t.space(4) },
  card: {
    backgroundColor: t.palette.cosmic.card,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: t.palette.cosmic.line,
    padding: t.space(4),
    gap: t.space(2),
    minHeight: t.space(52),
  },
  cardHook: { backgroundColor: t.palette.cosmic.base, borderColor: t.palette.cosmic.glow },
  kicker: { ...t.type.scale.caption, color: t.palette.accent.ceremonial, letterSpacing: 0.6, textTransform: 'uppercase' },
  headline: { ...t.type.scale.lead, ...t.type.display, color: t.palette.ink.onCosmic },
  headlineHook: { ...t.type.scale.title, ...t.type.display, color: t.palette.ink.onCosmic },
  body: { ...t.type.scale.body, color: t.palette.ink.onCosmic },
  basis: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted },
  door: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' },
  doorText: { ...t.type.scale.sub, color: t.palette.accent.ceremonial, fontWeight: '700' },
  swipeHint: { ...t.type.scale.caption, color: t.palette.ink.onCosmicMuted, marginTop: 'auto' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: t.radius.pill, backgroundColor: t.palette.cosmic.line },
  dotOn: { backgroundColor: t.palette.accent.ceremonial, width: 16 },
  proseWrap: { marginHorizontal: t.space(4), gap: t.space(2) },
  proseToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  proseToggleText: { ...t.type.scale.sub, color: t.palette.accent.ceremonial, fontWeight: '700' },
  prose: {
    backgroundColor: t.palette.cosmic.base,
    borderRadius: t.radius.card,
    padding: t.space(4),
    borderWidth: 1,
    borderColor: t.palette.cosmic.glow,
  },
  proseText: { ...t.type.scale.body, color: t.palette.ink.onCosmic },
});
