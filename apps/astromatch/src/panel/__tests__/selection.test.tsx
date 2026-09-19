/**
 * docs/73 ASTRAL-338, at the panel — what the user sees after they click
 * "Read what I've selected".
 *
 * Four states and no fifth: the review, the empty selection, Chrome's refusal
 * and a failure with its own sentence. `selection.test.ts` holds the greps
 * over the injected function and the worker; this file is the screen.
 *
 * The one thing every case checks besides its own subject: NOTHING is sent.
 * The selection is parsed by the same local parser the paste path uses, so
 * this path spends no capture allowance, makes no model call and puts no text
 * on the wire — `capture/extract` must never appear in the messages the panel
 * sent.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { App } from '../app';

let sent: Array<{ type: string; [k: string]: unknown }> = [];
let selectionReply: unknown = { outcome: { kind: 'needs-gesture' }, shortcut: '⌥⇧S' };
let pendingSelection: unknown = null;
const deliveryListeners: Array<(m: unknown, s: unknown) => void> = [];

/** SYNTHETIC biodata text, written for this test. Not copied from any page. */
const SELECTED = [
  'Name: Asha Verma',
  'Date of Birth: 14 May 1994',
  'Time of Birth: 07:45 AM',
  'Place of Birth: Nagpur, Maharashtra',
].join('\n');

beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'astromatch-test',
      onMessage: {
        addListener: (fn: (m: unknown, s: unknown) => void) => deliveryListeners.push(fn),
        removeListener: (fn: (m: unknown, s: unknown) => void) => {
          const at = deliveryListeners.indexOf(fn);
          if (at >= 0) deliveryListeners.splice(at, 1);
        },
      },
      sendMessage: async (request: { type: string; [k: string]: unknown }) => {
        sent.push(request);
        switch (request.type) {
          case 'auth/state':
            return { ok: true, value: { signedIn: true, identifier: 'walk@local.test' } };
          case 'selection/request':
            return { ok: true, value: selectionReply };
          case 'selection/pending':
            return { ok: true, value: pendingSelection };
          case 'capture/pending':
            return { ok: true, value: null };
          case 'place/resolve':
            return {
              ok: true,
              value: {
                status: 200,
                body: {
                  display_name: 'Nagpur, Maharashtra, India',
                  timezone: 'Asia/Kolkata',
                  timezone_candidates: [],
                  place_candidates: [],
                },
                resetsOn: null,
              },
            };
          case 'place/suggest':
            return { ok: true, value: { status: 200, body: { places: [] }, resetsOn: null } };
          default:
            return { ok: true, value: null };
        }
      },
      connect: () => ({
        onMessage: { addListener: () => {} },
        postMessage: () => {},
        disconnect: () => {},
      }),
    },
  };
});

beforeEach(() => {
  sent = [];
  selectionReply = { outcome: { kind: 'needs-gesture' }, shortcut: '⌥⇧S' };
  pendingSelection = null;
});

/** The panel, signed in, on the choose screen. */
async function open() {
  render(<App />);
  await screen.findByTestId('manual');
}

const nothingWasSent = () => {
  expect(sent.some((m) => m.type === 'capture/extract')).toBe(false);
  expect(sent.some((m) => m.type === 'match/start')).toBe(false);
};

describe('the control is there, because the capability is true', () => {
  it('offers the selection read beside the camera', async () => {
    await open();
    expect(screen.getByTestId('selection').textContent).toBe("Read what I've selected");
  });

  it('says what it will read, and what it will not', async () => {
    await open();
    const body = document.body.textContent ?? '';
    expect(body).toContain('Highlight their birth details on the page first.');
    expect(body).toContain('I read only the text');
    expect(body).not.toMatch(/coming soon|not yet available/i);
  });

  it('no longer claims the extension never reads a page — that is now false', () => {
    // Found by LOOKING at the walk's screenshot of this screen. The camera's
    // line said "I never read the page itself", and it sat directly above a
    // control whose whole job is to read part of a page. The claim is now
    // scoped to the camera, which is the only thing it was ever true of.
    const app = readFileSync(join(__dirname, '..', 'app.tsx'), 'utf8');
    expect(app).not.toContain('I never read the page');
    expect(app).toContain("The camera reads none of\n          the page's own text");
  });
});

