/**
 * The ranked days (docs/64 W-3) — a small list under the reply: the verdict
 * the engine wrote, then the top days with their band, window and the cited
 * reasons. Tapping a day asks the HOST to open that day's card; the block
 * knows no router. No client-side scoring, ordering or banding.
 */

import type { ReactNode } from 'react';

import type { BestDaysPayload } from '../payloads';
import type { AstralRenderProps } from '../primitives';
import { bestDayRows, bestDaysSubtitle, bestDaysTitle } from '../view/best-days';

export interface BestDaysProps extends AstralRenderProps {
  payload: BestDaysPayload;
  /** the host's door to a day's card (`/day?date=`), when it has one */
  onOpenDay?: (isoDate: string) => void;
}

const BAND_COLOR: Record<string, string> = {
  green: '#2f9e5b', amber: '#d29a2b', red: '#c8453f',
};

export function BestDaysView(props: BestDaysProps): ReactNode {
  const { ui, theme, payload, onOpenDay } = props;
  const { Box, Text, Pressable } = ui;
  const rows = bestDayRows(payload);

  return (
    <Box
      testID="astral-best-days"
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
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{bestDaysTitle(payload)}</Text>
        <Text style={{ fontSize: 11, color: theme.textMuted }}>{bestDaysSubtitle(payload)}</Text>
      </Box>

      {payload.verdict ? (
        <Text testID="astral-best-days-verdict" style={{ fontSize: 13, color: theme.text, lineHeight: 18 }}>
          {payload.verdict.charAt(0).toUpperCase() + payload.verdict.slice(1)}.
        </Text>
      ) : null}

      <Box style={{ gap: 8 }}>
        {rows.map((row) => {
          const body = (
            <Box
              testID="astral-best-day"
              style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 12, gap: 4 }}
            >
              <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{row.when}</Text>
                <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Box
                    style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: row.band ? (BAND_COLOR[row.band] ?? theme.textMuted) : 'transparent',
                      borderWidth: row.band ? 0 : 1, borderColor: theme.textMuted,
                    }}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{row.bandLabel}</Text>
                </Box>
              </Box>
              {row.window ? (
                <Text style={{ fontSize: 12, color: theme.accent, fontWeight: '700' }}>Golden window {row.window}</Text>
              ) : null}
              {row.people ? <Text style={{ fontSize: 11, color: theme.textMuted }}>{row.people}</Text> : null}
              {row.why.map((w) => (
                <Text key={w} style={{ fontSize: 11, color: theme.textMuted, lineHeight: 15 }}>• {w}</Text>
              ))}
              {row.rahuKaal ? (
                <Text style={{ fontSize: 11, color: theme.warn }}>Rahu Kaal {row.rahuKaal}</Text>
              ) : null}
            </Box>
          );
          return onOpenDay ? (
            <Pressable
              key={row.date}
              accessibilityLabel={`${row.when}, ${row.bandLabel} — open that day`}
              onPress={() => onOpenDay(row.date)}
            >
              {body}
            </Pressable>
          ) : (
            <Box key={row.date}>{body}</Box>
          );
        })}
      </Box>

      {payload.absent.length ? (
        <Text style={{ fontSize: 11, color: theme.textMuted }}>
          {payload.absent.map((a) => `${a.date}: ${a.reason}`).join(' · ')}
        </Text>
      ) : null}
    </Box>
  );
}
