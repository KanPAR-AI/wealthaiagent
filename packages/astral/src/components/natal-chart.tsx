/**
 * The natal chart, drawn once (docs/49 ASTRAL-15).
 *
 * Before this component, no chart was drawn anywhere in the product outside
 * the Kundli PDF: the server computed a full chart, put it on the wire as a
 * `natal_chart` block, and both clients returned `null` for it.
 *
 * The wheel is the North-Indian diamond from `export_pdf.py` — same house
 * walk, same anchors (see `geometry.ts`) — so the chart on screen and the
 * chart in the PDF are the same chart.
 *
 * THE TIME-LESS CASE IS THE POINT OF THE ROW. With `time_known=false` there is
 * no ascendant marker and no house ring at all: not greyed, not dotted, not
 * "approximate". The diamond is a HOUSE diagram, and houses are counted from a
 * Lagna that moves a full sign every two hours, so a diamond drawn without one
 * would be a fabricated claim wearing a disclaimer. The reason takes its place.
 */

import type { ReactNode } from 'react';

import { formatDegrees } from '../format';
import { WHEEL_HOUSE_ANCHORS, WHEEL_LINES, WHEEL_VIEWBOX } from '../geometry';
import type { DivisionalChart, NatalChartPayload } from '../payloads';
import type { AstralRenderProps } from '../primitives';
import { isWide } from '../primitives';
import {
  birthLines,
  calculationStamp,
  dashaRows,
  modelCells,
  moonAmbiguityNote,
  NO_BIRTH_TIME_REASON,
  payloadCells,
  placementRows,
  type DiamondCell,
} from '../view/natal';

export interface NatalChartViewProps extends AstralRenderProps {
  chart: NatalChartPayload;
  title?: string;
  /**
   * Draw ONE calculated chart — D1, the Moon chart or D9 — instead of the
   * rashi chart built from the planet list (docs/49 ASTRAL-234).
   *
   * A prop rather than a second component, and that is the row rather than a
   * preference: one diamond geometry, one anchor table, one crowding rule.
   * The model supplies its own ascendant, its own placements and its own
   * title, so the three charts differ in their CONTENTS and in nothing else.
   */
  model?: DivisionalChart;
}

const MAX_WHEEL = 340;
const WHEEL_PADDING = 32;
/** vertical step between two grahas sharing a house, in viewBox units */
const GRAHA_LINE_HEIGHT = 4.8;

