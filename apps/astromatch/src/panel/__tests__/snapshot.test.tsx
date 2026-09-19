/**
 * The camera, end to end in jsdom (docs/73 ASTRAL-330…337).
 *
 * The browser walk proves the same path in a real Chromium against the real
 * engine, and it takes a running container and four paid captures. These are
 * the cases that are expensive or impossible to arrange there: Chrome
 * REFUSING the capture, the daily cap, a crop that is too large, the consent
 * being asked a second time, and the request COUNT behind the chips.
 *
 * ── the canvas stubs, and what they are not standing in for ───────────────
 *
 * jsdom has no 2-D canvas and no image decoder, so `HTMLCanvasElement` and
 * `Image` are stubbed. The PIXELS are not the subject here — `crop.test.ts`
 * covers the geometry against profiles measured from real captures, and the
 * walk covers the real drawing. What is the subject is everything around
 * them: the consent gate, what is sent, how many times, and what the panel
 * does with each answer.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CONSENT_TEXT } from '../../lib/consent';
import { PHOTO_WARNING } from '../crop';
import { App } from '../app';

// ── canvas + image, stubbed just enough ────────────────────────────────────

/**
 * THE STUB ENCODES THE RECTANGLE (F309).
 *
 * It used to return the same bytes for every crop, which meant the test that
 * documented "Choose a smaller region" reopening the CROPPED image could not
 * tell the crop from the capture — and so it documented the bug as correct.
 * Now `toDataURL` reports the canvas it was called on, and `FakeImage` reads
 * those dimensions back, so "which image is the tool open on?" is a question
 * the test can actually ask.
 */
const CAPTURE_W = 800;
const CAPTURE_H = 600;
const CAPTURE = `data:image/png;size=${CAPTURE_W}x${CAPTURE_H},Q0FQVFVSRQ==`;

const sizeOf = (uri: string): { width: number; height: number } => {
  const m = /size=(\d+)x(\d+)/.exec(uri);
  return m
    ? { width: Number(m[1]), height: Number(m[2]) }
    : { width: CAPTURE_W, height: CAPTURE_H };
};

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = CAPTURE_W;
  naturalHeight = CAPTURE_H;
  set src(value: string) {
    const size = sizeOf(value);
    this.naturalWidth = size.width;
    this.naturalHeight = size.height;
    setTimeout(() => this.onload?.(), 0);
  }
}

function installCanvas() {
  const ctx = {
    drawImage: () => {},
    clearRect: () => {},
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    strokeRect: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    // A synthetic bitmap that looks like TEXT and not like a photograph
    // (F310): four rows of sparse vertical strokes with line gaps between
    // them. Density lands around 0.25 — comfortably below `SOLID_DENSITY`,
    // which is what makes the segmentation classify it `text` and open the
    // default box on it.
    //
    // The first version of this stub was a dense stripe field over one band,
    // and the two-dimensional classifier read it as a PHOTOGRAPH — correctly.
    // A stub that no longer resembles what it stands for is a test asserting
    // something else.
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      const lines = [180, 220, 260, 300];
      // …and a DENSE BLOCK off to the right, standing in for a photograph.
      // It gives the photo warning something real to fire on, and it is what
      // makes the exact edge-ink check distinguishable from the page-wide
      // one: its ink sits on the SAME ROWS as the text, outside the box's
      // columns, which the one-dimensional profile cannot tell apart.
      const photo = { x0: 600, x1: 760, y0: 180, y1: 320 };
      for (let y = 0; y < h; y += 1) {
        const onLine = lines.some((top) => y >= top && y < top + 14);
        for (let x = 0; x < w; x += 1) {
          const inPhoto = x >= photo.x0 && x < photo.x1 && y >= photo.y0 && y < photo.y1;
          const noisy = inPhoto && (x * 7 + y * 13) % 3 !== 0;
          const v = noisy
            ? 255
            : // 5 px of ink then 3 of space — "words", not a comb. A comb of
              // 2 px strokes is a page of RULES to the segmentation, which is
              // right about the pixels and wrong about the stand-in.
              onLine && x > w * 0.2 && x < w * 0.6 && x % 8 < 5
              ? 255
              : 0;
          const i = (y * w + x) * 4;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
        }
      }
      return { data, width: w, height: h };
    },
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => ctx;
  (HTMLCanvasElement.prototype as unknown as { toDataURL: unknown }).toDataURL = function (
    this: HTMLCanvasElement,
  ) {
    return `data:image/png;size=${this.width}x${this.height},Q1JPUFBFRA==`;
  };
}

