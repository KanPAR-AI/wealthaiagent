// Palm analysis — the MysticAI money widget, now native (#9).
//
// Renders the uploaded palm photo with the model's line coordinates drawn
// as SVG polylines over it (Heart/Head/Life/Fate/Sun, each in its
// signature color), the same overlay the web renders. Below: per-line
// confidence dots and the reading summary.
//
// Coordinate contract (matches web palm-reading-widget.tsx): paths are
// normalized to the FULL image, so the image must render uncropped at its
// natural aspect ratio and the SVG must share its exact box. We measure
// the source via Image.getSizeWithHeaders (the URL is auth-gated) and set
// height = width / aspect — never `cover`, which crops and shears every
// line off the palm.

import { useEffect, useState } from 'react';
import { Image, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth';
import { API_BASE_URL, API_VERSION } from '@/lib/env';

function absolutize(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const clean = url.startsWith('/') ? url : `/${url}`;
  if (clean.startsWith(`/api/${API_VERSION}`)) return `${API_BASE_URL}${clean}`;
  return `${API_BASE_URL}/api/${API_VERSION}${clean}`;
}

export function PalmView({ data }: { data: any }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [aspect, setAspect] = useState<number | null>(null); // naturalW / naturalH

  const imageUrl = absolutize(data.image_url);
  const lines: any[] = data.line_coordinates || [];
  const readings: any[] = data.lines || [];

  useEffect(() => {
    let alive = true;
    getToken().then((t) => {
      if (alive) setHeaders(t ? { Authorization: `Bearer ${t}` } : {});
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!imageUrl || !headers) return;
    let alive = true;
    Image.getSizeWithHeaders(
      imageUrl,
      headers,
      (w, h) => { if (alive && w > 0 && h > 0) setAspect(w / h); },
      () => { if (alive) setAspect(3 / 4); }, // portrait fallback
    );
    return () => { alive = false; };
  }, [imageUrl, headers]);

  // The SVG shares the image's exact box, so normalized coords map 1:1.
  const viewW = Math.min(screenWidth - Spacing.four * 2 - Spacing.three * 2, 340);
  const viewH = aspect ? viewW / aspect : viewW * (4 / 3);
  const mapX = (x: number) => Math.max(0, Math.min(1, x)) * viewW;
  const mapY = (y: number) => Math.max(0, Math.min(1, y)) * viewH;

  return (
    <View style={[styles.card, { borderColor: colors.backgroundSelected }]}>
      <ThemedText type="smallBold">
        🤚 Palm Reading{data.hand ? ` — ${String(data.hand)[0].toUpperCase()}${String(data.hand).slice(1)} hand` : ''}
      </ThemedText>

      {imageUrl && headers && aspect && (
        <View style={[styles.imageWrap, { width: viewW, height: viewH }]}>
          <Image
            source={{ uri: imageUrl, headers }}
            style={{ width: viewW, height: viewH }}
            resizeMode="stretch"
          />
          {lines.length > 0 && (
            <Svg
              style={StyleSheet.absoluteFill}
              viewBox={`0 0 ${viewW} ${viewH}`}
              pointerEvents="none">
              {lines.map((l, i) => {
                const pts = (l.path || [])
                  .map(([x, y]: number[]) => `${mapX(x)},${mapY(y)}`)
                  .join(' ');
                if (!pts) return null;
                const [sx, sy] = l.path[0];
                const color = l.color || '#ff4d6d';
                return (
                  <G key={`${l.name}-${i}`}>
                    {/* soft halo under a bright core — the web's glow look */}
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={color}
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.22}
                    />
                    <Polyline
                      points={pts}
                      fill="none"
                      stroke={color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                    />
                    <Circle cx={mapX(sx)} cy={mapY(sy)} r={4.5} fill={color} />
                  </G>
                );
              })}
            </Svg>
          )}
        </View>
      )}

      {/* legend */}
      {lines.length > 0 && (
        <View style={styles.legend}>
          {lines.map((l, i) => (
            <View key={`lg-${i}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color || '#ff4d6d' }]} />
              <ThemedText type="small" themeColor="textSecondary">{l.name}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {/* line readings with confidence */}
      {readings.map((r, i) => (
        <View key={`r-${i}`} style={styles.reading}>
          <View style={styles.readingHeader}>
            <ThemedText type="smallBold">{r.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {'●'.repeat(Math.round((r.confidence || 0) * 5))}{'○'.repeat(5 - Math.round((r.confidence || 0) * 5))}
            </ThemedText>
          </View>
          {r.interpretation ? (
            <ThemedText type="small" themeColor="textSecondary">{r.interpretation}</ThemedText>
          ) : null}
        </View>
      ))}

      {data.overall_reading ? (
        <ThemedText type="small" style={styles.overall}>{data.overall_reading}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    marginVertical: Spacing.two,
    gap: Spacing.two,
  },
  imageWrap: {
    alignSelf: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  reading: { gap: 2 },
  readingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overall: { fontStyle: 'italic', marginTop: Spacing.one },
});
