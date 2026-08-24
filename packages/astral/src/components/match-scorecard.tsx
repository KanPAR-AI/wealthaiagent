/**
 * THE match scorecard (docs/49 ASTRAL-16 + ASTRAL-18).
 *
 * ONE implementation. The extension's 380 px side panel, the web compatibility
 * screen and the native app all render this file; they differ only in the
 * `ui` primitives they inject and the `width` they pass. A second scorecard
 * renderer anywhere in the workspace is a SPEC-DEVIATION, and
 * `__tests__/single-implementation.test.ts` fails if one appears.
 *
 * What is deliberately absent:
 *   - any `%`. §5b-2's "87% Strong Match" is ruled out by FR-011 and §15.4,
 *     and `no-percentage.test.ts` asserts the character never appears in
 *     anything this component renders.
 *   - any band computed here. `verdict` is the engine's (`matching.py:427`).
 *   - any dimension total. A dimension shows its kootas' real fractions.
 *   - any `/36` on a time-less match. `total` is null there, on purpose.
 */

import type { ReactNode } from 'react';

import { ringDash } from '../geometry';
import type { MatchReportPayload } from '../payloads';
import type { AstralRenderProps } from '../primitives';
import { isWide } from '../primitives';
import { dimensionRows, headline, kootaRows } from '../view/match';

export interface MatchScorecardProps extends AstralRenderProps {
  report: MatchReportPayload;
  title?: string;
}

const RING_VIEWBOX = 100;
const RING_RADIUS = 42;
const RING_CENTRE = 50;