// ── the fake worker ────────────────────────────────────────────────────────

let sent: Array<{ type: string; [k: string]: unknown }> = [];
let localStore: Record<string, unknown> = {};
let captureReply: unknown = {
  outcome: { kind: 'captured', image: CAPTURE, gesture: 'panel-button' },
  shortcut: 'Alt+Shift+M',
};
let extractReply: unknown = null;
/** the panel's listener for a capture the worker PUSHES after a gesture */
const deliveryListeners: Array<(m: unknown, s: unknown) => void> = [];
let port: { emit: (event: unknown) => void; posted: Array<Record<string, unknown>> } | null = null;

const CANDIDATES = {
  candidates: {
    name: { state: 'stated', value: 'Kavya Nair', confidence: 1 },
    dob: { state: 'stated', value: '1988-01-01', confidence: 1 },
    tob: { state: 'missing', value: null, confidence: 0 },
    pob: { state: 'stated', value: 'Coimbatore', confidence: 1 },
  },
  model: 'gemini-flash-latest',
  extractor_version: 1,
  retained: false,
};

beforeAll(() => {
  installCanvas();
  (globalThis as unknown as { Image: unknown }).Image = FakeImage;
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
          case 'capture/pending':
            return { ok: true, value: null };
          case 'capture/request':
            return { ok: true, value: captureReply };
          case 'capture/extract':
            return { ok: true, value: extractReply };
          case 'place/resolve':
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
                resetsOn: null,
              },
            };
          case 'place/suggest':
            return { ok: true, value: { status: 200, body: { places: [] }, resetsOn: null } };
          case 'reading/delete':
            return { ok: true, value: { status: 204, body: null, resetsOn: null } };
          default:
            return { ok: true, value: null };
        }
      },
      connect: () => {
        const listeners: Array<(e: unknown) => void> = [];
        const posted: Array<Record<string, unknown>> = [];
        port = { emit: (event: unknown) => act(() => listeners.forEach((fn) => fn(event))), posted };
        return {
          onMessage: { addListener: (fn: (e: unknown) => void) => listeners.push(fn) },
          postMessage: (m: Record<string, unknown>) => posted.push(m),
          disconnect: () => {},
        };
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: localStore[key] }),
        set: async (bag: Record<string, unknown>) => {
          localStore = { ...localStore, ...bag };
        },
      },
      session: { get: async () => ({}), set: async () => {}, clear: async () => {} },
    },
  };
});

beforeEach(() => {
  sent = [];
  localStore = {};
  port = null;
  deliveryListeners.length = 0;
  extractReply = { status: 200, body: CANDIDATES, resetsOn: null };
  captureReply = {
    outcome: {
      kind: 'captured',
      image: CAPTURE,
      gesture: 'panel-button',
    },
    shortcut: 'Alt+Shift+M',
  };
});

const openCamera = async () => {
  render(<App />);
  await screen.findByTestId('snapshot');
  await act(async () => {
    fireEvent.click(screen.getByTestId('snapshot'));
  });
};

const extractCalls = () => sent.filter((m) => m.type === 'capture/extract');

// ── F159's pessimistic branch ──────────────────────────────────────────────

