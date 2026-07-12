// Native chart + table widgets (bug aef2e65d: an IRR reply ended in a
// pile of "coming soon" chips — table, line chart, composed chart ×2).
//
// Rendered with react-native-svg (already in the binary for the palm
// overlay). Data contracts mirror the web widgets exactly:
//   table          {headers: string[], rows: string[][]}
//   line_chart     {labels: string[], datasets: [{label, values, color}]}
//   bar_chart      same as line_chart (all bars)
//   composed_chart same + per-dataset {chartType: 'bar'|'line', stackId?}
//
// Design: compact cards, theme-aware, Indian-currency-friendly tick
// formatting (₹L/₹Cr). Bars stack by stackId; line datasets overlay.

import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import Svg, { G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

const PLOT_W = 300;
const PLOT_H = 170;
const PAD_L = 44;
const PAD_B = 22;
const PAD_T = 8;

function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(0)}L`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return `${Math.round(v)}`;
}

interface Dataset {
  label: string;
  values: number[];
  color?: string;
  chartType?: 'bar' | 'line';
  stackId?: string;
}

interface ChartData {
  labels?: string[];
  datasets?: Dataset[];
}

function Legend({ datasets }: { datasets: Dataset[] }) {
  return (
    <View style={styles.legend}>
      {datasets.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: d.color || '#4EA8F5' }]} />
          <ThemedText type="small" themeColor="textSecondary">{d.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Shared cartesian plot: stacked bars (by stackId) + line overlays. */
function CartesianChart({ data, allBars }: { data: ChartData; allBars?: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const labels = data.labels || [];
  const datasets = (data.datasets || []).filter((d) => Array.isArray(d.values));
  if (!labels.length || !datasets.length) return null;

  const n = labels.length;
  const bars = datasets.filter((d) => allBars || (d.chartType ?? 'bar') === 'bar');
  const lines = allBars ? [] : datasets.filter((d) => (d.chartType ?? 'bar') === 'line');

  // Stacked extents per x: sum positives and negatives per stack group.
  let maxV = 0;
  let minV = 0;
  for (let i = 0; i < n; i++) {
    const byStack: Record<string, { pos: number; neg: number }> = {};
    for (const d of bars) {
      const key = d.stackId || `__solo_${d.label}`;
      const v = d.values[i] ?? 0;
      byStack[key] = byStack[key] || { pos: 0, neg: 0 };
      if (v >= 0) byStack[key].pos += v;
      else byStack[key].neg += v;
    }
    for (const s of Object.values(byStack)) {
      maxV = Math.max(maxV, s.pos);
      minV = Math.min(minV, s.neg);
    }
    for (const d of lines) {
      const v = d.values[i] ?? 0;
      maxV = Math.max(maxV, v);
      minV = Math.min(minV, v);
    }
  }
  if (maxV === 0 && minV === 0) maxV = 1;
  const span = maxV - minV || 1;

  const plotW = PLOT_W - PAD_L;
  const plotH = PLOT_H - PAD_B - PAD_T;
  const y = (v: number) => PAD_T + (maxV - v) / span * plotH;
  const zeroY = y(0);

  // Bar geometry: one group per x; stacks side-by-side inside the group.
  const stackIds = [...new Set(bars.map((d) => d.stackId || `__solo_${d.label}`))];
  const groupW = plotW / n;
  const barW = Math.max(3, Math.min(18, (groupW * 0.7) / Math.max(1, stackIds.length)));
  const xCenter = (i: number) => PAD_L + groupW * i + groupW / 2;

  const gridColor = scheme === 'dark' ? '#3a3a3c' : '#e5e5ea';
  const axisText = scheme === 'dark' ? '#98989e' : '#6e6e73';

  // Sparse x labels: first, middle, last.
  const labelIdx = new Set([0, Math.floor((n - 1) / 2), n - 1]);

  return (
    <Svg width={PLOT_W} height={PLOT_H}>
      {/* gridlines: min, zero, max */}
      {[maxV, 0, minV].filter((v, i, a) => a.indexOf(v) === i).map((v, i) => (
        <G key={`g-${i}`}>
          <Line x1={PAD_L} y1={y(v)} x2={PLOT_W} y2={y(v)} stroke={gridColor} strokeWidth={v === 0 ? 1.2 : 0.6} />
          <SvgText x={PAD_L - 4} y={y(v) + 3} fontSize={9} fill={axisText} textAnchor="end">
            {fmtTick(v)}
          </SvgText>
        </G>
      ))}
      {/* stacked bars */}
      {Array.from({ length: n }, (_, i) => {
        const acc: Record<string, { pos: number; neg: number }> = {};
        return stackIds.map((sid, si) => {
          const members = bars.filter((d) => (d.stackId || `__solo_${d.label}`) === sid);
          const bx = xCenter(i) - (stackIds.length * barW) / 2 + si * barW;
          return members.map((d, di) => {
            const v = d.values[i] ?? 0;
            if (!v) return null;
            acc[sid] = acc[sid] || { pos: 0, neg: 0 };
            let y0: number, y1: number;
            if (v >= 0) {
              y0 = y(acc[sid].pos + v);
              y1 = y(acc[sid].pos);
              acc[sid].pos += v;
            } else {
              y0 = y(acc[sid].neg);
              y1 = y(acc[sid].neg + v);
              acc[sid].neg += v;
            }
            return (
              <Rect
                key={`b-${i}-${si}-${di}`}
                x={bx}
                y={Math.min(y0, y1)}
                width={barW - 1}
                height={Math.max(1, Math.abs(y1 - y0))}
                fill={d.color || '#4EA8F5'}
                rx={1.5}
                opacity={0.92}
              />
            );
          });
        });
      })}
      {/* line overlays */}
      {lines.map((d, li) => (
        <Polyline
          key={`l-${li}`}
          points={d.values.slice(0, n).map((v, i) => `${xCenter(i)},${y(v ?? 0)}`).join(' ')}
          fill="none"
          stroke={d.color || '#E91E63'}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* x labels */}
      {labels.map((l, i) =>
        labelIdx.has(i) ? (
          <SvgText key={`x-${i}`} x={xCenter(i)} y={PLOT_H - 6} fontSize={9} fill={axisText} textAnchor="middle">
            {l}
          </SvgText>
        ) : null,
      )}
      {/* zero axis base when everything is positive */}
      <Line x1={PAD_L} y1={zeroY} x2={PLOT_W} y2={zeroY} stroke={gridColor} strokeWidth={1.2} />
    </Svg>
  );
}

function Card({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  return (
    <View style={[styles.card, { borderColor: colors.backgroundSelected }]}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {description ? (
        <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      ) : null}
      {children}
    </View>
  );
}

export function ChartWidget({ widget, kind }: { widget: any; kind: 'line' | 'bar' | 'composed' }) {
  const data: ChartData = widget?.data ?? widget ?? {};
  const datasets = data.datasets || [];
  if (!datasets.length) return null;
  return (
    <Card title={widget?.title} description={widget?.description}>
      <CartesianChart
        data={{
          labels: data.labels,
          // For plain line charts every dataset renders as a line.
          datasets: kind === 'line'
            ? datasets.map((d) => ({ ...d, chartType: 'line' as const }))
            : datasets,
        }}
        allBars={kind === 'bar'}
      />
      <Legend datasets={datasets} />
    </Card>
  );
}

export function TableWidget({ widget }: { widget: any }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const data = widget?.data ?? widget ?? {};
  const headers: string[] = data.headers || [];
  const rows: string[][] = data.rows || [];
  if (!headers.length && !rows.length) return null;
  return (
    <Card title={widget?.title}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tr, { borderBottomColor: colors.backgroundSelected, borderBottomWidth: 1 }]}>
            {headers.map((h, i) => (
              <ThemedText key={`h-${i}`} type="smallBold" style={styles.th}>{h}</ThemedText>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View
              key={`r-${ri}`}
              style={[
                styles.tr,
                ri % 2 === 1 && { backgroundColor: colors.backgroundElement },
              ]}>
              {r.map((cell, ci) => (
                <ThemedText key={`c-${ri}-${ci}`} type="small" style={styles.td}>
                  {String(cell)}
                </ThemedText>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    marginVertical: Spacing.two,
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  tr: { flexDirection: 'row' },
  th: { width: 96, paddingVertical: 6, paddingRight: 8 },
  td: { width: 96, paddingVertical: 5, paddingRight: 8 },
});
