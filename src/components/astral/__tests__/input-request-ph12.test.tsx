/**
 * docs/49 PH-12 (ASTRAL-96 / ASTRAL-94 / ASTRAL-95) — the `date` and `place`
 * kinds, and the contested-place follow-up, through the REAL DOM adapter at
 * both widths ASTRAL-18 names.
 *
 * Both payloads are CAPTURED from the engine (`fixtures/payloads.ts`), not
 * hand-written, so a client that stops matching what the engine sends fails
 * here rather than on somebody's phone.
 *
 * The negative space is again half the point:
 *   - a `date` rendered as a text box, which is where `03/04/1989` lives
 *   - a place field that autocompletes or geocodes on this side of the wire
 *   - an IANA identifier shown to a human as a choice (F19)
 *   - a birth time that cannot be got past (ASTRAL-87 / ASTRAL-104)
 */

import { fireEvent } from '@testing-library/react';
import { birthDetailsAskPayload, placeChoiceAskPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderInputRequest } from './render-shared';

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

/** walk the card layout from the first field to the place field */
const toPlaceStep = (getByTestId: (id: string) => HTMLElement) => {
  fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
  fireEvent.click(getByTestId('input-request-next'));
  fireEvent.click(getByTestId('input-request-unknown'));
};

describe('ASTRAL-96 — the `date` kind is a real picker', () => {
  it('renders the host\'s own date control, not a text box', () => {
    const { getByTestId } = renderInputRequest(birthDetailsAskPayload);
    expect(getByTestId('input-field-dob')).toHaveAttribute('type', 'date');
  });

  it('bounds the wheel to plausible birth years without clamping anything', () => {
    const { getByTestId } = renderInputRequest(birthDetailsAskPayload);
    const field = getByTestId('input-field-dob');
    expect(field).toHaveAttribute('min', '1900-01-01');
    expect(field).toHaveAttribute('max', `${new Date().getFullYear()}-12-31`);
  });

  it('sends ISO, so `03/04/1989` never has to be guessed at', () => {
    const { getByTestId, sent } = renderInputRequest(birthDetailsAskPayload);
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1989-04-03' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '00:20' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Padrauna' } });
    fireEvent.click(getByTestId('input-request-next'));
    expect(answerOf(sent[0]).values).toEqual({
      dob: '1989-04-03',
      tob: '00:20',
      pob: 'Padrauna',
    });
  });

  it('does not warn — `date` is a kind this build knows now', () => {
    const warnings: string[] = [];
    renderInputRequest(birthDetailsAskPayload, APP_WIDTH, (m) => warnings.push(m));
    expect(warnings).toEqual([]);
  });
});

describe('ASTRAL-96 / ASTRAL-69 — the `place` kind, and what it must NOT do', () => {
  it('is a text field the user can type any place into', () => {
    const { getByTestId } = renderInputRequest(birthDetailsAskPayload);
    toPlaceStep(getByTestId);
    expect(getByTestId('input-field-pob')).toHaveAttribute('type', 'text');
  });

  it('shows the HOST\'s hint, so no market gets another market\'s form', () => {
    const { getByTestId } = renderInputRequest(
      birthDetailsAskPayload,
      APP_WIDTH,
      undefined,
      { place: 'City or town — add the state or country if the name is common' },
    );
    toPlaceStep(getByTestId);
    expect(getByTestId('input-field-pob')).toHaveAttribute(
      'placeholder',
      'City or town — add the state or country if the name is common',
    );
    // and the board's ZIP-code hint is nowhere near the component
    expect(document.body.textContent).not.toContain('ZIP');
  });

  it('is a BUILT kind, not a text box wearing one', () => {
    // The mutation that found this test: deleting `place` from the field
    // registry left every other assertion here green, because the unknown-kind
    // fallback is also a text input. The difference that matters is the
    // WARNING — `place` used to be a DEFERRED_KIND rendering as text, and a
    // build that silently returns to that state is the regression.
    const warnings: string[] = [];
    const { getByTestId } = renderInputRequest(
      birthDetailsAskPayload, APP_WIDTH, (m) => warnings.push(m));
    toPlaceStep(getByTestId);
    expect(getByTestId('input-field-pob')).toBeInTheDocument();
    expect(warnings).toEqual([]);
  });

  it('offers no suggestions of its own — the resolver owns that', () => {
    const { getByTestId, container } = renderInputRequest(birthDetailsAskPayload);
    toPlaceStep(getByTestId);
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Spring' } });
    expect(container.querySelector('datalist')).toBeNull();
    expect(container.querySelectorAll('[role="listbox"]')).toHaveLength(0);
    expect(getByTestId('input-field-pob')).toHaveAttribute('type', 'text');
  });
});

describe('ASTRAL-104 — a required birth time is never a trap', () => {
  it('carries "I don\'t know" and lets the form complete without a time', () => {
    const { getByTestId, sent } = renderInputRequest(birthDetailsAskPayload);
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.click(getByTestId('input-request-next'));
    expect(getByTestId('input-request-unknown')).toHaveTextContent("I don't know");
    fireEvent.click(getByTestId('input-request-unknown'));
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    fireEvent.click(getByTestId('input-request-next'));
    const body = answerOf(sent[0]);
    expect(body.values.tob).toBeNull();
    expect(body.values.dob).toBe('1990-08-02');
    expect(sent[0]).toContain("Birth time: I don't know");
  });
});