export function MatchScorecard(props: MatchScorecardProps): ReactNode {
  const { ui, theme, width, report } = props;
  const { Box, Text } = ui;
  const wide = isWide(width);
  const head = headline(report);
  const kootas = kootaRows(report);
  const dimensions = dimensionRows(report);

  return (
    <Box
      testID="astral-match-scorecard"
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
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
        {props.title ?? 'Kundli Milan'}
      </Text>

      <Box
        style={{
          flexDirection: wide ? 'row' : 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Ring {...props} />
        <Box style={{ gap: 6, flex: wide ? 1 : undefined, alignItems: wide ? 'flex-start' : 'center' }}>
          {head.split ? (
            <Box testID="astral-match-split" style={{ gap: 2, alignItems: wide ? 'flex-start' : 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, textAlign: wide ? 'left' : 'center' }}>
                {head.split.firm} of {head.split.firmMax} firm points ·{' '}
                {head.split.pending} pending
              </Text>
              <Text style={{ fontSize: 11, color: theme.textPending, lineHeight: 16, textAlign: wide ? 'left' : 'center' }}>
                A birth time is missing, so the four nakshatra kootas were not
                scored. What is shown is computed; the rest is genuinely
                unknown, not estimated.
              </Text>
            </Box>
          ) : null}
          {report.pending_reasons.map((reason) => (
            <Text
              key={reason}
              style={{ fontSize: 11, color: theme.textPending, lineHeight: 16, textAlign: wide ? 'left' : 'center' }}
            >
              {reason}
            </Text>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 6 }}>
        <SectionLabel ui={ui} theme={theme}>Dimensions</SectionLabel>
        <Box testID="astral-match-dimensions" style={{ gap: 0 }}>
          {dimensions.map((dim, index) => (
            <Box
              key={dim.label}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
                paddingTop: 7,
                paddingBottom: 7,
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, minWidth: 96 }}>
                {dim.label}
              </Text>
              <Box style={{ flexShrink: 1, alignItems: 'flex-end', gap: 2 }}>
                {dim.parts.map((part) => (
                  <Text
                    key={part.name}
                    style={{
                      fontSize: 12,
                      color: part.pending ? theme.textPending : theme.text,
                      fontStyle: part.pending ? 'italic' : 'normal',
                      textAlign: 'right',
                    }}
                  >
                    {part.fraction
                      ? `${part.name} ${part.fraction}${part.provisional ? ' (provisional)' : ''}`
                      : `${part.name} — needs a birth time`}
                  </Text>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 6 }}>
        <SectionLabel ui={ui} theme={theme}>Ashtakoota</SectionLabel>
        <Box testID="astral-match-kootas" style={{ gap: 0 }}>
          {kootas.map((k, index) => (
            <Box
              key={k.name}
              testID={`astral-koota-${k.name.replace(/\s+/g, '-').toLowerCase()}`}
              style={{
                gap: 2,
                paddingTop: 7,
                paddingBottom: 7,
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: theme.border,
              }}
            >
              <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: k.pending ? theme.textPending : theme.text }}>
                  {k.name}
                </Text>
                {k.fraction ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{k.fraction}</Text>
                ) : (
                  <Text
                    testID={`astral-koota-pending-${k.name.replace(/\s+/g, '-').toLowerCase()}`}
                    style={{ fontSize: 11, fontWeight: '600', color: theme.warn, textTransform: 'uppercase', letterSpacing: 0.4 }}
                  >
                    needs a birth time
                  </Text>
                )}
              </Box>
              {k.meaning ? (
                <Text style={{ fontSize: 11, color: theme.textMuted }}>{k.meaning}</Text>
              ) : null}
              {k.note ? (
                <Text style={{ fontSize: 11, color: k.pending ? theme.textPending : theme.textMuted, fontStyle: k.pending ? 'italic' : 'normal' }}>
                  {k.note}
                </Text>
              ) : null}
              {k.provisional ? (
                <Text style={{ fontSize: 11, color: theme.warn }}>
                  Provisional — without a birth time the Moon may sit in the
                  neighbouring rashi.
                </Text>
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>

      {report.doshas.length ? (
        <Box style={{ gap: 6 }}>
          <SectionLabel ui={ui} theme={theme}>Doshas</SectionLabel>
          <Box testID="astral-match-doshas" style={{ gap: 8 }}>
            {report.doshas.map((d) => (
              <Box
                key={d.name}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  borderRadius: 10,
                  padding: 10,
                  gap: 3,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.warn }}>
                  {d.name}{d.provisional ? ' (provisional)' : ''}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textMuted, lineHeight: 16 }}>{d.detail}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      <Box style={{ gap: 3 }}>
        <PersonLine ui={ui} theme={theme} label="Partner A" person={report.groom} />
        <PersonLine ui={ui} theme={theme} label="Partner B" person={report.bride} />
      </Box>
    </Box>
  );
}

/**
 * The ring: filled by guna out of 36, labelled with the engine's band.
 *
 * The only number inside it is the payload's own fraction ("21.5 / 36"), or
 * nothing at all when the match is time-less — `matching.py` sets `total` to
 * null there and refuses to rescale, and so does this.
 */
function Ring(props: MatchScorecardProps): ReactNode {
  const { ui, theme, report } = props;
  const { Box, Text, Svg, Group, SvgCircle } = ui;
  const head = headline(report);
  const dash = ringDash(head.ringPoints, head.ringMax, RING_RADIUS);
  const diameter = 132;

  return (
    <Box testID="astral-match-ring" style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
      <Box style={{ width: diameter, height: diameter }}>
        <Svg width={diameter} height={diameter} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}>
          <SvgCircle
            cx={RING_CENTRE}
            cy={RING_CENTRE}
            r={RING_RADIUS}
            stroke={theme.border}
            strokeWidth={7}
            fill="none"
          />
          <Group rotation={-90} originX={RING_CENTRE} originY={RING_CENTRE}>
            <SvgCircle
              cx={RING_CENTRE}
              cy={RING_CENTRE}
              r={RING_RADIUS}
              // Gold, not violet: the ring is ceremony, and every affordance
              // on this card stays interactive-violet (ASTRAL-98).
              stroke={theme.ceremonial}
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash.filled} ${dash.circumference}`}
            />
          </Group>
        </Svg>
      </Box>
      <Box
        style={{
          width: diameter,
          height: diameter,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -diameter,
        }}
      >
        {head.score ? (
          <Text testID="astral-match-score" style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>
            {head.score}
          </Text>
        ) : (
          <Text testID="astral-match-score-absent" style={{ fontSize: 13, fontWeight: '600', color: theme.textPending, textAlign: 'center' }}>
            no total
          </Text>
        )}
        <Text testID="astral-match-band" style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {head.band}
        </Text>
      </Box>
    </Box>
  );
}

function SectionLabel({
  ui, theme, children,
}: {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  children: ReactNode;
}): ReactNode {
  const { Text } = ui;
  return (
    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

function PersonLine({
  ui, theme, label, person,
}: {
  ui: AstralRenderProps['ui'];
  theme: AstralRenderProps['theme'];
  label: string;
  person: MatchReportPayload['groom'];
}): ReactNode {
  const { Box, Text } = ui;
  const bits: string[] = [];
  if (person.moon_rashi) bits.push(`Moon in ${person.moon_rashi}`);
  if (person.nakshatra) bits.push(person.nakshatra);
  if (person.moon_rashi_alternatives.length) {
    bits.push(`or ${person.moon_rashi_alternatives.join(' / ')}`);
  }
  if (person.nakshatra_alternatives.length) {
    bits.push(`nakshatra may be ${person.nakshatra_alternatives.join(' / ')}`);
  }
  if (!person.time_known) bits.push('no birth time');
  return (
    <Box style={{ flexDirection: 'row', gap: 6 }}>
      <Text style={{ fontSize: 11, color: theme.textMuted, width: 74 }}>{label}</Text>
      <Text style={{ fontSize: 11, color: theme.text, flex: 1 }}>{bits.join(' · ')}</Text>
    </Box>
  );
}