describe('Chrome has granted nothing — the instruction, not a dead button', () => {
  it('names the SELECTION gestures, never the camera\'s', async () => {
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    const instruction = await screen.findByTestId('selection-instruction');
    expect(instruction.textContent).toContain('⌥⇧S');
    expect(instruction.textContent).toContain('Read my selection into AstroMatch');
    expect(instruction.textContent).not.toContain('Read this page into AstroMatch');
    nothingWasSent();
  });

  it('points at chrome://extensions/shortcuts when Chrome bound no key', async () => {
    selectionReply = { outcome: { kind: 'needs-gesture' }, shortcut: null };
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    const instruction = await screen.findByTestId('selection-instruction');
    expect(instruction.textContent).toContain('chrome://extensions/shortcuts');
  });
});

describe('nothing was selected — a sentence, not four empty rows', () => {
  it('says which step is missing, and offers to try again', async () => {
    selectionReply = { outcome: { kind: 'empty' }, shortcut: '⌥⇧S' };
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    const note = await screen.findByTestId('selection-empty');
    expect(note.textContent).toBe('Select the birth details on the page first, then try again.');
    // the review screen is NOT what they landed on
    expect(screen.queryByTestId('field-name')).toBeNull();
    expect(screen.getByTestId('selection-retry')).toBeTruthy();
    nothingWasSent();
  });
});

describe('a real selection lands on the review screen, parsed here', () => {
  beforeEach(() => {
    selectionReply = {
      outcome: { kind: 'selected', text: SELECTED, gesture: 'panel-button' },
      shortcut: '⌥⇧S',
    };
  });

  it('shows what was read, field by field, confirmed by nobody yet', async () => {
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    const name = (await screen.findByTestId('field-name')) as HTMLInputElement;
    expect(name.value).toBe('Asha Verma');
    expect((screen.getByTestId('field-dob') as HTMLInputElement).value).toBe('1994-05-14');
    expect((screen.getByTestId('field-pob') as HTMLInputElement).value).toBe(
      'Nagpur, Maharashtra',
    );
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
    nothingWasSent();
  });

  it('says the values came from the SELECTION, in words that are true of it', async () => {
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    await screen.findByTestId('field-name');
    const state = screen.getByTestId('field-dob-state').textContent ?? '';
    expect(state).toBe('read from what you selected on the page');
    // never the snapshot path's sentence: no image was involved
    expect(document.body.textContent).not.toContain('your snapshot');
    // …and never "what you gave me", which is the paste path's act
    expect(state).not.toContain('what you gave me');
  });

  it('keeps the LINE each value was read from (B2)', async () => {
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    await screen.findByTestId('field-name');
    expect(screen.getByTestId('field-dob-source').textContent).toBe(
      'read from: Date of Birth: 14 May 1994',
    );
  });

  it('shows no percentage anywhere', async () => {
    await open();
    fireEvent.click(screen.getByTestId('selection'));
    await screen.findByTestId('field-name');
    expect(document.body.textContent).not.toContain('%');
  });
});

describe('the two gesture doors land on the same screen', () => {
  it('a selection the worker PUSHES opens the review', async () => {
    await open();
    await act(async () => {
      deliveryListeners.forEach((fn) =>
        fn({ type: 'selection/delivered', text: SELECTED, gesture: 'command' }, {
          id: 'astromatch-test',
        }),
      );
    });
    const name = (await screen.findByTestId('field-name')) as HTMLInputElement;
    expect(name.value).toBe('Asha Verma');
    nothingWasSent();
  });

  it('a selection HELD for a panel that was closed is collected on open', async () => {
    pendingSelection = { text: SELECTED, gesture: 'command', at: Date.now() };
    render(<App />);
    const name = (await screen.findByTestId('field-name')) as HTMLInputElement;
    expect(name.value).toBe('Asha Verma');
    await waitFor(() =>
      expect(sent.some((m) => m.type === 'selection/pending')).toBe(true),
    );
  });

  it('ignores a delivery from another extension', async () => {
    await open();
    await act(async () => {
      deliveryListeners.forEach((fn) =>
        fn({ type: 'selection/delivered', text: SELECTED, gesture: 'command' }, {
          id: 'somebody-else',
        }),
      );
    });
    expect(screen.queryByTestId('field-name')).toBeNull();
  });
});