describe('ASTRAL-95 — the contested place is a choice of PLACES', () => {
  it('offers named places and no tz identifiers anywhere on screen', () => {
    const { getByTestId, container } = renderInputRequest(placeChoiceAskPayload);
    expect(
      getByTestId('input-option-pob-Springfield, MO, United States'),
    ).toHaveTextContent('Springfield, MO, United States');
    expect(container.textContent).not.toContain('America/');
    expect(container.textContent).not.toContain('UTC');
  });

  it('sends the option value the engine offered, and nothing else', () => {
    const { getByTestId, sent } = renderInputRequest(placeChoiceAskPayload);
    fireEvent.click(getByTestId('input-option-pob-Springfield, MA, United States'));
    fireEvent.click(getByTestId('input-request-next'));
    const body = answerOf(sent[0]);
    expect(body.ask).toBe('place_zone_unresolved');
    expect(body.values).toEqual({ pob: 'Springfield, MA, United States' });
  });

  it('renders from the one source file at 380 px and at app width', () => {
    for (const width of [PANEL_WIDTH, APP_WIDTH]) {
      const { getByTestId, unmount } = renderInputRequest(placeChoiceAskPayload, width);
      expect(getByTestId('input-request')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ASTRAL-104 — the same block, full-screen (the `page` layout)', () => {
  const renderPage = (hints?: Record<string, string>) =>
    renderInputRequest(birthDetailsAskPayload, APP_WIDTH, undefined, hints, 'page');

  it('shows every field at once, under one reason', () => {
    const { getByTestId, queryByTestId } = renderPage();
    expect(getByTestId('input-request-page')).toBeInTheDocument();
    for (const key of ['dob', 'tob', 'pob']) {
      expect(getByTestId(`input-field-${key}`)).toBeInTheDocument();
      expect(getByTestId(`input-request-label-${key}`)).toBeInTheDocument();
    }
    expect(getByTestId('input-request-reason')).toBeInTheDocument();
    // no step counter and no dismiss ×: this screen IS the question
    expect(queryByTestId('input-request-progress')).toBeNull();
    expect(queryByTestId('input-request-dismiss')).toBeNull();
  });

  it('holds Continue until the required fields are answered', () => {
    const { getByTestId, sent } = renderPage();
    expect(getByTestId('input-request-submit')).toBeDisabled();
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    expect(getByTestId('input-request-submit')).toBeDisabled();
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    expect(getByTestId('input-request-submit')).not.toBeDisabled();
    fireEvent.click(getByTestId('input-request-submit'));
    expect(sent).toHaveLength(1);
    expect(answerOf(sent[0]).values).toEqual({
      dob: '1990-08-02',
      pob: 'Ranchi',
      tob: null,
    });
  });

  it('sends through the SAME carrier the bubble does — never a sentence', () => {
    const { getByTestId, sent } = renderPage();
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '23:45' } });
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    fireEvent.click(getByTestId('input-request-submit'));
    expect(sent[0]).toContain('```input_response');
    const body = answerOf(sent[0]);
    expect(body.type).toBe('input_response');
    expect(body.ask).toBe('required_slots_missing');
    expect(body.values).toEqual({ dob: '1990-08-02', tob: '23:45', pob: 'Ranchi' });
    // …and the echo is presentation: strip the fence and NOTHING is left to
    // parse, which is the property the whole feature exists for (F18). It is
    // also a SENTENCE — the simulator showed "Date of birth: 1990-08-02" in
    // the transcript, which is the machine's form of the very field the date
    // picker exists to disambiguate.
    expect(sent[0].split('```')[0].trim()).toBe(
      'Date of birth: 2 Aug 1990 · Birth time: 11:45 pm · Birth place: Ranchi',
    );
  });

  it('renders the host\'s place hint here too', () => {
    const { getByTestId } = renderPage({ place: 'City or town' });
    expect(getByTestId('input-field-pob')).toHaveAttribute('placeholder', 'City or town');
  });

  it('shows no raw JSON, before or after the answer', () => {
    const { getByTestId, container } = renderPage();
    expect(container.textContent).not.toContain('input_response');
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    fireEvent.click(getByTestId('input-request-submit'));
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).not.toContain('input_response');
  });

  it('draws the contested-place follow-up in the same chrome', () => {
    // The follow-up arrives as an ordinary `input_request` block, so the
    // screen that renders one renders the other — no second component, no
    // client-side prediction of which ask comes next.
    const { getByTestId, sent } = renderInputRequest(
      placeChoiceAskPayload,
      APP_WIDTH,
      undefined,
      undefined,
      'page',
    );
    fireEvent.click(getByTestId('input-option-pob-Springfield, MO, United States'));
    fireEvent.click(getByTestId('input-request-submit'));
    expect(answerOf(sent[0]).values).toEqual({ pob: 'Springfield, MO, United States' });
  });
});
