/**
 * docs/49 ASTRAL-87/88/89/91/92 — the input widget, through the REAL DOM
 * adapter (`dom-primitives`), at both widths ASTRAL-18 names.
 *
 * The negative space is the point of half of these:
 *   - a `time` field with no way out (ASTRAL-87)
 *   - an unknown kind rendering a dead card instead of a text input
 *     (ASTRAL-91)
 *   - a label reaching the wire as if it were a value (ASTRAL-88)
 *   - raw JSON anywhere a user can see it (the PH-11 gate)
 */

import { fireEvent } from '@testing-library/react';
import { inputRequestPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderInputRequest } from './render-shared';

/**
 * A THREE-field ask. The engine emits two today (time + confidence), so this
 * is synthetic on purpose: ASTRAL-92's claim is about the pacing of a
 * multi-field ask, and PH-12 adds the fields that make three real.
 */
const threeFieldPayload = {
  type: 'input_request',
  ask: 'partner_birth_details',
  reason: 'Three quick things and I can run the match.',
  fields: [
    { key: 'person2_dob', kind: 'text', label: "Partner's date of birth", required: true },
    { key: 'person2_tob', kind: 'time', label: "Partner's birth time", required: true, allow_unknown: true },
    { key: 'person2_pob', kind: 'text', label: "Partner's birth place", required: false },
  ],
};

const unknownKindPayload = {
  type: 'input_request',
  ask: 'synthetic',
  reason: '',
  fields: [{ key: 'pob', kind: 'colour_wheel', label: 'Birth place', required: true }],
};