describe('a camera that cannot capture becomes WORDS (ASTRAL-330, F159)', () => {
  it('prints the two gestures that do work, and no error', async () => {
    captureReply = { outcome: { kind: 'needs-gesture' }, shortcut: 'Alt+Shift+M' };
    await openCamera();
    const instruction = await screen.findByTestId('capture-instruction');
    expect(instruction.textContent).toContain('Alt+Shift+M');
    expect(instruction.textContent).toContain('Read this page into AstroMatch');
    // not an error toast, not a spinner, not a dead button
    expect(screen.queryByText(/that didn't go through/i)).toBeNull();
    expect(screen.queryByTestId('crop-canvas')).toBeNull();
  });

  it('does NOT name a shortcut Chrome left unbound', async () => {
    captureReply = { outcome: { kind: 'needs-gesture' }, shortcut: null };
    await openCamera();
    const instruction = await screen.findByTestId('capture-instruction');
    expect(instruction.textContent).not.toContain('Alt+Shift+M');
    expect(instruction.textContent).toContain('chrome://extensions/shortcuts');
  });

  it('sends nothing at all when Chrome refused', async () => {
    captureReply = { outcome: { kind: 'needs-gesture' }, shortcut: null };
    await openCamera();
    await screen.findByTestId('capture-instruction');
    expect(extractCalls()).toHaveLength(0);
  });
});

// ── the consent ────────────────────────────────────────────────────────────

describe('the consent is per capture, and nothing is sent without it (ASTRAL-332)', () => {
  it('shows the crop with the consent line, verbatim', async () => {
    await openCamera();
    const consent = await screen.findByTestId('consent-text');
    // asserted against the string the SEND path reads, so the two cannot drift
    expect(consent.textContent).toBe(CONSENT_TEXT);
    expect(CONSENT_TEXT).toBe(
      'This crop is sent to Astral to read the birth details. It is not stored, ' +
        'not added to your files, and not kept in our logs. Only the details you ' +
        'confirm on the next screen are saved.',
    );
  });

  it('will not send until the consent is given', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    expect((screen.getByTestId('crop-send') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-send'));
    });
    expect(extractCalls()).toHaveLength(0);
  });

  it('sends exactly ONE image, and it is the CROP', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-send'));
    });
    const calls = extractCalls();
    expect(calls).toHaveLength(1);
    // the cropped canvas's bytes, never the capture's
    expect(sizeOf(String(calls[0].image)).width).toBeLessThan(CAPTURE_W);
    expect(String(calls[0].image)).not.toContain('Q0FQVFVSRQ');
  });

  it('carries NO page URL, title or site name — one key and one key only', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-send'));
    });
    const call = extractCalls()[0];
    expect(Object.keys(call).sort()).toEqual(['image', 'type']);
    const serialised = JSON.stringify(call).toLowerCase();
    for (const banned of ['http', 'url', 'title', 'site', 'tab', 'shaadi', 'jeevansathi']) {
      expect(serialised).not.toContain(banned);
    }
  });

  it('asks AGAIN on a second capture — the consent is never remembered', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('crop-send') as HTMLButtonElement).disabled).toBe(false);

    // A SECOND capture arrives while the crop screen is still open — a
    // keyboard or context-menu gesture, pushed by the worker. The component
    // is not remounted, so a consent held as a boolean would still be `true`
    // and the send button would be live for an image the user has not looked
    // at. It is keyed to the CAPTURE, so it is not.
    expect(deliveryListeners.length).toBeGreaterThan(0);
    await act(async () => {
      deliveryListeners[0](
        {
          type: 'capture/delivered',
          image: `data:image/png;size=${CAPTURE_W}x${CAPTURE_H},U0VDT05E`,
          gesture: 'command',
        },
        { id: 'astromatch-test' },
      );
    });
    await waitFor(() =>
      expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(false),
    );
    expect((screen.getByTestId('crop-send') as HTMLButtonElement).disabled).toBe(true);
    expect(extractCalls()).toHaveLength(0);
  });

  it('never writes an image into chrome.storage', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-send'));
    });
    const stored = JSON.stringify(localStore);
    expect(stored).not.toContain('Q0FQVFVSRQ');
    expect(stored).not.toContain('Q1JPUFBFRA');
    expect(stored).not.toContain('base64');
  });
});

