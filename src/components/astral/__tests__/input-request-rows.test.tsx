/**
 * The board's frame-2 field ROW, and the disclosure presentation behind it.
 *
 * ── what this file is defending ────────────────────────────────────────────
 *
 * The owner's verbatim complaint about the shipped birth-details form was
 * that it is "very bad and difficult to enter details, gives impression of an
 * unpolished app". The measurable causes were four: three always-expanded
 * scroll wheels down one screen; no way to tell an answered field from an
 * unanswered one; a Continue button below the fold that would not say why it
 * was disabled; and a keyboard that covered the one free-text field.
 *
 * The first three are shared-component behaviour and are pinned here. They
 * are driven through the REAL DOM adapter with `pickerPresentation` flipped
 * to `'disclosure'` — the same object the browser ships, one capability
 * changed — because the root jest project has no React Native preset (F21
 * #4) and a hand-stubbed primitive set would test the stub. The fourth is a
 * screen-level fix (`KeyboardAvoidingView`) and is verified on the simulator.
 *
 * The negative half matters as much: the WEB must keep `<input type="date">`,
 * because that element already IS the row and a second box around it is the
 * same defect from the other side.
 */

import { fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import { birthDetailsAskPayload, inputRequestPayload } from '@wealthai/astral/fixtures';
import {
  InputRequestView,
  LIGHT_THEME,
  parseInputRequest,
  type AstralPrimitives,
} from '@wealthai/astral';

import { domPrimitives } from '@/components/astral/dom-primitives';

import { APP_WIDTH, renderInputRequest } from './render-shared';

/** the shipped adapter, with the ONE capability React Native declares */
const disclosureUi: AstralPrimitives = {
  ...domPrimitives,
  pickerPresentation: 'disclosure',
};

/** jsdom normalises `color: #1a1523` to `rgb(26, 21, 35)`, so compare
 *  through the same normalisation rather than against the token's literal. */
const asRendered = (hex: string) => {
  const probe = document.createElement('span');
  probe.style.color = hex;
  return probe.style.color;
};

const answerOf = (message: string) =>
  JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]);

function renderRows(
  payload: unknown = birthDetailsAskPayload,
  opts: {
    layout?: 'card' | 'page';
    requiredNote?: string;
    fieldIcons?: Record<string, React.ReactNode>;
  } = {},
) {
  const request = parseInputRequest(payload);
  if (!request) throw new Error('fixture did not parse');
  const sent: string[] = [];
  const view = render(
    <InputRequestView
      ui={disclosureUi}
      theme={LIGHT_THEME}
      width={APP_WIDTH}
      request={request}
      layout={opts.layout ?? 'page'}
      submitLabel="Continue"
      requiredNote={opts.requiredNote}
      fieldIcons={opts.fieldIcons}
      onSend={(text) => sent.push(text)}
    />,
  );
  return { ...view, sent };
}

describe('the field is a row until it is tapped', () => {
  it('draws a row per picker field and NO open picker', () => {
    const { getByTestId, queryByTestId } = renderRows();
    expect(getByTestId('input-row-dob')).toBeInTheDocument();
    expect(getByTestId('input-row-tob')).toBeInTheDocument();
    // …and the wheel itself is not on screen yet, which is the whole change:
    // three stacked wheels is what "unpolished" was measuring.
    expect(queryByTestId('input-field-dob')).toBeNull();
    expect(queryByTestId('input-picker-dob')).toBeNull();
  });

  it('opens the picker under the row it belongs to', () => {
    const { getByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-dob'));
    expect(getByTestId('input-picker-dob')).toBeInTheDocument();
    expect(getByTestId('input-field-dob')).toBeInTheDocument();
  });

  it('closes it again on a second tap', () => {
    const { getByTestId, queryByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.click(getByTestId('input-row-dob'));
    expect(queryByTestId('input-picker-dob')).toBeNull();
  });

  it('keeps exactly ONE picker open — opening the next closes the last', () => {
    const { getByTestId, queryByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.click(getByTestId('input-row-tob'));
    expect(getByTestId('input-picker-tob')).toBeInTheDocument();
    expect(queryByTestId('input-picker-dob')).toBeNull();
  });

  it('leaves `place` a live text box — a place is typed, not picked', () => {
    // Deliberate asymmetry, not an omission: a disclosure row here would cost
    // a tap and buy nothing, and it is the one field on frame 2 that already
    // looks like the board.
    const { getByTestId, queryByTestId } = renderRows();
    expect(queryByTestId('input-row-pob')).toBeNull();
    expect(getByTestId('input-field-pob')).toHaveAttribute('type', 'text');
  });
});

describe('an answered field looks answered', () => {
  it('shows the formatted answer where the label was', () => {
    const { getByTestId } = renderRows();
    expect(getByTestId('input-row-value-dob')).toHaveTextContent('Date of birth');
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    // a SENTENCE, not the ISO the wire carries (the same rule as the echo)
    expect(getByTestId('input-row-value-dob')).toHaveTextContent('2 Aug 1990');
    expect(getByTestId('input-row-value-dob').textContent).not.toContain('1990-08-02');
  });

  it('writes an answer in answered ink and an empty field in pending ink', () => {
    // The mutation that motivates this: drop the ternary and colour every row
    // `theme.text`. Every other assertion in this file still passes, and the
    // form goes back to looking identical before and after you answer it.
    const { getByTestId } = renderRows();
    const before = getByTestId('input-row-value-dob').style.color;
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    const after = getByTestId('input-row-value-dob').style.color;
    expect(before).not.toBe(after);
    expect(before).toBe(asRendered(LIGHT_THEME.textPending));
    expect(after).toBe(asRendered(LIGHT_THEME.text));
  });

  it('shows the 24-hour wire value as a 12-hour sentence', () => {
    const { getByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-tob'));
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '23:45' } });
    expect(getByTestId('input-row-value-tob')).toHaveTextContent('11:45 pm');
  });

  it('says "I don\'t know" ON the row, because that is an answer (ASTRAL-87)', () => {
    const { getByTestId } = renderRows();
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    expect(getByTestId('input-row-value-tob')).toHaveTextContent("I don't know");
    expect(getByTestId('input-row-value-tob').style.color).toBe(asRendered(LIGHT_THEME.text));
  });

  it('un-declining DELETES the key rather than writing an empty string', () => {
    // `''` on the wire is a value the engine refuses by name; an ABSENT key
    // is a question nobody answered, which is what "never mind" means. The
    // difference is only visible in the carrier, and only when the field is
    // optional — so the fixture's `tob` is made optional here (the engine
    // does emit optional time fields; `_input_request_block` marks a `choice`
    // and an `image` optional the same way).
    const optionalTime = {
      ...birthDetailsAskPayload,
      fields: birthDetailsAskPayload.fields.map((f) =>
        f.key === 'tob' ? { ...f, required: false } : f,
      ),
    };
    const { getByTestId, sent } = renderRows(optionalTime);
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    fireEvent.click(getByTestId('input-request-submit'));
    const values = answerOf(sent[0]).values;
    expect(values).toEqual({ dob: '1990-08-02', pob: 'Ranchi' });
    expect('tob' in values).toBe(false);
  });

  it('a required field TYPED THEN CLEARED does not light up Next in the bubble', () => {
    // The page layout was fixed for this and the bubble was not: `'pob' in
    // values` is true for `''`, so Next lit up and sent an empty place the
    // engine then refused by name. Asserted on the CARD layout, because that
    // is the one that had it.
    const { getByTestId } = renderRows(birthDetailsAskPayload, { layout: 'card' });
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.click(getByTestId('input-request-next'));   // to the time step
    fireEvent.click(getByTestId('input-row-tob'));
    fireEvent.change(getByTestId('input-field-tob'), { target: { value: '06:05' } });
    fireEvent.click(getByTestId('input-request-next'));   // to the place step
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    expect(getByTestId('input-request-next')).not.toBeDisabled();
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: '' } });
    expect(getByTestId('input-request-next')).toBeDisabled();
  });
});

