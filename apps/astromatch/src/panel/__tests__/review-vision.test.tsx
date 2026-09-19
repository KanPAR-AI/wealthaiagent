/**
 * Review & confirm, over VISION candidates (docs/73 ASTRAL-333).
 *
 * The same screen the paste path uses — that is the row, and the test that
 * matters is that it is literally the same component, with confidence added
 * and nothing pre-confirmed.
 *
 * `fixtures/extract-table-00.json` is the live engine's own answer to one of
 * its own synthetic screenshots (captured 2026-09-19). The low-confidence and
 * inferred cases below are CONSTRUCTED, and they have to be: the subject
 * there is what the SCREEN does with a state, not whether the client parses
 * what the engine sends — which is what the captured fixture proves.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { installAstralDomHost } from '@wealthai/astral-dom';

import { candidatesToParsed } from '../../lib/extract';
import { ReviewScreen } from '../review';

const CAPTURED = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', 'lib', '__tests__', 'fixtures', 'extract-table-00.json'),
    'utf8',
  ),
);

beforeAll(() => {
  installAstralDomHost({ send: () => {} });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'test-extension',
      sendMessage: async (request: { type: string }) => {
        if (request.type === 'place/resolve') {
          return {
            ok: true,
            value: {
              status: 200,
              body: {
                display_name: 'Coimbatore, Tamil Nadu, India',
                timezone: 'Asia/Kolkata',
                timezone_candidates: [],
                place_candidates: [],
              },
            },
          };
        }
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

const draw = (body: unknown, onConfirmed = jest.fn()) => {
  const view = render(
    <ReviewScreen
      parsed={candidatesToParsed(body)}
      source="snapshot"
      onConfirmed={onConfirmed}
      onBack={() => {}}
    />,
  );
  return { view, onConfirmed };
};

describe('the captured response drives the three states', () => {
  /**
   * The COPY ruling, pinned. The three stacked lines under every field —
   * the state, the confidence, the source — are ONE sentence on an image
   * path, and the old first line ("read from what you gave me") was false
   * here: the user gave a screenshot, not a value.
   */
  it('draws ONE provenance sentence per field, and it says where and how sure', () => {
    draw(CAPTURED);
    expect(screen.getByTestId('field-name-state').textContent).toBe(
      'read off your snapshot — high confidence',
    );
    expect(screen.getByTestId('field-dob-state').textContent).toBe(
      'read off your snapshot — high confidence',
    );
    expect(screen.getByTestId('field-tob-state').textContent).toBe('not there — please add it');
    expect(screen.getByTestId('field-pob-state').textContent).toBe(
      'read off your snapshot — high confidence',
    );
  });

  it('never says the user GAVE a value they did not give', () => {
    draw(CAPTURED);
    expect(document.body.textContent).not.toContain('read from what you gave me');
  });

  it('collapses the three lines into the one — no second confidence or source row', () => {
    draw(CAPTURED);
    expect(screen.queryByTestId('field-name-confidence')).toBeNull();
    expect(screen.queryByTestId('field-name-source')).toBeNull();
  });

  it('never guesses the missing field — the control opens EMPTY', () => {
    draw(CAPTURED);
    expect((screen.getByTestId('field-tob') as HTMLInputElement).value).toBe('');
    // and no confidence is claimed about a field that was not found
    expect(screen.queryByTestId('field-tob-confidence')).toBeNull();
  });

  it('names the SNAPSHOT — §4 carries no source line, so none is invented', () => {
    draw(CAPTURED);
    for (const key of ['name', 'dob', 'pob']) {
      expect(screen.getByTestId(`field-${key}-state`).textContent).toContain('your snapshot');
    }
    expect(document.body.textContent).not.toContain('read from: ');
  });

  it('confirms NOTHING on arrival', () => {
    draw(CAPTURED);
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('confirm-reason').textContent).toMatch(
      /check .* before I cast anything/i,
    );
    for (const key of ['name', 'dob', 'pob']) {
      expect(screen.getByTestId(`field-${key}-accept`).getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('confidence is a word, and a low one demands attention (INV-5)', () => {
  const withConfidence = (confidence: number) => ({
    candidates: {
      ...CAPTURED.candidates,
      name: { state: 'stated', value: 'Kavya Nair', confidence },
    },
  });

  it('bands it in the provenance line, never as a percentage headline', () => {
    for (const [confidence, ending] of [
      [0.94, 'read off your snapshot — high confidence'],
      [0.7, 'read off your snapshot — moderate confidence'],
      [0.4, "read off your snapshot — but I'm not sure I read it right"],
    ] as const) {
      const { view } = draw(withConfidence(confidence));
      expect(screen.getByTestId('field-name-state').textContent).toBe(ending);
      expect(document.body.textContent).not.toContain('%');
      view.unmount();
    }
  });

  it('a LOW confidence is said in words, not as a band name', () => {
    // "low confidence" is a label; "I'm not sure I read it right" is what it
    // means to somebody about to approve a stranger's birth date.
    draw(withConfidence(0.4));
    expect(screen.getByTestId('field-name-state').textContent).not.toContain('low confidence');
  });

  it('puts the number one tap away for the curious', () => {
    draw(withConfidence(0.52));
    const line = screen.getByTestId('field-name-state');
    expect(line.textContent).toBe("read off your snapshot — but I'm not sure I read it right");
    fireEvent.click(line);
    expect(line.textContent).toContain('0.52');
  });

  it('the one line is what a screen reader is pointed at (A1)', () => {
    draw(withConfidence(0.4));
    const described = document
      .getElementById('field-name-wrap')!
      .getAttribute('aria-describedby');
    expect(described).toContain('field-name-state');
  });

  it('a LOW-confidence STATED field is treated exactly like an inferred one', () => {
    // The row's clause: a machine that says it READ something and is only
    // half sure it read it right carries the same risk as one that reasoned
    // its way there, and the screen must not make the first look settled.
    const { view } = draw(withConfidence(0.4));
    const low = screen.getByTestId('field-name-state');
    const lowInk = low.getAttribute('style');
    view.unmount();

    const inferred = {
      candidates: {
        ...CAPTURED.candidates,
        name: {
          state: 'inferred',
          value: 'Kavya Nair',
          confidence: 0.4,
          basis: 'the heading may be a family name',
        },
      },
    };
    draw(inferred);
    expect(screen.getByTestId('field-name-state').getAttribute('style')).toBe(lowInk);
  });

  it('a HIGH-confidence stated field does NOT get the attention treatment', () => {
    const { view } = draw(withConfidence(0.94));
    const settled = screen.getByTestId('field-name-state').getAttribute('style');
    view.unmount();
    draw(withConfidence(0.4));
    expect(screen.getByTestId('field-name-state').getAttribute('style')).not.toBe(settled);
  });
});

describe('an inferred field carries its reason, always', () => {
  it('renders the basis the engine sent', () => {
    draw({
      candidates: {
        ...CAPTURED.candidates,
        pob: {
          state: 'inferred',
          value: 'Patna',
          confidence: 0.52,
          basis: 'the page says "Patna, Bihar" under Location, which may be where they live rather than born',
        },
      },
    });
    expect(screen.getByTestId('field-pob-basis').textContent).toContain('where they live');
  });

  it('a place read off an image still resolves on the ENGINE before confirm', async () => {
    const { onConfirmed } = draw(CAPTURED);
    for (const key of ['name', 'dob', 'pob']) {
      fireEvent.click(screen.getByTestId(`field-${key}-accept`));
    }
    fireEvent.click(screen.getByTestId('field-tob-decline'));
    await waitFor(() => expect(screen.queryByTestId('place-resolved')).not.toBeNull(), {
      timeout: 3000,
    });
    expect(screen.getByTestId('place-resolved').textContent).toContain('Asia/Kolkata');
    fireEvent.click(screen.getByTestId('confirm'));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    const profile = onConfirmed.mock.calls[0][0];
    // the RESOLVED place travels, not the string the extractor read
    expect(profile.pob).toBe('Coimbatore, Tamil Nadu, India');
    expect(profile.source).toBe('snapshot');
    // accepted unchanged → nothing claims `stated_by_user` (AMB-68(a))
    expect(profile.acts).toEqual({
      name: 'accepted',
      dob: 'accepted',
      tob: 'declined',
      pob: 'accepted',
    });
  });
});

describe('there is no bulk confirm, and no green tick over a guess', () => {
  it('offers no "confirm all"', () => {
    draw(CAPTURED);
    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(labels.join(' | ')).not.toMatch(/confirm all|accept all|looks right/i);
  });

  it('counts per-field confirmations — one accept does not open the gate', () => {
    draw(CAPTURED);
    fireEvent.click(screen.getByTestId('field-name-accept'));
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('field-dob-accept'));
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
