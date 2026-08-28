/**
 * The palm reading (docs/49 ASTRAL-48/49) — the fourth discarded block.
 *
 * `palm_analysis` was not in the native binding's registry at all, so in the
 * Astral app the engine computed a full two-hand reading with its classical
 * citations and the client drew NOTHING, once per type, into a console
 * nobody was reading. That is precisely the failure `block-registry.ts` was
 * written for, one block type later.
 *
 * ONE implementation, per ASTRAL-18's rule: this component is written against
 * the primitive contract so the app screen, the chat bubble and any 380px
 * panel draw the same reading. Every decision — the heading, the provenance
 * caveat, the grouping, what is omitted — is in `view/palm.ts` and is unit
 * tested at the workspace root. This file lays out what that returns.
 *
 * Two things it deliberately does NOT draw:
 *
 *   - **A lifespan.** See `view/palm.ts`'s note: the engine still emits
 *     `predictions.lifespan_years` and ASTRAL-40's client obligation is that
 *     no chip shows it. The view model never reads the block, so there is
 *     nothing here to filter.
 *   - **The photo.** A palm image is an authorised file; fetching one needs a
 *     bearer token and a platform image loader, neither of which belongs in a
 *     shared renderer. The host passes its own already-authorised element in
 *     as `photo`, or passes nothing and the reading stands alone.
 */

import type { ReactNode } from 'react';

import type { PalmAnalysisPayload } from '../payloads';
import type { AstralRenderProps } from '../primitives';
import { isWide } from '../primitives';
import {
  palmHandTabs,
  palmHeader,
  palmLines,
  palmMargin,
  palmMarkings,
  palmMounts,
  palmProse,
  palmRuleGroups,
  type PalmLineRow,
  type PalmMountRow,
} from '../view/palm';

export interface PalmReadingProps extends AstralRenderProps {
  analysis: PalmAnalysisPayload;
  /** the host's own authorised image element, if it has one */
  photo?: ReactNode;
  /**
   * Which per-hand tab is open, and how to change it. Both optional: a host
   * that passes neither gets the combined reading with the per-hand sections
   * stacked, which is what a chat bubble wants.
   */
  openHand?: number | null;
  onOpenHand?: (index: number | null) => void;
}

