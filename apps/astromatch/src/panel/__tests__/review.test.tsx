/**
 * The review screen, RENDERED (B3 — and the reviewer's finding that nothing
 * ever rendered it).
 *
 * Every rule this screen carries is in a pure module with its own test; what
 * those tests cannot see is whether the screen actually draws them. The
 * ambiguous date is the case that proves the point: the pure view model was
 * right, the wire was right, and the screen still pre-filled one of the two
 * readings into a control that renders in the browser's locale — so the user
 * was shown "03/04/1989" and asked to approve it.
 *
 * `chrome` is faked here because `bridge.ts` speaks to the service worker for
 * the place lookup. Nothing else in this screen needs it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { installAstralDomHost } from '@wealthai/astral-dom';

import { editedKeys, type ParsedProfile } from '../../lib/confirmed';
import { parseProfileText } from '../../lib/parse-profile';
import { ReviewScreen } from '../review';

// ── a fake service worker ──────────────────────────────────────────────────

let resolveReply: { status: number; body: unknown } = {
  status: 200,
  body: {
    display_name: 'Pune, Maharashtra, India',
    latitude: 18.5,
    longitude: 73.8,
    timezone: 'Asia/Kolkata',
    timezone_candidates: [],
    place_candidates: [],
  },
};

beforeAll(() => {
  installAstralDomHost({ send: () => {} });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'test-extension',
      sendMessage: async (request: { type: string }) => {
        if (request.type === 'place/resolve') return { ok: true, value: resolveReply };
        if (request.type === 'place/suggest') {
          return { ok: true, value: { status: 200, body: { places: [] } } };
        }
        return { ok: true, value: null };
      },
      connect: () => ({
        onMessage: { addListener: () => {} },
        postMessage: () => {},
        disconnect: () => {},
      }),
    },
  };
});

function draw(parsed: ParsedProfile, onConfirmed = jest.fn()) {
  const view = render(
    <ReviewScreen parsed={parsed} source="paste" onConfirmed={onConfirmed} onBack={() => {}} />,
  );
  return { ...view, onConfirmed };
}

const AMBIGUOUS = parseProfileText(
  ['Name: Meera Iyer', 'Date of Birth: 03/04/1989', 'Place of Birth: Pune'].join('\n'),
);

describe('B3 — an ambiguous date is a QUESTION, not a default', () => {
  it('pre-fills neither reading', () => {
    draw(AMBIGUOUS);
    expect((screen.getByTestId('field-dob') as HTMLInputElement).value).toBe('');
  });

  it('offers both readings as chips, IN WORDS', () => {
    draw(AMBIGUOUS);
    const april = screen.getByTestId('field-dob-choice-1989-04-03');
    const march = screen.getByTestId('field-dob-choice-1989-03-04');
    expect(april.textContent).toBe('3 April 1989');
    expect(march.textContent).toBe('4 March 1989');
    // neither is pressed until the user presses one
    expect(april.getAttribute('aria-pressed')).toBe('false');
    expect(march.getAttribute('aria-pressed')).toBe('false');
  });

  it('never shows the ambiguous string itself on a chip', () => {
    draw(AMBIGUOUS);
    for (const chip of ['field-dob-choice-1989-04-03', 'field-dob-choice-1989-03-04']) {
      expect(screen.getByTestId(chip).textContent).not.toContain('03/04');
    }
  });

  it('fills the control and states the choice in words once one is picked', () => {
    draw(AMBIGUOUS);
    fireEvent.click(screen.getByTestId('field-dob-choice-1989-03-04'));
    expect((screen.getByTestId('field-dob') as HTMLInputElement).value).toBe('1989-03-04');
    expect(screen.getByTestId('field-dob-words').textContent).toBe('4 March 1989');
  });

  it('clears the basis once the user has acted on the field', () => {
    draw(AMBIGUOUS);
    expect(screen.getByTestId('field-dob-basis').textContent).toContain('two real dates');
    fireEvent.click(screen.getByTestId('field-dob-choice-1989-04-03'));
    expect(screen.queryByTestId('field-dob-basis')).toBeNull();
  });

  it('offers no "That\'s right" chip while the reading is ambiguous', () => {
    // "That's right" about WHICH reading? The two named chips are the only
    // honest affordance here.
    draw(AMBIGUOUS);
    expect(screen.queryByTestId('field-dob-accept')).toBeNull();
  });

  it('counts a picked chip as the USER\'s statement — capture_edited carries the date', async () => {
    /**
     * The judgement, pinned (docs/73 item 7): the machine produced TWO
     * readings and could not choose. The person who chose is the user, so the
     * date is `stated_by_user` and rides on `capture_edited` — not
     * `parsed_from_page`, which is for a value they accepted a machine's
     * reading of unchanged. Getting this backwards would let a later page
     * reading overwrite a date the user themselves picked.
     */
    const onConfirmed = jest.fn();
    draw(AMBIGUOUS, onConfirmed);
    fireEvent.click(screen.getByTestId('field-name-accept'));
    fireEvent.click(screen.getByTestId('field-dob-choice-1989-03-04'));
    fireEvent.click(screen.getByTestId('field-tob-decline'));
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() => expect(screen.getByTestId('place-resolved')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm'));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());

    const profile = onConfirmed.mock.calls[0][0];
    expect(profile.dob).toBe('1989-03-04');
    expect(profile.acts.dob).toBe('typed');
    expect(editedKeys(profile)).toContain('person2_dob');
    // the fields they merely accepted are NOT theirs to claim
    expect(editedKeys(profile)).not.toContain('person2_pob');
  });

  it('keeps confirm closed until the date has been acted on', async () => {
    draw(AMBIGUOUS);
    // The other three, through the affordances the screen actually offers.
    // (`fireEvent.change` with the value already in the box is a no-op in
    // React — the test that used it was asserting nothing about the name.)
    fireEvent.click(screen.getByTestId('field-name-accept'));
    fireEvent.click(screen.getByTestId('field-tob-decline'));
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() => expect(screen.getByTestId('place-resolved')).toBeTruthy());
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('field-dob-choice-1989-04-03'));
    await waitFor(() =>
      expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(false),
    );
  });
});

