// Inline player for the platform's own hosted footage, cited in chat as
// corpus-media URLs (see src/lib/video-links.ts for why these exist).
//
// Poster-first: a chat is a scrolling list, and mounting a native player per
// citation would spin up N AVPlayer/ExoPlayer instances while the user
// scrolls past them. So each card renders as its poster (one JPEG, same
// signed token) with a play overlay, and the real expo-video player mounts
// only on tap — from the cited moment, when the citation carries one.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { VideoSegment } from '@/lib/video-links';

function Player({ segment }: { segment: VideoSegment }) {
  const player = useVideoPlayer({ uri: segment.url }, (p) => {
    if (segment.startSeconds > 0) p.currentTime = segment.startSeconds;
    p.play();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={styles.video}
    />
  );
}

export function VideoEmbed({ segment }: { segment: VideoSegment }) {
  const [playing, setPlaying] = useState(false);
  return (
    <View style={styles.card}>
      {playing ? (
        <Player segment={segment} />
      ) : (
        <Pressable
          onPress={() => setPlaying(true)}
          accessibilityRole="button"
          accessibilityLabel={`Play video: ${segment.title}`}>
          <Image source={{ uri: segment.posterUrl }} style={styles.video} />
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <ThemedText style={styles.playIcon}>▶</ThemedText>
            </View>
          </View>
        </Pressable>
      )}
      <View style={styles.caption}>
        <ThemedText type="small" numberOfLines={1}>
          {segment.title}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: Spacing.two,
    backgroundColor: '#000',
  },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 22, marginLeft: 4 },
  caption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
});