export function PalmReadingView(props: PalmReadingProps): ReactNode {
  const { ui, theme, width, analysis, photo } = props;
  const { Box, Pressable, Text } = ui;
  const wide = isWide(width);

  const header = palmHeader(analysis);
  const prose = palmProse(analysis);
  const lines = palmLines(analysis);
  const mounts = palmMounts(analysis);
  const markings = palmMarkings(analysis);
  const groups = palmRuleGroups(analysis);
  const margin = palmMargin(analysis);
  const hands = palmHandTabs(analysis);
  const open = props.openHand ?? null;

  const sectionTitle = (text: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: theme.textMuted,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {text}
    </Text>
  );

  const featureRow = (row: PalmLineRow | PalmMountRow, key: string) => {
    const detail =
      'description' in row ? row.description : row.prominence;
    return (
      <Box key={key} testID="astral-palm-feature" style={{ gap: 2 }}>
        <Box
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, flexShrink: 1 }}>
            {row.name}
          </Text>
          {detail ? (
            <Text style={{ fontSize: 12, color: theme.textMuted, flexShrink: 1, textAlign: 'right' }}>
              {detail}
            </Text>
          ) : null}
        </Box>
        {row.interpretation ? (
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
            {row.interpretation}
          </Text>
        ) : null}
      </Box>
    );
  };

  return (
    <Box
      testID="astral-palm-reading"
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
      {/* ASTRAL-49: the subject label is ON the layer, not only in the prose,
          because a screenshot carries the picture and not the paragraph. */}
      <Box style={{ gap: 3 }}>
        <Text testID="astral-palm-label" style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>
          {header.label}
        </Text>
        {header.shape ? (
          <Text style={{ fontSize: 12, color: theme.textMuted }}>
            {header.element ? `${header.shape} · ${header.element}` : `${header.shape} hand`}
          </Text>
        ) : null}
      </Box>

      {photo ?? null}

      {/* The provenance sentence, and it is loudest exactly when it should be:
          a model-guessed hand carries a 0.65 reliability discount into every
          verdict the palm touches (`adjudication.py:57`). */}
      {header.provenance ? (
        <Box
          testID="astral-palm-provenance"
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 10,
            borderLeftWidth: 3,
            borderColor: header.discounted ? theme.warn : theme.border,
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 12, color: header.discounted ? theme.warn : theme.textMuted }}>
            {header.provenance}
          </Text>
        </Box>
      ) : null}

      {header.pairing ? (
        <Text testID="astral-palm-pairing" style={{ fontSize: 12, color: theme.textMuted }}>
          {header.pairing}
        </Text>
      ) : null}

      {prose.directAnswer ? (
        <Box style={{ gap: 4 }}>
          {sectionTitle('Your question')}
          <Text style={{ fontSize: 14, color: theme.text, lineHeight: 21 }}>
            {prose.directAnswer}
          </Text>
        </Box>
      ) : null}

      {prose.summary ? (
        <Text style={{ fontSize: 14, color: theme.text, lineHeight: 21 }}>{prose.summary}</Text>
      ) : null}

      {lines.length > 0 ? (
        <Box style={{ gap: 10 }}>
          {sectionTitle('Lines')}
          {lines.map((row, i) => featureRow(row, `line-${row.name}-${i}`))}
        </Box>
      ) : null}

      {mounts.length > 0 ? (
        <Box style={{ gap: 10 }}>
          {sectionTitle('Mounts')}
          {mounts.map((row, i) => featureRow(row, `mount-${row.name}-${i}`))}
        </Box>
      ) : null}

      {markings.length > 0 ? (
        <Box style={{ gap: 6 }}>
          {sectionTitle('Markings')}
          {markings.map((mark, i) => (
            <Text
              key={`mark-${i}`}
              testID="astral-palm-marking"
              style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}
            >
              {mark}
            </Text>
          ))}
        </Box>
      ) : null}

      {/* The classical layer. A claim with a page number behind it is a
          different object from a claim a model wrote, and the citation is
          drawn beside every one of them rather than once at the foot. */}
      {groups.length > 0 ? (
        <Box style={{ gap: 12 }}>
          {sectionTitle('Classical rules that fired')}
          {groups.map((group) => (
            <Box key={group.domain} testID="astral-palm-rule-group" style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>
                {group.domain}
              </Text>
              {group.rules.map((rule) => (
                <Box
                  key={rule.ruleId}
                  testID="astral-palm-rule"
                  style={{
                    backgroundColor: theme.surfaceAlt,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
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
                    <Text style={{ fontSize: 13, color: theme.text, flexShrink: 1 }}>
                      {rule.claim}
                    </Text>
                    {rule.polarity ? (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted }}>
                        {rule.polarity}
                      </Text>
                    ) : null}
                  </Box>
                  <Text testID="astral-palm-citation" style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>
                    {rule.citation}
                  </Text>
                  {rule.matched.length > 0 ? (
                    <Text style={{ fontSize: 11, color: theme.textPending }}>
                      {rule.matched.join(' · ')}
                    </Text>
                  ) : null}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      ) : null}

      {/* The per-hand split. Only when there genuinely are two hands: one tab
          is a control that does nothing, and `palmHandTabs` returns [] for a
          single-hand reading rather than making the caller check. */}
      {hands.length > 0 ? (
        <Box style={{ gap: 10 }}>
          {sectionTitle('Hand by hand')}
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {hands.map((hand, index) => (
              <Pressable
                key={hand.label}
                testID={`astral-palm-hand-${index}`}
                accessibilityLabel={hand.label}
                onPress={() => props.onOpenHand?.(open === index ? null : index)}
                style={{
                  borderWidth: 1,
                  borderColor: open === index ? theme.accent : theme.border,
                  backgroundColor: open === index ? theme.surfaceAlt : theme.surface,
                  borderRadius: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    fontWeight: open === index ? '600' : '400',
                  }}
                >
                  {hand.label}
                </Text>
              </Pressable>
            ))}
          </Box>
          {open !== null && hands[open] ? (
            <Box testID="astral-palm-hand-body" style={{ gap: 10 }}>
              {hands[open].reading ? (
                <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                  {hands[open].reading}
                </Text>
              ) : null}
              {hands[open].lines.map((row, i) => featureRow(row, `hl-${i}`))}
              {hands[open].mounts.map((row, i) => featureRow(row, `hm-${i}`))}
              {hands[open].markings.map((mark, i) => (
                <Text key={`hk-${i}`} style={{ fontSize: 12, color: theme.text }}>
                  {mark}
                </Text>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {/* The honesty margin. Seven rules fired and thirty-one abstained is a
          different examination from seven out of seven, and only one of those
          two is what happened. */}
      {margin ? (
        <Box testID="astral-palm-margin" style={{ gap: 2 }}>
          <Text style={{ fontSize: 11, color: theme.textPending }}>
            {margin.abstained === null
              ? `${margin.firedCount} classical rules fired.`
              : `${margin.firedCount} classical rules fired; ${margin.abstained} had no opinion on this hand.`}
          </Text>
          {margin.source ? (
            <Text style={{ fontSize: 11, color: theme.textPending }}>{margin.source}</Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
