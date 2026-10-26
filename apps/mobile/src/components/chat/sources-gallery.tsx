// The Sources footer as a horizontal gallery (bug 6c329647).
//
// One compact card per cited moment — YouTube's still, the verse and the
// timestamp as chips, the title — in a horizontal list, so twenty sources
// take one row instead of twenty stacked cards. Nothing is embedded: a tap
// opens the link at its moment in the YouTube app or browser (the
// YouTubeCard rule, for the same N-players reason). The markdown list this
// replaces is hidden by the shared bubble when this widget is present.

import { useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  formatMoment,
  sourceCardsOf,
  verseLabel,
  whereLabel,
  youtubeThumbnail,
  type SourceCard,
  type Widget,
} from '@wealthai/core';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const CARD_W = 176;

export function SourcesGallery({ widget }: { widget: Widget }) {
  const cards = sourceCardsOf(widget);
  const [openError, setOpenError] = useState<string | null>(null);
  if (cards.length === 0) return null;

  const open = (card: SourceCard) => {
    setOpenError(null);
    void Linking.openURL(card.url).catch(() => {
      setOpenError('Could not open this source on this device.');
    });
  };

  return (
    <View style={styles.wrap} testID="sources-gallery">
      <View style={styles.header}>
        <ThemedText type="small" style={styles.heading}>SOURCES</ThemedText>
        <ThemedText type="small" style={styles.count}>{cards.length}</ThemedText>
      </View>
      <FlatList
        horizontal
        data={cards}
        keyExtractor={(c) => c.url}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + Spacing.two}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        renderItem={({ item }) => {
          const verse = verseLabel(item);
          const at = formatMoment(item.t);
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="link"
              accessibilityLabel={`Open source: ${item.title}`}
              style={styles.card}>
              <View style={styles.thumbWrap}>
                {item.video_id ? (
                  <Image source={{ uri: youtubeThumbnail(item.video_id) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={styles.chips}>
                  {verse ? (
                    <View style={styles.chip}><ThemedText style={styles.chipText}>{verse}</ThemedText></View>
                  ) : null}
                  {at ? (
                    <View style={styles.chip}><ThemedText style={styles.chipText}>{at}</ThemedText></View>
                  ) : null}
                </View>
                {item.video_id ? (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <View style={styles.playButton}><ThemedText style={styles.playIcon}>▶</ThemedText></View>
                  </View>
                ) : null}
              </View>
              <View style={styles.captionBox}>
                <ThemedText type="small" numberOfLines={2} style={styles.title}>{item.title}</ThemedText>
                {whereLabel(item) ? (
                  <ThemedText type="small" numberOfLines={1} style={styles.where}>{whereLabel(item)}</ThemedText>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
      {openError ? (
        <ThemedText type="small" style={styles.error} accessibilityLiveRegion="polite">{openError}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.two, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  heading: { opacity: 0.6, letterSpacing: 1, fontWeight: '600' },
  count: { opacity: 0.6 },
  row: { gap: Spacing.two, paddingRight: Spacing.three },
  card: {
    width: CARD_W,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.4)',
  },
  thumbWrap: { width: CARD_W, aspectRatio: 16 / 9, backgroundColor: 'rgba(128,128,128,0.15)' },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { backgroundColor: 'rgba(128,128,128,0.2)' },
  chips: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', gap: 4 },
  chip: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  chipText: { color: '#fff', fontSize: 10, lineHeight: 12 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 12, lineHeight: 14 },
  captionBox: { paddingHorizontal: 8, paddingVertical: 6, minHeight: 40 },
  title: { lineHeight: 16 },
  where: { opacity: 0.6, fontSize: 11, lineHeight: 14, marginTop: 2 },
  error: { opacity: 0.7, marginTop: 4 },
});
