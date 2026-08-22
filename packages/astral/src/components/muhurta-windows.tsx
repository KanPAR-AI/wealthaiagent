/**
 * The muhurta windows (docs/49 ASTRAL-17) — the third discarded block.
 *
 * "the medical-window rule is a render concern only — no client-side scoring."
 * This component does not sort, filter, threshold or re-score. The engine
 * ordered the windows and applied `min_score`; the client shows that order.
 *
 * The score renders as the payload's own 0..1 float. `0.88` is not turned into
 * "88%": multiplying by 100 is "rounding into a new unit" (ASTRAL-19), and a
 * percentage on an electional score is the false-precision shape INV-5 bans.
 */

import type { ReactNode } from 'react';

import type { MuhurtaResultsPayload } from '../payloads';
import type { AstralRenderProps } from '../primitives';
import { isWide } from '../primitives';
import { RAHU_KAAL_LABEL, windowRows } from '../view/muhurta';

export interface MuhurtaWindowsProps extends AstralRenderProps {
  results: MuhurtaResultsPayload;
  title?: string;
}

export function MuhurtaWindowsView(props: MuhurtaWindowsProps): ReactNode {
  const { ui, theme, width, results } = props;
  const { Box, Text } = ui;
  const wide = isWide(width);
  const rows = windowRows(results);

  return (
    <Box
      testID="astral-muhurta-windows"
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 12,
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
          {props.title ?? 'Auspicious windows'}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textMuted }}>
          {[results.location, results.date_range].filter(Boolean).join(' · ')}
        </Text>
      </Box>

      <Box style={{ gap: 10 }}>
        {rows.map((row, index) => (
          <Box
            key={`${row.date ?? ''}-${row.time ?? ''}-${index}`}
            testID="astral-muhurta-window"
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 12,
              padding: 12,
              gap: 6,
            }}
          >
            <Box
              style={{
                flexDirection: wide ? 'row' : 'column',
                alignItems: wide ? 'center' : 'flex-start',
                justifyContent: 'space-between',
                gap: wide ? 8 : 2,
              }}
            >
              <Box style={{ gap: 1 }}>
                {row.date ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{row.date}</Text>
                ) : null}
                {row.time ? (
                  <Text style={{ fontSize: 13, color: theme.text }}>{row.time}</Text>
                ) : null}
              </Box>
              {row.score !== null ? (
                <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    score
                  </Text>
                  <Text testID="astral-muhurta-score" style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>
                    {row.score}
                  </Text>
                </Box>
              ) : null}
            </Box>

            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {row.lagna ? (
                <Pair ui={ui} theme={theme} label="Lagna" value={row.lagnaLord ? `${row.lagna} (${row.lagnaLord})` : row.lagna} />
              ) : null}
              {row.moonSign ? <Pair ui={ui} theme={theme} label="Moon" value={row.moonSign} /> : null}
              {row.panchang.map((p) => (
                <Pair key={p.label} ui={ui} theme={theme} label={p.label} value={p.value} />
              ))}
              {row.namingLetter ? (
                <Pair ui={ui} theme={theme} label="Naming letter" value={row.namingLetter} />
              ) : null}
            </Box>

            {row.rahuKaal ? (
              <Text testID="astral-muhurta-rahu-kaal" style={{ fontSize: 11, fontWeight: '700', color: theme.warn }}>
                {RAHU_KAAL_LABEL}
              </Text>
            ) : null}

            {row.benefics.length ? (
              <Text style={{ fontSize: 11, color: theme.textMuted, lineHeight: 16 }}>
                Benefics: {row.benefics.join(' · ')}
              </Text>
            ) : null}
            {row.malefics.length ? (
              <Text style={{ fontSize: 11, color: theme.warn, lineHeight: 16 }}>
                Cautions: {row.malefics.join(' · ')}
              </Text>
            ) : null}
          </Box>
        ))}
      </Box>

      {results.total_evaluated !== null ? (
        <Text style={{ fontSize: 11, color: theme.textMuted }}>
          {results.total_evaluated} time slots evaluated.
        </Text>
      ) : null}
    </Box>
  );
}

function Pair({
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