describe('a disabled Continue says what it is waiting for', () => {
  it('names the still-missing fields in the ENGINE\'s own words', () => {
    const { getByTestId } = renderRows(birthDetailsAskPayload, {
      requiredNote: 'Still needed',
    });
    expect(getByTestId('input-request-submit')).toBeDisabled();
    const note = getByTestId('input-request-required-note');
    expect(note).toHaveTextContent('Still needed');
    expect(note).toHaveTextContent('Date of birth');
    expect(note).toHaveTextContent('Birth time');
    expect(note).toHaveTextContent('Birth place');
  });

  it('drops a field from the note the moment it is answered', () => {
    const { getByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    expect(getByTestId('input-request-required-note')).not.toHaveTextContent('Date of birth');
    expect(getByTestId('input-request-required-note')).toHaveTextContent('Birth place');
  });

  it('goes away entirely once Continue is live', () => {
    const { getByTestId, queryByTestId } = renderRows();
    fireEvent.click(getByTestId('input-row-dob'));
    fireEvent.change(getByTestId('input-field-dob'), { target: { value: '1990-08-02' } });
    fireEvent.click(getByTestId('input-request-unknown-tob'));
    fireEvent.change(getByTestId('input-field-pob'), { target: { value: 'Ranchi' } });
    expect(getByTestId('input-request-submit')).not.toBeDisabled();
    expect(queryByTestId('input-request-required-note')).toBeNull();
  });
});

describe('the host\'s glyph rides INSIDE the row, where the board draws it', () => {
  it('puts the icon in the row rather than beside the label', () => {
    const { getByTestId } = renderRows(birthDetailsAskPayload, {
      fieldIcons: { date: <i data-testid="glyph-date" /> },
    });
    expect(getByTestId('input-row-dob')).toContainElement(getByTestId('glyph-date'));
    expect(getByTestId('input-request-label-dob')).not.toContainElement(
      getByTestId('glyph-date'),
    );
  });
});

describe('the chat bubble gets the same rows (ASTRAL-91 — one component)', () => {
  it('draws the row in the card layout too', () => {
    // The bubble and the full-screen form are one component with different
    // chrome. A row that only appeared on the page would be the drift that
    // ASTRAL-91 exists to prevent, arriving through a layout prop.
    const { getByTestId, queryByTestId } = renderRows(inputRequestPayload, {
      layout: 'card',
    });
    expect(getByTestId('input-row-tob')).toBeInTheDocument();
    expect(queryByTestId('input-field-tob')).toBeNull();
    fireEvent.click(getByTestId('input-row-tob'));
    expect(getByTestId('input-field-tob')).toBeInTheDocument();
  });
});

describe('the WEB keeps its own control — no row, no second box', () => {
  it('renders `<input type="date">` directly and draws no disclosure row', () => {
    // `pickerPresentation` is absent on the DOM adapter, and that absence is
    // the contract's default. If this ever flips, the browser grows a row
    // that opens a native OS date sheet inside a second bordered box.
    const { getByTestId, queryByTestId } = renderInputRequest(
      birthDetailsAskPayload,
      APP_WIDTH,
      undefined,
      undefined,
      'page',
    );
    expect(domPrimitives.pickerPresentation).toBeUndefined();
    expect(queryByTestId('input-row-dob')).toBeNull();
    expect(getByTestId('input-field-dob')).toHaveAttribute('type', 'date');
  });
});
