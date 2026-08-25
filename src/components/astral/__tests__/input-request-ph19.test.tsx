/**
 * docs/49 PH-19 (ASTRAL-152) — the `multi` kind through the REAL DOM adapter,
 * at both widths ASTRAL-18 names.
 *
 * The payload is CAPTURED from the engine, so a client that stops matching
 * what the engine sends fails here rather than on somebody's phone.
 *
 * The negative space is most of the point:
 *   - a picker that silently REPLACES a pick when you are at the limit
 *   - a rank that is not visible, so the user cannot tell #1 from #3
 *   - a "multi" that quietly renders as a single choice and loses ranks 2
 *     and 3 without saying so
 *   - a warning fired for a kind this build now knows
 */

import { fireEvent } from '@testing-library/react';
import { prioritiesAskPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderInputRequest } from './render-shared';

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

const pick = (getByTestId: (id: string) => HTMLElement, key: string) =>
  fireEvent.click(getByTestId(`input-option-priorities-${key}`));

describe('ASTRAL-152 — an ordered pick, on the card', () => {
  it('draws every option the engine offered, and no field of its own', () => {
    const { getByTestId, queryByTestId } = renderInputRequest(prioritiesAskPayload);
    for (const key of [
      'temperament',
      'chemistry',
      'communication',
      'health_progeny',
      'family_life',
      'influence',
      'fortune',
      'values',
    ]) {
      expect(getByTestId(`input-option-priorities-${key}`)).toBeTruthy();
    }
    // no text box standing in for the ordered pick
    expect(queryByTestId('input-field-priorities')).toBeNull();
  });

  it('shows the RANK, so #1 is distinguishable from #3', () => {
    const { getByTestId } = renderInputRequest(prioritiesAskPayload);
    pick(getByTestId, 'health_progeny');
    pick(getByTestId, 'temperament');
    expect(getByTestId('input-option-priorities-health_progeny').textContent).toContain('1');
    expect(getByTestId('input-option-priorities-temperament').textContent).toContain('2');
  });

  it('round-trips the picks IN ORDER', () => {
    const { getByTestId, sent } = renderInputRequest(prioritiesAskPayload);
    pick(getByTestId, 'values');
    pick(getByTestId, 'chemistry');
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values.priorities).toEqual(['values', 'chemistry']);
  });

  it('reordering means removing and re-picking, and it round-trips', () => {
    const { getByTestId, sent } = renderInputRequest(prioritiesAskPayload);
    pick(getByTestId, 'values');
    pick(getByTestId, 'chemistry');
    pick(getByTestId, 'values'); // remove
    pick(getByTestId, 'values'); // and it is now #2
    expect(getByTestId('input-option-priorities-values').textContent).toContain('2');
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values.priorities).toEqual(['chemistry', 'values']);
  });

  it('stops at the engine\'s maximum instead of silently replacing a pick', () => {
    const { getByTestId, sent } = renderInputRequest(prioritiesAskPayload);
    pick(getByTestId, 'temperament');
    pick(getByTestId, 'chemistry');
    pick(getByTestId, 'values');
    pick(getByTestId, 'fortune'); // the fourth — a no-op, not a replacement
    expect(getByTestId('input-option-priorities-temperament').textContent).toContain('1');
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values.priorities).toEqual([
      'temperament',
      'chemistry',
      'values',
    ]);
  });

  it('says how many are picked and how to remove one', () => {
    const { getByTestId } = renderInputRequest(prioritiesAskPayload);
    expect(getByTestId('input-multi-count-priorities').textContent).toContain('0 of up to 3');
    pick(getByTestId, 'chemistry');
    expect(getByTestId('input-multi-count-priorities').textContent).toContain('1 of up to 3');
    expect(getByTestId('input-multi-count-priorities').textContent).toContain('Tap again');
  });

  it('lets a user skip the whole ask — it is optional, forever', () => {
    const { getByTestId, sent } = renderInputRequest(prioritiesAskPayload);
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values).toEqual({});
  });

  it('does not warn — `multi` is a kind this build knows now', () => {
    const warnings: string[] = [];
    renderInputRequest(prioritiesAskPayload, APP_WIDTH, (m) => warnings.push(m));
    expect(warnings).toEqual([]);
  });

  it('renders the interest tier unranked, with ticks rather than numbers', () => {
    const { getByTestId } = renderInputRequest(prioritiesAskPayload);
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-option-priority_interests-career'));
    expect(getByTestId('input-option-priority_interests-career').textContent).toContain('✓');
    expect(getByTestId('input-multi-count-priority_interests').textContent).toContain('1 picked');
  });
});

describe('ASTRAL-152 — the same control at 380 px and at app width', () => {
  it('round-trips in order in the side panel too', () => {
    const { getByTestId, sent } = renderInputRequest(prioritiesAskPayload, PANEL_WIDTH);
    pick(getByTestId, 'fortune');
    pick(getByTestId, 'influence');
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values.priorities).toEqual(['fortune', 'influence']);
  });

  it('renders the full-screen page layout with every field at once', () => {
    const { getByTestId } = renderInputRequest(
      prioritiesAskPayload,
      APP_WIDTH,
      undefined,
      undefined,
      'page',
    );
    expect(getByTestId('input-request-page')).toBeTruthy();
    expect(getByTestId('input-option-priorities-chemistry')).toBeTruthy();
    expect(getByTestId('input-option-priority_interests-career')).toBeTruthy();
    expect(getByTestId('input-field-priority_note')).toBeTruthy();
  });

  it('submits an empty set from the page layout — that is how you clear', () => {
    const { getByTestId, sent } = renderInputRequest(
      prioritiesAskPayload,
      APP_WIDTH,
      undefined,
      undefined,
      'page',
    );
    pick(getByTestId, 'chemistry');
    pick(getByTestId, 'chemistry');
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values.priorities).toEqual([]);
  });
});