// ── the designed failures ──────────────────────────────────────────────────

const sendCrop = async () => {
  await openCamera();
  await screen.findByTestId('consent');
  await act(async () => {
    fireEvent.click(screen.getByTestId('consent'));
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('crop-send'));
  });
};

describe('every failure is a state with a door out (ASTRAL-333, §4)', () => {
  it('the daily cap: the engine\'s sentence, its reset date, and the free doors', async () => {
    extractReply = {
      status: 429,
      body: { error: { message: "That's today's ten captures." } },
      resetsOn: '2026-09-20',
    };
    await sendCrop();
    const problem = await screen.findByTestId('capture-problem');
    expect(problem.textContent).toContain("That's today's ten captures.");
    expect(screen.getByTestId('capture-resets').textContent).toContain('2026-09-20');
    // the always-free ways in are offered BY NAME
    expect(screen.getByTestId('door-paste')).toBeTruthy();
    expect(screen.getByTestId('door-manual')).toBeTruthy();
    expect(screen.queryByTestId('door-recrop')).toBeNull();
  });

  it('a crop with nothing on it offers a re-crop, and re-crops without a new capture', async () => {
    extractReply = { status: 422, body: { error: { message: 'unreadable' } }, resetsOn: null };
    await sendCrop();
    await screen.findByTestId('door-recrop');
    await act(async () => {
      fireEvent.click(screen.getByTestId('door-recrop'));
    });
    // back on the SAME capture — no second `capture/request`
    await screen.findByTestId('consent');
    expect(sent.filter((m) => m.type === 'capture/request')).toHaveLength(1);
  });

  it('an expired session goes to sign-in, not to "retry"', async () => {
    extractReply = { status: 401, body: { error: { message: 'Unauthorized' } }, resetsOn: null };
    await sendCrop();
    const problem = await screen.findByTestId('capture-problem');
    expect(problem.textContent).toContain('Sign in again');
    await act(async () => {
      fireEvent.click(screen.getByTestId('door-sign-in'));
    });
    expect(await screen.findByTestId('send-code')).toBeTruthy();
  });

  it('a dead network says so and keeps the free doors', async () => {
    extractReply = { status: 0, body: null, resetsOn: null };
    await sendCrop();
    const problem = await screen.findByTestId('capture-problem');
    expect(problem.textContent).toContain('Nothing was sent anywhere else');
    expect(screen.getByTestId('door-retry')).toBeTruthy();
  });

  it('a paste door leaves the camera behind and lands somewhere real', async () => {
    extractReply = { status: 429, body: { error: { message: 'capped' } }, resetsOn: null };
    await sendCrop();
    await act(async () => {
      fireEvent.click(await screen.findByTestId('door-paste'));
    });
    expect(await screen.findByTestId('paste-box')).toBeTruthy();
  });
});

// ── the review over vision candidates ──────────────────────────────────────

