/**
 * docs/65 B2 — the birth-details carrier suggests places as the user types.
 * Rendered through the DOM primitives: the host's lookup is a mock, the
 * rows are the package's, the pick lands as text on the wire.
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import { correctionPlaceAskPayload } from '@wealthai/astral/fixtures';
import {
  InputRequestView,
  LIGHT_THEME,
  parseInputRequest,
  PLACE_SUGGEST_DEBOUNCE_MS,
} from '@wealthai/astral';

import { domPrimitives } from '@/components/astral/dom-primitives';

import { APP_WIDTH } from './render-shared';

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

const SUGGEST = jest.fn(async (q: string) =>
  q.toLowerCase().startsWith('ban')
    ? [
        { name: 'Bengaluru', country: 'IN', timezone: 'Asia/Kolkata' },
        { name: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok' },
      ]
    : []);

function renderPlaceAsk(suggest = SUGGEST) {
  const request = parseInputRequest(correctionPlaceAskPayload);
  if (!request) throw new Error('fixture did not parse');
  const sent: string[] = [];
  const view = render(
    <InputRequestView
      ui={domPrimitives}
      theme={LIGHT_THEME}
      width={APP_WIDTH}
      request={request}
      layout="page"
      submitLabel="Continue"
      onSend={(text) => sent.push(text)}
      suggestPlaces={suggest}
    />,
  );
  return { ...view, sent };
}

describe('place suggestions in the carrier (docs/65 B2)', () => {
  beforeEach(() => { SUGGEST.mockClear(); });
  const settle = () => new Promise((r) => setTimeout(r, PLACE_SUGGEST_DEBOUNCE_MS + 60));

  it('asks the host after the debounce, biggest first, and a tap picks the text', async () => {
    const { getByTestId, queryByTestId, sent } = renderPlaceAsk();
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ban' } });
    expect(SUGGEST).not.toHaveBeenCalled();
    await waitFor(() => expect(getByTestId('input-place-suggestion-0')).toBeTruthy());
    expect(SUGGEST).toHaveBeenCalledWith('Ban');
    expect(getByTestId('input-place-suggestion-0').textContent).toContain('Bengaluru');
    expect(getByTestId('input-place-suggestion-1').textContent).toContain('Bangkok');

    fireEvent.click(getByTestId('input-place-suggestion-0'));
    expect((getByTestId('input-field-pob') as HTMLInputElement).value).toBe('Bengaluru, IN');
    expect(queryByTestId('input-place-suggestion-0')).toBeNull();

    fireEvent.click(getByTestId('input-request-submit'));
    expect(sent).toHaveLength(1);
    expect(answerOf(sent[0]).values.pob).toBe('Bengaluru, IN');
  });

  it('does not ask below two characters, and a typed place still works without a pick', async () => {
    const { getByTestId, queryByTestId, sent } = renderPlaceAsk();
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'B' } });
    await settle();
    expect(SUGGEST).not.toHaveBeenCalled();
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Padrauna' } });
    await waitFor(() => expect(SUGGEST).toHaveBeenCalledWith('Padrauna'));
    expect(queryByTestId('input-place-suggestion-0')).toBeNull();
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values.pob).toBe('Padrauna');
  });

  it('a host without a lookup gets the plain field', () => {
    const request = parseInputRequest(correctionPlaceAskPayload)!;
    const { getByTestId, queryByTestId } = render(
      <InputRequestView ui={domPrimitives} theme={LIGHT_THEME} width={APP_WIDTH}
        request={request} layout="page" onSend={() => {}} />,
    );
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ban' } });
    expect(queryByTestId('input-place-suggestions-pob')).toBeNull();
  });
});