describe('every date row states its value in words, whatever the locale', () => {
  it('shows the words beside a date the user typed', () => {
    draw(parseProfileText('Name: A'));
    fireEvent.change(screen.getByTestId('field-dob'), { target: { value: '1994-05-14' } });
    expect(screen.getByTestId('field-dob-words').textContent).toBe('14 May 1994');
  });

  it('shows no words for an empty date', () => {
    draw(parseProfileText('Name: A'));
    expect(screen.queryByTestId('field-dob-words')).toBeNull();
  });
});

describe('the three states are drawn, one row each', () => {
  const MIXED = parseProfileText(
    [
      'Name: Meera Iyer',
      'Date of Birth: 14 May 1994',
      'Time of Birth: Not known',
      'Location: Pune',
    ].join('\n'),
  );

  it('says something different under each control', () => {
    draw(MIXED);
    expect(screen.getByTestId('field-name-state').textContent).toBe('read from what you gave me');
    expect(screen.getByTestId('field-tob-state').textContent).toBe('not there — please add it');
    expect(screen.getByTestId('field-pob-state').textContent).toBe('I worked this one out — check it');
  });

  it('shows the basis on the inferred row and on no other', () => {
    draw(MIXED);
    expect(screen.getByTestId('field-pob-basis').textContent).toContain('where they live');
    expect(screen.queryByTestId('field-name-basis')).toBeNull();
    expect(screen.queryByTestId('field-tob-basis')).toBeNull();
  });

  it('shows WHICH LINE each value was read from (B2)', () => {
    draw(MIXED);
    expect(screen.getByTestId('field-name-source').textContent).toBe(
      'read from: Name: Meera Iyer',
    );
    expect(screen.getByTestId('field-dob-source').textContent).toBe(
      'read from: Date of Birth: 14 May 1994',
    );
  });

  it('binds every control to its label and its sentences', () => {
    draw(MIXED);
    const label = document.querySelector('label[for="field-name"]');
    expect(label).not.toBeNull();
    const described = document.getElementById('field-name-wrap')?.getAttribute('aria-describedby');
    expect(described).toContain('field-name-state');
  });
});

describe('B2 — a two-person paste says so on every row it read', () => {
  const TWO = parseProfileText(
    ['Name: Meera Iyer', 'Brother', 'Name: Rohan Iyer', 'Date of Birth: 02/01/1990'].join('\n'),
  );

  it('shows the doubt under the name it did read', () => {
    draw(TWO);
    expect(screen.getByTestId('field-name-basis').textContent).toContain('more than one person');
  });

  it('leaves the second person\'s fields empty rather than filling them', () => {
    draw(TWO);
    expect((screen.getByTestId('field-dob') as HTMLInputElement).value).toBe('');
  });
});

describe('the place is resolved by the engine, and its failures are drawn', () => {
  const ONE = parseProfileText(['Name: A', 'Place of Birth: Pune'].join('\n'));

  afterEach(() => {
    resolveReply = {
      status: 200,
      body: {
        display_name: 'Pune, Maharashtra, India',
        latitude: 18.5,
        longitude: 73.8,
        timezone: 'Asia/Kolkata',
        timezone_candidates: [],
        place_candidates: [],
      },
    };
  });

  it('does not resolve anything until the user acts on the place', async () => {
    draw(ONE);
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByTestId('place-resolved')).toBeNull();
  });

  it('confirms the place the ENGINE resolved, not the string that was typed', async () => {
    // Follow-up 2: the user approved "Pune, Maharashtra, India" on this
    // screen — that is the place the chart is cast on, and sending the raw
    // "Pune" would make the reading's place a different string from the one
    // they saw.
    const onConfirmed = jest.fn();
    draw(ONE, onConfirmed);
    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'A B' } });
    fireEvent.change(screen.getByTestId('field-dob'), { target: { value: '1994-05-14' } });
    fireEvent.click(screen.getByTestId('field-tob-decline'));
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() => expect(screen.getByTestId('place-resolved')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm'));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(onConfirmed.mock.calls[0][0].pob).toBe('Pune, Maharashtra, India');
  });

  it('re-closes the gate when the place is edited after resolving', async () => {
    draw(ONE);
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() => expect(screen.getByTestId('place-resolved')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-pob'), { target: { value: 'Punjab' } });
    // the old resolution is not carried over to the new text
    await waitFor(() => expect(screen.queryByTestId('place-resolved')).toBeNull());
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the resolved place and its clock once the user accepts it', async () => {
    draw(ONE);
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() =>
      expect(screen.getByTestId('place-resolved').textContent).toContain('Asia/Kolkata'),
    );
  });

  it('blocks confirm with the designed sentence when the place cannot be found', async () => {
    resolveReply = { status: 404, body: { error: { message: 'Path not found: /api/v1/…' } } };
    draw(ONE);
    fireEvent.click(screen.getByTestId('field-pob-accept'));
    await waitFor(() =>
      expect(screen.getByTestId('place-problem').textContent).toContain("couldn't find that place"),
    );
    // the backend's misleading body is never shown
    expect(screen.getByTestId('place-problem').textContent).not.toContain('Path not found');
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