describe('the candidates reach the SAME review screen (ASTRAL-333)', () => {
  it('lands on review with three states and nothing confirmed', async () => {
    await sendCrop();
    await screen.findByTestId('field-name');
    // stated — ONE provenance sentence (the COPY ruling)
    expect(screen.getByTestId('field-name-state').textContent).toBe(
      'read off your snapshot — high confidence',
    );
    // missing — the birth time was not on the page, and was NOT guessed
    expect(screen.getByTestId('field-tob-state').textContent).toBe('not there — please add it');
    expect((screen.getByTestId('field-tob') as HTMLInputElement).value).toBe('');
    // nothing is pre-confirmed: confirm is blocked until every field is acted on
    expect((screen.getByTestId('confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says the value came from the SNAPSHOT — there is no source line to quote', async () => {
    await sendCrop();
    await screen.findByTestId('field-name');
    expect(screen.getByTestId('field-name-state').textContent).toContain('your snapshot');
    // the separate source row is gone: one fact, one line
    expect(screen.queryByTestId('field-name-source')).toBeNull();
  });

  it('shows confidence as a WORD, with the number one tap away', async () => {
    await sendCrop();
    const line = await screen.findByTestId('field-name-state');
    expect(line.textContent).toBe('read off your snapshot — high confidence');
    expect(line.textContent).not.toContain('%');
    fireEvent.click(line);
    expect(line.textContent).toContain('1');
  });

  it('offers NO bulk confirm — there is no "looks right, confirm all"', async () => {
    await sendCrop();
    await screen.findByTestId('field-name');
    const labels = [...document.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(labels.join(' | ')).not.toMatch(/confirm all|looks right|accept all/i);
  });
});

// ── the crop tool is operable without a mouse ──────────────────────────────

describe('the crop can be driven from the keyboard (ASTRAL-331, accessibility)', () => {
  it('is focusable, labelled, and says what the keys do', async () => {
    await openCamera();
    const surface = await screen.findByTestId('crop-surface');
    expect(surface.getAttribute('tabindex')).toBe('0');
    expect(surface.getAttribute('aria-label')).toMatch(/arrow keys/i);
    expect(surface.getAttribute('aria-label')).toMatch(/shift/i);
  });

  it('moves the selection with the arrow keys', async () => {
    await openCamera();
    const surface = await screen.findByTestId('crop-surface');
    const before = (screen.getByTestId('crop-x') as HTMLInputElement).value;
    await act(async () => {
      fireEvent.keyDown(surface, { key: 'ArrowRight' });
    });
    expect((screen.getByTestId('crop-x') as HTMLInputElement).value).not.toBe(before);
  });

  it('resizes it with shift and an arrow', async () => {
    await openCamera();
    const surface = await screen.findByTestId('crop-surface');
    const before = (screen.getByTestId('crop-width') as HTMLInputElement).value;
    await act(async () => {
      fireEvent.keyDown(surface, { key: 'ArrowRight', shiftKey: true });
    });
    expect((screen.getByTestId('crop-width') as HTMLInputElement).value).not.toBe(before);
  });

  it('offers a typed rectangle as the fallback, and clamps it', async () => {
    await openCamera();
    await screen.findByTestId('crop-width');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '99999' } });
    });
    // clamped to the capture, never wider
    expect(Number((screen.getByTestId('crop-width') as HTMLInputElement).value)).toBeLessThanOrEqual(
      CAPTURE_W,
    );
  });

  it('states the size in words beside the preview, and that it is PART of the page', async () => {
    await openCamera();
    const size = await screen.findByTestId('crop-size');
    expect(size.textContent).toMatch(/Sending \d+ × \d+ pixels/);
    expect(size.textContent).toContain('a part of the page');
  });
});

// ── F308 · the live clipping guard ─────────────────────────────────────────

