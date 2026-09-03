// Inline player for the platform's own hosted footage, cited in chat as
// corpus-media URLs (see src/lib/video-links.ts for why these exist).
//
// Poster-first: a chat is a scrolling list, and mounting a native player per
// citation would spin up N AVPlayer/ExoPlayer instances while the user
// scrolls past them. So each card renders as its poster (one JPEG, same
// signed token) with a play overlay, and the real expo-video player mounts
// only on tap — from the cited moment, when the citation carries one.

import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { auth } from '@/lib/firebase';
import { dubUrl, type VideoSegment } from '@/lib/video-links';

// The signed ticket baked into the URL is hand-copied by the answer model and
// occasionally corrupt (bug d2caf678) — so the player ALSO authenticates as
// the signed-in user. The endpoint accepts either credential; the header wins
// even when the ticket is mangled or expired.
function useAuthHeaders(): Record<string, string> | undefined {
  const [headers, setHeaders] = useState<Record<string, string>>();
  useEffect(() => {
    let live = true;
    auth.currentUser
      ?.getIdToken()
      .then((t) => { if (live && t) setHeaders({ Authorization: `Bearer ${t}` }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return headers;
}

function Player({ segment, lang, headers }: {
  segment: VideoSegment;
  lang: string;
  headers?: Record<string, string>;
}) {
  const urlFor = (l: string) => (l ? dubUrl(segment.url, l) : segment.url);
  // The player is created ONCE with the language active at mount; later
  // switches go through replaceAsync on the same instance (capture position →
  // swap source → restore → resume), because remounting a native player
  // mid-watch drops the buffer and flashes black.
  const [initial] = useState(() => urlFor(lang));
  const player = useVideoPlayer({ uri: initial, headers }, (p) => {
    if (segment.startSeconds > 0) p.currentTime = segment.startSeconds;
    p.play();
  });
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const at = player.currentTime;
    void (async () => {
      try {
        await player.replaceAsync({ uri: urlFor(lang), headers });
        player.currentTime = at;
        player.play();
      } catch {
        // A failed swap leaves the current track playing — never a dead card.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
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
  // '' = original audio. Only offered when the citation carries a dub stamp
  // (docs/44 CORP-29); every other video renders exactly as before.
  const [lang, setLang] = useState('');
  const hasHindi = segment.dubLangs?.includes('hi');
  const headers = useAuthHeaders();
  return (
    <View style={styles.card}>
      {playing ? (
        <Player segment={segment} lang={lang} headers={headers} />
      ) : (
        <Pressable
          onPress={() => setPlaying(true)}
          accessibilityRole="button"
          accessibilityLabel={`Play video: ${segment.title}`}>
          <Image source={{ uri: segment.posterUrl, headers }} style={styles.video} />
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <ThemedText style={styles.playIcon}>▶</ThemedText>
            </View>
          </View>
        </Pressable>
      )}
      <View style={styles.caption}>
        <ThemedText type="small" numberOfLines={1} style={styles.captionTitle}>
          {segment.title}
        </ThemedText>
        {hasHindi && (
          <View style={styles.langRow} accessibilityRole="radiogroup">
            {[['', 'EN'], ['hi', 'हिन्दी']].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setLang(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === value }}
                style={[styles.langPill, lang === value && styles.langPillOn]}>
                <ThemedText type="small" style={lang === value ? styles.langOn : undefined}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  captionTitle: { flex: 1 },
  langRow: { flexDirection: 'row', gap: 4 },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.5)',
  },
  langPillOn: { backgroundColor: 'rgba(127,127,127,0.35)' },
  langOn: { fontWeight: '600' },
});
