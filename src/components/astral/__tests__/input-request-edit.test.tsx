/**
 * docs/49 ASTRAL-138 (amended 2026-08-26, owner bug 10761055) — the widget
 * when it is opened to CHANGE something rather than to collect it.
 *
 * One behaviour, and it is the difference between an edit and a form: the
 * picker opens at the value the engine already holds. Everything else about
 * the component is unchanged, and several assertions below exist to say so —
 * a correction that quietly grew its own submit path, its own field kinds or
 * its own "I don't know" would be the second widget ASTRAL-91 forbids.
 *
 * Driven through the REAL DOM adapter with `pickerPresentation` flipped to
 * `'disclosure'`, exactly as `input-request-rows.test.tsx` does and for the
 * same reason (F21 #4: the root jest project has no React Native preset, and
 * a hand-stubbed primitive set would test the stub).
 *
 * The fixtures are CAPTURED from the engine, so a payload whose shape drifts
 * fails here loudly instead of degrading in a renderer.
 */

import { fireEvent, render } from '@testing-library/react';
import {
  birthDetailsAskPayload,
  correctionAskPayload,
  correctionPlaceAskPayload,
} from '@wealthai/astral/fixtures';
import {
  InputRequestView,
  LIGHT_THEME,
  parseInputRequest,
  type AstralPrimitives,
} from '@wealthai/astral';

import { domPrimitives } from '@/components/astral/dom-primitives';

import { APP_WIDTH } from './render-shared';

const disclosureUi: AstralPrimitives = {
  ...domPrimitives,
  pickerPresentation: 'disclosure',
};

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

function renderEdit(payload: unknown = correctionAskPayload) {
  const request = parseInputRequest(payload);
  if (!request) throw new Error('fixture did not parse');
  const sent: string[] = [];
  const view = render(
    <InputRequestView
      ui={disclosureUi}
      theme={LIGHT_THEME}
      width={APP_WIDTH}
      request={request}
      layout="page"
      submitLabel="Continue"
      onSend={(text) => sent.push(text)}
    />,
  );
  return { ...view, sent, request };
}

describe('the correction ask carries what the engine already holds', () => {
  it('parses the engine`s pre-fill off the wire', () => {
    const request = parseInputRequest(correctionAskPayload)!;
    expect(request.ask).toBe('field_correction');
    expect(request.fields).toHaveLength(1);
    expect(request.fields[0].value).toBe('00:20');
  });

  it('opens the picker AT the stored value, not at a default', () => {
    const { getByTestId } = renderEdit();
    fireEvent.click(getByTestId('input-row-tob'));
    expect((getByTestId('input-field-tob') as HTMLInputElement).value).toBe('00:20');
  });

  it('shows the stored value on the row, formatted, before anything is tapped', () => {
    const { getByTestId } = renderEdit();
    // …and in answered ink: an edit that opened looking unanswered would be
    // asking the user to supply a value the engine can already see.
    expect(getByTestId('input-row-value-tob')).toHaveTextContent('12:20 am');
    expect(getByTestId('input-row-value-tob').textContent).not.toContain('00:20');
  });

  it('sends the SHOWN value when the user changes nothing', () => {
    // The correct default for an EDIT. A user who opens the sheet, reads the
    // disclosure, taps Continue and changes nothing has said "leave it" —
    // and an empty carrier there would be a required field the engine
    // refuses by name, on a screen the user thought they had finished.
    const { getByTestId, sent } = renderEdit();
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values).toEqual({ tob: '00:20' });
    expect(answerOf(sent[0]).ask).toBe('field_correction');
  });

  it('sends the CHANGED value once the user picks one', () => {
    const { getByTestId, sent } = renderEdit();
    fireEvent.click(getByTestId('input-row-tob'));
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '15:20' } });
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values).toEqual({ tob: '15:20' });
  });

  it('still lets a user WITHDRAW the time (ASTRAL-87 on the edit path)', () => {
    // Withdrawing a time is a legal edit, and it is the one the pre-fill
    // could most easily have broken: a seeded value that could not be
    // cleared would mean "I don't know" silently re-sent 00:20.
    const { getByTestId, sent } = renderEdit();
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    expect(getByTestId('input-row-value-tob')).toHaveTextContent("I don't know");
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values).toEqual({ tob: null });
  });

  it('carries the place pre-fill the same way', () => {
    const { getByTestId, sent } = renderEdit(correctionPlaceAskPayload);
    expect((getByTestId('input-field-pob') as HTMLInputElement).value).toBe('Padrauna');
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values).toEqual({ pob: 'Ranchi' });
  });

  it('leaves an ask WITHOUT pre-fills exactly as it was', () => {
    // The fresh user's form must not start out looking answered.
    const { getByTestId, queryByTestId } = render(
      <InputRequestView
        ui={disclosureUi}
        theme={LIGHT_THEME}
        width={APP_WIDTH}
        request={parseInputRequest(birthDetailsAskPayload)!}
        layout="page"
        submitLabel="Continue"
        onSend={() => {}}
      />,
    );
    expect(getByTestId('input-row-value-dob')).toHaveTextContent('Date of birth');
    expect(getByTestId('input-request-submit')).toBeDisabled();
    expect(queryByTestId('input-field-dob')).toBeNull();
  });

  it('is the SAME component and the same carrier — no second submit path', () => {
    const { getByTestId, sent } = renderEdit();
    fireEvent.click(getByTestId('input-request-submit'));
    // the typed fence, exactly as every other ask sends it…
    expect(sent[0]).toContain('```input_response');
    // …and the human echo beside it, so the transcript reads as a sentence
    expect(sent[0].split('```')[0].trim().length).toBeGreaterThan(0);
    expect(answerOf(sent[0]).type).toBe('input_response');
  });

  it('drops a pre-fill of a shape it cannot represent rather than rendering it', () => {
    const weird = {
      ...correctionAskPayload,
      fields: [{ ...correctionAskPayload.fields[0], value: { hour: 3 } }],
    };
    expect(parseInputRequest(weird)!.fields[0].value).toBeUndefined();
  });
});