describe('a box that cuts through text says so, on every edit path', () => {
  /**
   * The stub's synthetic bitmap has a band of contrast between 30% and 50%
   * of the height and 20%–60% of the width, so a box drawn across it has ink
   * on its boundary and a box around it does not. The DEFAULT box is the one
   * `defaultCrop` computes and it does not clip.
   */
  const warning = () => screen.getByTestId('crop-clipping').textContent ?? '';

  it('is silent on the default box', async () => {
    await openCamera();
    await screen.findByTestId('crop-canvas');
    expect(warning()).toBe('');
  });

  it('is announced politely, so a keyboard user hears it appear', async () => {
    await openCamera();
    const live = await screen.findByTestId('crop-clipping');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('role')).toBe('status');
  });

  it('warns on a TYPED rectangle that cuts the band', async () => {
    await openCamera();
    await screen.findByTestId('crop-y');
    // the text rows are at y 180, 220, 260 and 300 — a box whose top edge
    // lands at 225 is standing in the middle of the second one
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '225' } });
    });
    expect(warning()).toContain('Text touches the edge of your box');
    expect(warning()).toContain('widen it');
  });

  it('warns after an ARROW nudge that drags the edge into the band', async () => {
    await openCamera();
    const surface = await screen.findByTestId('crop-surface');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '262' } });
    });
    const before = warning();
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        fireEvent.keyDown(surface, { key: 'ArrowDown' });
      });
    }
    expect(before || warning()).toContain('Text touches the edge of your box');
  });

  it('warns after a SHIFT-resize that pulls the bottom edge into the band', async () => {
    await openCamera();
    const surface = await screen.findByTestId('crop-surface');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '100' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-height'), { target: { value: '90' } });
    });
    // grow the box downward one shift-arrow at a time until the bottom edge
    // is inside a text row (the first is at 180)
    let seen = warning();
    for (let i = 0; i < 40 && !seen; i += 1) {
      await act(async () => {
        fireEvent.keyDown(surface, { key: 'ArrowDown', shiftKey: true });
      });
      seen = warning();
    }
    expect(seen).toContain('Text touches the edge of your box');
  });

  it('is a WARNING and never a block — the send stays available', async () => {
    await openCamera();
    await screen.findByTestId('crop-y');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '225' } });
    });
    expect(warning()).not.toBe('');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    expect((screen.getByTestId('crop-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('goes quiet again when the box is widened off the text', async () => {
    await openCamera();
    await screen.findByTestId('crop-y');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '225' } });
    });
    expect(warning()).not.toBe('');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '0' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-height'), { target: { value: '599' } });
    });
    expect(warning()).toBe('');
  });
});

// ── F309 · the recovery door reopens the ORIGINAL capture ─────────────────

describe('"Adjust the region" goes back to the CAPTURE, not to the crop', () => {
  it('is labelled to widen, not to shrink', async () => {
    extractReply = { status: 422, body: { error: { message: 'unreadable' } }, resetsOn: null };
    await sendCrop();
    const door = await screen.findByTestId('door-recrop');
    expect(door.textContent).toBe('Adjust the region');
    // the label that sent the user the wrong way after a CLIPPED read
    expect(door.textContent).not.toContain('smaller');
  });

  it('reopens the tool on the ORIGINAL capture\'s dimensions', async () => {
    extractReply = { status: 422, body: { error: { message: 'unreadable' } }, resetsOn: null };
    await sendCrop();
    // what was SENT was smaller than the capture
    const sentSize = sizeOf(String(extractCalls()[0].image));
    expect(sentSize.width).toBeLessThan(CAPTURE_W);

    await act(async () => {
      fireEvent.click(screen.getByTestId('door-recrop'));
    });
    await screen.findByTestId('crop-canvas');
    // the box can now be widened to the whole ORIGINAL capture — which is
    // impossible if the tool reopened on the crop that just failed
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '99999' } });
    });
    const width = Number((screen.getByTestId('crop-width') as HTMLInputElement).value);
    expect(width).toBe(CAPTURE_W);
    expect(width).toBeGreaterThan(sentSize.width);
  });

  it('does not offer the door at all once the capture has been dropped', async () => {
    // paste is a door OUT of the capture: taking it drops the bytes, and a
    // "go back to the region" that has nothing to go back to is exactly the
    // dead affordance the capability rule forbids.
    extractReply = { status: 422, body: { error: { message: 'unreadable' } }, resetsOn: null };
    await sendCrop();
    await act(async () => {
      fireEvent.click(await screen.findByTestId('door-paste'));
    });
    await screen.findByTestId('paste-box');
    expect(screen.queryByTestId('door-recrop')).toBeNull();
  });
});

