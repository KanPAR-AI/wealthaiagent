/**
 * The common questions (docs/73 ASTRAL-336), drawn.
 *
 * Every decision is in `lib/chips.ts`: which chips this reading offers, which
 * are answered from the payload already on screen, and what the instant
 * answers say — all of it the engine's own words. This file puts them on
 * buttons and renders the answer through the shared `Narration`.
 *
 * ── the label is the promise ──────────────────────────────────────────────
 *
 * Each chip says whether it is instant or whether it asks. A promise of
 * "instant" that sometimes takes twenty seconds is worse than no promise, and
 * the label is computed from the same plan the tap executes, so the two
 * cannot disagree.
 */

import { DARK_THEME, type MatchReportPayload } from '@wealthai/astral';
import { Narration } from '@wealthai/astral-dom';

import { chipsFor, type ChipId, type ChipPlan } from '../lib/chips';
import { PANEL_WIDTH } from '../lib/config';

const theme = DARK_THEME;

export interface ChipAnswerState {
  /** `'save'` is not a chip: the engine's word about a SAVE arrives on the
   *  same side channel, for the same reason — it must not replace the
   *  scorecard the user is looking at. */
  id: ChipId | 'save';
  label: string;
  /** an instant answer, or the streamed text of a model turn */
  text: string;
  streaming: boolean;
  /** the stream died after bytes had arrived */
  truncated: boolean;
  error?: string;
  /**
   * F385 — the SAVE whose turn came back empty.
   *
   * Not a failure and not a success: the engine's save is written before it
   * narrates, so an empty turn means "we cannot tell". The card must not say
   * "Nothing was saved", which is the failed-save sentence and would be a
   * claim about a write nobody observed.
   */
  uncertain?: boolean;
}

export function ChipRow({
  report,
  answer,
  onPick,
}: {
  report: MatchReportPayload;
  answer: ChipAnswerState | null;
  onPick: (id: ChipId, label: string, plan: ChipPlan) => void;
}) {
  const chips = chipsFor(report);
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: theme.textMuted, letterSpacing: '0.04em' }}>
        COMMON QUESTIONS
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} data-testid="chips">
        {chips.map((chip) => {
          const instant = chip.plan.kind === 'instant';
          const selected = answer?.id === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              data-testid={`chip-${chip.id}`}
              data-cost={instant ? 'instant' : 'asks'}
              aria-pressed={selected}
              onClick={() => onPick(chip.id, chip.label, chip.plan)}
              style={{
                border: `1px solid ${selected ? theme.accent : theme.border}`,
                background: selected ? theme.accent : 'transparent',
                color: selected ? theme.surface : theme.text,
                borderRadius: '999px',
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {chip.label}
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  opacity: 0.75,
                }}
              >
                {instant ? 'INSTANT' : 'ASKS'}
              </span>
            </button>
          );
        })}
      </div>
      {answer ? <ChipAnswer answer={answer} /> : null}
    </div>
  );
}

function ChipAnswer({ answer }: { answer: ChipAnswerState }) {
  return (
    <div
      data-testid="chip-answer"
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>{answer.label}</span>
      {answer.error ? (
        <span style={{ fontSize: '13px', color: theme.warn, lineHeight: 1.45 }}>
          {answer.error}
        </span>
      ) : null}
      {answer.text ? (
        <Narration
          text={answer.text}
          color={theme.textMuted}
          strongColor={theme.text}
          lineColor={theme.border}
          width={PANEL_WIDTH}
          testID="chip-narration"
        />
      ) : answer.streaming ? (
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Asking…</span>
      ) : null}
      {answer.truncated ? (
        <span data-testid="chip-truncated" style={{ fontSize: '12px', color: theme.warn }}>
          That answer was cut off before it finished — the connection dropped.
        </span>
      ) : null}
    </div>
  );
}