describe('ASTRAL-92 — one question per screen, with an honest count', () => {
  it('shows the first question and the count, not a wall of form', () => {
    const { getByTestId, queryByText } = renderInputRequest(threeFieldPayload);
    expect(getByTestId('input-request-progress')).toHaveTextContent('1 of 3');
    expect(getByTestId('input-request-label')).toHaveTextContent("Partner's date of birth");
    expect(queryByText("Partner's birth place")).toBeNull();
  });

  it('paces through the fields one at a time', () => {
    const { getByTestId } = renderInputRequest(threeFieldPayload);
    fireEvent.change(getByTestId('input-field-person2_dob'), { target: { value: '1992-01-05' } });
    fireEvent.click(getByTestId('input-request-next'));
    expect(getByTestId('input-request-progress')).toHaveTextContent('2 of 3');
    expect(getByTestId('input-request-label')).toHaveTextContent("Partner's birth time");
  });

  it('shows `reason` once, at the top, and never again per field', () => {
    const { getByTestId, queryByTestId } = renderInputRequest(threeFieldPayload);
    expect(getByTestId('input-request-reason')).toBeInTheDocument();
    fireEvent.change(getByTestId('input-field-person2_dob'), { target: { value: '1992-01-05' } });
    fireEvent.click(getByTestId('input-request-next'));
    expect(queryByTestId('input-request-reason')).toBeNull();
  });

  it('shows no count for a single-field ask — "1 of 1" is noise', () => {
    const single = { ...threeFieldPayload, fields: [threeFieldPayload.fields[1]] };
    const { queryByTestId } = renderInputRequest(single);
    expect(queryByTestId('input-request-progress')).toBeNull();
  });

  it('renders from the one source file at 380 px and at app width', () => {
    for (const width of [PANEL_WIDTH, APP_WIDTH]) {
      const { getByTestId, unmount } = renderInputRequest(inputRequestPayload, width);
      expect(getByTestId('input-request')).toBeInTheDocument();
      expect(getByTestId('input-field-tob')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ASTRAL-87 — "I don\'t know" is an answer, and the time is native', () => {
  it('renders the browser\'s own time control, not a text box', () => {
    const { getByTestId } = renderInputRequest(inputRequestPayload);
    expect(getByTestId('input-field-tob')).toHaveAttribute('type', 'time');
  });

  it('offers a way out on every time field', () => {
    const { getByTestId } = renderInputRequest(inputRequestPayload);
    expect(getByTestId('input-request-unknown')).toHaveTextContent("I don't know");
  });

  it('sends an explicit null — an ANSWER, not a dismissal', () => {
    const { getByTestId, sent } = renderInputRequest(inputRequestPayload);
    fireEvent.click(getByTestId('input-request-unknown'));
    // it advances to the (optional) confidence field, which is then skipped
    fireEvent.click(getByTestId('input-request-next'));
    expect(sent).toHaveLength(1);
    const body = JSON.parse(/```input_response\n([\s\S]*?)```/.exec(sent[0])![1]);
    expect(body.values.tob).toBeNull();
    expect(sent[0]).toContain("Birth time: I don't know");
  });

  it('cannot be submitted empty — Done is disabled until required is answered', () => {
    const { getByTestId, sent } = renderInputRequest(inputRequestPayload);
    expect(getByTestId('input-request-next')).toBeDisabled();
    fireEvent.click(getByTestId('input-request-next'));
    expect(sent).toHaveLength(0);
  });

  it('a picked time reaches the wire in 24-hour form', () => {
    const { getByTestId, sent } = renderInputRequest(inputRequestPayload);
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '23:45' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-option-birth_time_confidence-exact'));
    fireEvent.click(getByTestId('input-request-next'));
    const body = JSON.parse(/```input_response\n([\s\S]*?)```/.exec(sent[0])![1]);
    expect(body.values).toEqual({ tob: '23:45', birth_time_confidence: 'exact' });
  });
});

describe('ASTRAL-88 — the choice is closed over the engine\'s options', () => {
  it('renders exactly the options the engine offered, with their labels', () => {
    const { getByTestId } = renderInputRequest(inputRequestPayload);
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '09:00' } });
    fireEvent.click(getByTestId('input-request-next'));
    expect(getByTestId('input-option-birth_time_confidence-exact')).toHaveTextContent(
      'Exact — off a record or a clock',
    );
    expect(getByTestId('input-option-birth_time_confidence-approximate')).toBeInTheDocument();
  });

  it('sends the option VALUE, never the label the user read', () => {
    const { getByTestId, sent } = renderInputRequest(inputRequestPayload);
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '09:00' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-option-birth_time_confidence-approximate'));
    fireEvent.click(getByTestId('input-request-next'));
    const body = JSON.parse(/```input_response\n([\s\S]*?)```/.exec(sent[0])![1]);
    expect(body.values.birth_time_confidence).toBe('approximate');
  });
});

describe('ASTRAL-91 — an unknown kind degrades to a working question', () => {
  it('renders a text input and warns once, by name', () => {
    const warnings: string[] = [];
    const { getByTestId } = renderInputRequest(unknownKindPayload, APP_WIDTH, (m) =>
      warnings.push(m),
    );
    expect(getByTestId('input-field-pob')).toHaveAttribute('type', 'text');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('colour_wheel');
    // ...and it does NOT claim to have rendered nothing, because it did not.
    expect(warnings[0]).toContain('text input');
  });

  it('does not warn for a kind it knows', () => {
    const warnings: string[] = [];
    renderInputRequest(inputRequestPayload, APP_WIDTH, (m) => warnings.push(m));
    expect(warnings).toEqual([]);
  });

  it('the degraded field is still ANSWERABLE — never a dead card', () => {
    const { getByTestId, sent } = renderInputRequest(unknownKindPayload);
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Padrauna' } });
    fireEvent.click(getByTestId('input-request-next'));
    const body = JSON.parse(/```input_response\n([\s\S]*?)```/.exec(sent[0])![1]);
    expect(body.values.pob).toBe('Padrauna');
  });
});

describe('ASTRAL-89 — the echo, the dismissal, and no nagging', () => {
  it('collapses to a quiet receipt once answered', () => {
    const { getByTestId, queryByTestId } = renderInputRequest(inputRequestPayload);
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '00:20' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(getByTestId('input-request-submitted')).toHaveTextContent('Birth time: 12:20 am');
    expect(queryByTestId('input-request')).toBeNull();
  });

  it('collapses to a silent one-line affordance when dismissed', () => {
    const { getByTestId, queryByTestId, sent } = renderInputRequest(inputRequestPayload);
    fireEvent.click(getByTestId('input-request-dismiss'));
    expect(queryByTestId('input-request')).toBeNull();
    const collapsed = getByTestId('input-request-collapsed');
    expect(collapsed).toHaveTextContent('Birth time');
    // it says nothing further and sends nothing — a dismissal is not an answer
    expect(sent).toEqual([]);
    // ...and it stays available: tapping it reopens the ask.
    fireEvent.click(collapsed);
    expect(getByTestId('input-request')).toBeInTheDocument();
  });
});

describe('the PH-11 gate — no raw JSON is ever visible', () => {
  it('renders nothing a user could mistake for a payload', () => {
    const { container } = renderInputRequest(inputRequestPayload);
    expect(container.textContent).not.toContain('input_response');
    expect(container.textContent).not.toContain('"type"');
    expect(container.textContent).not.toContain('{');
  });

  it('...and still nothing after the answer collapses it', () => {
    const { getByTestId, container } = renderInputRequest(inputRequestPayload);
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '00:20' } });
    fireEvent.click(getByTestId('input-request-next'));
    fireEvent.click(getByTestId('input-request-next'));
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).not.toContain('input_response');
  });
});