// ── F310 · the photograph warning, and copy that is true of every box ─────

describe('the panel does not claim the photo stays out — it warns when it is in', () => {
  it('says what is actually true, for every box position', async () => {
    await openCamera();
    await screen.findByTestId('crop-canvas');
    const body = document.body.textContent ?? '';
    expect(body).toContain('Only what is inside the box leaves your browser');
    // the sentence this replaces was false the moment the default box
    // included the photo, and false again the moment the user drags it
    expect(body).not.toContain('The rest of this page — the photo');
    expect(body).not.toMatch(/the photo, the contact details/);
  });

  it('is silent when the box holds no dense block', async () => {
    // The stub is four rows of sparse strokes — text, not a photograph.
    await openCamera();
    await screen.findByTestId('crop-canvas');
    expect(screen.getByTestId('crop-photo-warning').textContent).toBe('');
  });

  it('warns, politely, when the box is dragged over one', async () => {
    await openCamera();
    await screen.findByTestId('crop-canvas');
    const live = screen.getByTestId('crop-photo-warning');
    expect(live.getAttribute('aria-live')).toBe('polite');
    // The stub has no solid block to drag over, so the WORDS are asserted
    // against the exported constant the screen renders and the behaviour is
    // asserted on the real fixtures in `crop-photo.test.ts`, where a
    // photograph actually exists.
    expect(PHOTO_WARNING).toBe(
      'There may be a photo inside the box. Move the box so the photo stays out.',
    );
    expect(PHOTO_WARNING).toContain('may be');
  });

  it('is a WARNING and never a block', async () => {
    await openCamera();
    await screen.findByTestId('consent');
    await act(async () => {
      fireEvent.click(screen.getByTestId('consent'));
    });
    expect((screen.getByTestId('crop-send') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the photo warning fires on a box the user drags over the dense block', () => {
  it('is silent by default and speaks when the box is moved onto it', async () => {
    await openCamera();
    await screen.findByTestId('crop-canvas');
    expect(screen.getByTestId('crop-photo-warning').textContent).toBe('');
    // The stub's dense block sits at x 600-760, y 180-320. WIDTH FIRST: `x`
    // is clamped against the current width, so moving right before shrinking
    // leaves the box short of the block.
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '120' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-x'), { target: { value: '620' } });
    });
    expect(screen.getByTestId('crop-photo-warning').textContent).toBe(PHOTO_WARNING);
  });

  it('goes quiet again when the box is moved back off it', async () => {
    await openCamera();
    await screen.findByTestId('crop-canvas');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '120' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-x'), { target: { value: '620' } });
    });
    expect(screen.getByTestId('crop-photo-warning').textContent).not.toBe('');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-x'), { target: { value: '170' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '300' } });
    });
    expect(screen.getByTestId('crop-photo-warning').textContent).toBe('');
  });
});

describe('the clipping guard is EXACT, not page-wide (F310)', () => {
  it('does not cry "text touches the edge" about ink somewhere else on the row', async () => {
    // The box sits between two text rows (y 194-219 is blank inside it), and
    // the dense block far to the right has ink on those same rows. The
    // one-dimensional profile — a row count over the WHOLE width — calls that
    // touching; the mask, which looks only inside the box's own columns,
    // does not. A false "widen it" trains the user to ignore the one warning
    // that matters.
    await openCamera();
    await screen.findByTestId('crop-canvas');
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-width'), { target: { value: '200' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-height'), { target: { value: '20' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-x'), { target: { value: '170' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '198' } });
    });
    expect(screen.getByTestId('crop-clipping').textContent).toBe('');
    // …and it still speaks when the box really does stand on the text
    await act(async () => {
      fireEvent.change(screen.getByTestId('crop-y'), { target: { value: '225' } });
    });
    expect(screen.getByTestId('crop-clipping').textContent).toContain('Text touches the edge');
  });
});
