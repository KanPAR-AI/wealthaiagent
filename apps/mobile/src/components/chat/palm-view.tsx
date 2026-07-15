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
import { apiUrl } from '@/lib/server-config';

// Viral prediction chips — same specs as web PREDICTION_CHIPS, but ranges
// where the backend provides low/high: "29–32" reads as a palm reading,
// "married at 28" reads as false precision (bug ec6a2481 feedback).
const PREDICTION_CHIPS: Array<{
  key: string;
  emoji: string;
  label: string;
  format: (v: number, lo?: number, hi?: number) => string;
  color: string;
}> = [
  { key: 'lifespan_years', emoji: '⏳', label: 'LIFESPAN', format: (v, lo, hi) => (lo && hi && lo !== hi ? `${lo}–${hi} years` : `${v} years`), color: '#a64dff' },
  { key: 'marriage_age', emoji: '❤️', label: 'LOVE', format: (v, lo, hi) => (lo && hi && lo !== hi ? `married ${lo}–${hi}` : `married at ${v}`), color: '#ff4d6d' },
  { key: 'children_count', emoji: '👨‍👩‍👧', label: 'FAMILY', format: (v) => (v === 0 ? 'no children' : v === 1 ? '1 kid' : `${v} kids`), color: '#9333ea' },
  { key: 'career_peak_age', emoji: '💼', label: 'CAREER PEAK', format: (v, lo, hi) => (lo && hi && lo !== hi ? `${lo}–${hi}` : `age ${v}`), color: '#4dd0ff' },
  { key: 'wealth_peak_age', emoji: '💰', label: 'WEALTH PEAK', format: (v, lo, hi) => (lo && hi && lo !== hi ? `${lo}–${hi}` : `age ${v}`), color: '#ffd700' },
];

export function PredictionChips({ predictions, keys }: { predictions: any; keys?: string[] }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const chips = PREDICTION_CHIPS
    .filter((c) => !keys || keys.includes(c.key))
    .map((c) => {
      const p = predictions?.[c.key];
      if (!p || p.value == null) return null;
      return { ...c, value: p.value as number, low: p.low as number | undefined, high: p.high as number | undefined };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (!chips.length) return null;
  return (
    <View style={styles.chipGrid}>
      {chips.map((chip) => (
        <View
          key={chip.key}
          style={[styles.chipCell, { borderColor: `${chip.color}55`, backgroundColor: colors.backgroundElement }]}>
          <ThemedText style={styles.chipEmoji}>{chip.emoji}</ThemedText>
          <ThemedText type="small" style={{ color: chip.color, fontWeight: '700', fontSize: 10, letterSpacing: 1 }}>
            {chip.label}
          </ThemedText>
          <ThemedText type="smallBold">{chip.format(chip.value, chip.low, chip.high)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

// Chip-only sibling pinned atop holistic follow-ups (web PalmPredictionsCard).
export function PalmPredictionsView({ data }: { data: any }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  if (!data?.predictions) return null;
  return (
    <View style={[styles.card, { borderColor: colors.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.snapshotTitle}>
        ✦ YOUR PALM SNAPSHOT ✦
      </ThemedText>
      <PredictionChips predictions={data.predictions} keys={Array.isArray(data.chips) ? data.chips : undefined} />
    </View>
  );
}

// The line overlay is drawn from the vision model's 2–4 coordinate guesses,
// which render as crude straight polylines that don't trace the real creases
// (bug f85f0c1e — user: "≥90% accurate or don't show at all"). Until a real
// palm-crease segmentation model lands, hide the overlay + legend and keep the
// photo + per-line readings. Coords still ship in the payload so a future CV
// model can light these back up by flipping this flag.
const SHOW_PALM_LINE_OVERLAY = false;

function absolutize(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const clean = url.startsWith('/') ? url : `/${url}`;
  return apiUrl(clean);
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
          {SHOW_PALM_LINE_OVERLAY && lines.length > 0 && (
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
      {SHOW_PALM_LINE_OVERLAY && lines.length > 0 && (
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

      {data.predictions ? <PredictionChips predictions={data.predictions} /> : null}

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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  chipCell: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: 1,
    minWidth: 96,
  },
  chipEmoji: { fontSize: 16, lineHeight: 20 },
  snapshotTitle: { textAlign: 'center', letterSpacing: 2, fontSize: 10 },
});