export function NatalChartView(props: NatalChartViewProps): ReactNode {
  const { ui, theme, width, chart } = props;
  const { Box, Text } = ui;
  const wide = isWide(width);
  const rows = placementRows(chart);
  const birth = birthLines(chart);
  const stamp = calculationStamp(chart);
  const moonNote = moonAmbiguityNote(chart);
  const dashas = dashaRows(chart);

  return (
    <Box
      testID="astral-natal-chart"
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 14,
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
          {props.title ?? props.model?.title ?? 'Janam Kundli'}
        </Text>
        {stamp ? (
          <Text testID="astral-natal-stamp" style={{ fontSize: 11, color: theme.textMuted }}>
            {stamp}
          </Text>
        ) : null}
      </Box>

      {birth.length ? (
        <Box style={{ gap: 3 }}>
          {birth.map((line) => (
            <Box key={line.label} style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.textMuted, width: 46 }}>{line.label}</Text>
              <Text style={{ fontSize: 12, color: theme.text, flex: 1 }}>{line.value}</Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {chart.time_known ? (
        <Wheel {...props} />
      ) : (
        <Box
          testID="astral-natal-no-time"
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 12,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>
            No birth time on file
          </Text>
          <Text style={{ fontSize: 12, color: theme.textMuted, lineHeight: 18 }}>
            {NO_BIRTH_TIME_REASON}
          </Text>
        </Box>
      )}

      <Box style={{ gap: 3 }}>
        {chart.time_known && chart.ascendant ? (
          <KeyLine
            ui={ui}
            theme={theme}
            testID="astral-natal-ascendant"
            label="Lagna"
            /* A6#13: the within-sign degree beside the sign name. Null on a
               pre-v4 chart, and joinNonEmpty then shows the sign alone. */
            value={joinNonEmpty([
              chart.ascendant,
              formatDegrees(chart.ascendant_sign_degree),
            ])}
          />
        ) : null}
        {chart.moon_sign ? (
          <KeyLine ui={ui} theme={theme} label="Moon sign" value={chart.moon_sign} />
        ) : null}
        {chart.sun_sign ? (
          <KeyLine ui={ui} theme={theme} label="Sun sign" value={chart.sun_sign} />
        ) : null}
      </Box>

      {moonNote ? (
        <Text testID="astral-natal-moon-note" style={{ fontSize: 11, color: theme.textPending, fontStyle: 'italic', lineHeight: 16 }}>
          {moonNote}
        </Text>
      ) : null}

      <Box style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Placements
        </Text>
        <Box testID="astral-natal-placements" style={{ gap: 0 }}>
          {rows.map((row, index) => (
            <Box
              key={row.planet}
              style={{
                flexDirection: wide ? 'row' : 'column',
                alignItems: wide ? 'center' : 'flex-start',
                gap: wide ? 8 : 1,
                paddingTop: 6,
                paddingBottom: 6,
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: theme.border,
              }}
            >
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 128 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                  {row.planet}
                </Text>
                {row.retrograde ? (
                  <Text style={{ fontSize: 10, fontWeight: '600', color: theme.warn }}>R</Text>
                ) : null}
                <Text style={{ fontSize: 13, color: theme.text }}>{row.sign}</Text>
              </Box>
              <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: wide ? 1 : undefined }}>
                {row.degree ? (
                  <Cell ui={ui} theme={theme} label="Degree" value={row.degree} />
                ) : null}
                {row.house ? <Cell ui={ui} theme={theme} label="House" value={row.house} /> : null}
                {row.nakshatra ? (
                  <Cell
                    ui={ui}
                    theme={theme}
                    label="Nakshatra"
                    value={row.pada ? `${row.nakshatra} (${row.pada})` : row.nakshatra}
                  />
                ) : null}
                {row.dignity ? <Cell ui={ui} theme={theme} label="Dignity" value={row.dignity} /> : null}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {chart.yogas.length ? (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Yogas
          </Text>
          {chart.yogas.map((y) => (
            <Text key={y} style={{ fontSize: 12, color: theme.textMuted, lineHeight: 17 }}>
              {y}
            </Text>
          ))}
        </Box>
      ) : null}

      {dashas.length ? (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Vimshottari Dasha
          </Text>
          {dashas.map((d) => (
            <Box key={`${d.planet}-${d.start ?? ''}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: d.isCurrent ? '700' : '400',
                  color: d.isCurrent ? theme.accent : theme.text,
                  minWidth: 66,
                }}
              >
                {d.planet}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted }}>
                {joinNonEmpty([d.start, d.end], ' – ')}
              </Text>
              {d.isCurrent ? (
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.accent, textTransform: 'uppercase' }}>
                  current
                </Text>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * The diamond. Rendered ONLY when `chart.time_known` is true — the caller
 * guards, and this function guards again, because "drawn faintly" is the
 * failure mode the row names and a defensive second check is cheaper than
 * finding out from a screenshot.
 */
function Wheel(props: NatalChartViewProps): ReactNode {
  const { chart, model } = props;
  if (!chart.time_known) return null;
  return (
    <ChartDiamond
      ui={props.ui}
      theme={props.theme}
      width={props.width}
      cells={model ? modelCells(model) : payloadCells(chart)}
    />
  );
}

export interface ChartDiamondProps extends AstralRenderProps {
  /** the twelve cells, in house order — built by `view/natal`, never here */
  cells: DiamondCell[];
  testID?: string;
}

/**
 * THE North-Indian diamond (docs/49 ASTRAL-15/18/234).
 *
 * One geometry, one anchor table, one crowding rule, for every surface in the
 * workspace: the chat block's rashi chart and the chart surface's D1 · Moon ·
 * D9 all render THIS. A second diamond anywhere is a spec deviation and the
 * ASTRAL-18 grep fails on it.
 *
 * It draws what it is given and computes nothing — the corner label is a
 * string the caller already had (a rashi number from the engine, or a house
 * number), never a number worked out here.
 */
export function ChartDiamond(props: ChartDiamondProps): ReactNode {
  const { ui, theme, width, cells } = props;
  const { Box, Svg, Group, SvgRect, SvgLine, SvgText } = ui;

  const size = Math.max(200, Math.min(MAX_WHEEL, width - WHEEL_PADDING));
  const occupants = new Map<number, string[]>(
    cells.map((c) => [c.house, c.tokens]));
  const labels = new Map<number, string>(
    cells.map((c) => [c.house, c.label]));

  return (
    <Box
      testID={props.testID ?? 'astral-natal-wheel'}
      style={{ alignSelf: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}>
        <SvgRect
          x={0}
          y={0}
          width={WHEEL_VIEWBOX}
          height={WHEEL_VIEWBOX}
          stroke={theme.line}
          strokeWidth={0.8}
          fill="none"
        />
        {WHEEL_LINES.map((l, i) => (
          <SvgLine
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={theme.line}
            strokeWidth={0.8}
          />
        ))}
        {WHEEL_HOUSE_ANCHORS.map((a) => {
          const x = a.x;
          const y = a.y;
          const grahas = occupants.get(a.house) ?? [];
          // CENTRE the block (house number + its grahas) on the anchor rather
          // than growing a stack away from it. Found by rendering the chart
          // and looking at it: the old shape put line k at y + dir*k*height,
          // so a house with three grahas ran ~14 units from an anchor that
          // sits as close as 8.75 units to an edge — the glyphs crossed the
          // diagonals into the neighbouring house and collided with its
          // number, worst in the 380px side panel. Centring makes the block's
          // extent symmetric about the anchor, so it grows half as far in
          // either direction and stays in its own cell.
          const lines = grahas.length + 1;
          // A crowded cell tightens rather than spreading. The top-right
          // corner square and its neighbouring triangle are the smallest
          // cells on the board, and a stellium of four grahas there still
          // reached across the diagonal into the next house's number after
          // centring. Three or more grahas step the block down one size.
          const crowded = grahas.length >= 3;
          const lineH = crowded ? GRAHA_LINE_HEIGHT * 0.78 : GRAHA_LINE_HEIGHT;
          const glyphSize = crowded ? 3.7 : 4.6;
          const top = y - ((lines - 1) / 2) * lineH;
          return (
            <Group key={`h${a.house}`}>
              <SvgText x={x} y={top} fontSize={3.6} fill={theme.textMuted} textAnchor="middle">
                {labels.get(a.house) ?? String(a.house)}
              </SvgText>
              {grahas.map((g, gi) => (
                <SvgText
                  key={g}
                  x={x}
                  y={top + lineH * (gi + 1)}
                  fontSize={glyphSize}
                  fontWeight="600"
                  fill={theme.text}
                  textAnchor="middle"
                >
                  {g}
                </SvgText>
              ))}
            </Group>
          );
        })}
      </Svg>
    </Box>
  );
}

function KeyLine({
  ui, theme, label, value, testID,
}: {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  label: string;
  value: string;
  testID?: string;
}): ReactNode {
  const { Box, Text } = ui;
  return (
    <Box testID={testID} style={{ flexDirection: 'row', gap: 6 }}>
      <Text style={{ fontSize: 12, color: theme.textMuted, width: 72 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, flex: 1 }}>{value}</Text>
    </Box>
  );
}

function Cell({
  ui, theme, label, value,
}: {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  label: string;
  value: string;
}): ReactNode {
  const { Box, Text } = ui;
  return (
    <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: theme.text }}>{value}</Text>
    </Box>
  );
}

function joinNonEmpty(parts: Array<string | null | undefined>, sep = ' '): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(sep);
}
