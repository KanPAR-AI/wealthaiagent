/**
 * The two outcomes and the six chips (docs/73 ASTRAL-334/335/336/337).
 *
 * The scorecard played back here is CAPTURED from the running engine — the
 * time-less reading a page with no birth time actually produces
 * (`e2e/capture-stream.mjs`, 2026-09-19), save offer and all. The whole point
 * of the chips is that four of them are answered from that payload, and the
 * way that is checked is by COUNTING the requests, not by reading the code.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { readTurn, type TurnOutcome } from '../../lib/transport';
import { App } from '../app';

// ── the captured reading ───────────────────────────────────────────────────

function outcomeFrom(file: string): TurnOutcome {
  const text = readFileSync(join(__dirname, '..', '..', 'lib', '__tests__', 'fixtures', file), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta as string)
    .join('');
  return readTurn(text);
}

const FIRM_ONLY = outcomeFrom('stream-match-firm-only.sse');

// ── canvas + image stubs (see snapshot.test.tsx for why) ───────────────────

const CROPPED = 'data:image/png;base64,Q1JPUFBFRA==';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(value: string) {
    const m = /size=(\d+)x(\d+)/.exec(value);
    if (m) {
      this.naturalWidth = Number(m[1]);
      this.naturalHeight = Number(m[2]);
    }
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
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => ctx;
  (HTMLCanvasElement.prototype as unknown as { toDataURL: unknown }).toDataURL = () => CROPPED;
}

// ── the fake worker ────────────────────────────────────────────────────────

let sent: Array<{ type: string; [k: string]: unknown }> = [];
let localStore: Record<string, unknown> = {};
let port: { emit: (event: unknown) => void; posted: Array<Record<string, unknown>> } | null = null;
/** the panel's listener for a capture the worker PUSHES after a gesture */
const deliveryListeners: Array<(m: unknown, s: unknown) => void> = [];
const deliver = (image: string) =>
  deliveryListeners.forEach((fn) =>
    fn({ type: 'capture/delivered', image, gesture: 'command' }, { id: 'astromatch-test' }),
  );

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
            return {
              ok: true,
              value: {
                outcome: {
                  kind: 'captured',
                  image: 'data:image/png;base64,Q0FQVFVSRQ==',
                  gesture: 'panel-button',
                },
                shortcut: 'Alt+Shift+M',
              },
            };
          case 'capture/extract':
            return { ok: true, value: { status: 200, body: CANDIDATES, resetsOn: null } };
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
});

/**
 * Camera → crop → consent → extract → review → confirm → the captured
 * reading. The review is answered the way a snapshot actually is: three
 * fields ACCEPTED unchanged (which is what earns `parsed_from_page`) and the
 * birth time declined, because matrimonial pages do not show one.
 */
async function reachTheReading(): Promise<void> {
  render(<App />);
  await screen.findByTestId('snapshot');
  await act(async () => {
    fireEvent.click(screen.getByTestId('snapshot'));
  });
  await screen.findByTestId('consent');
  await act(async () => {
    fireEvent.click(screen.getByTestId('consent'));
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('crop-send'));
  });
  await screen.findByTestId('field-name');
  for (const key of ['name', 'dob', 'pob']) {
    await act(async () => {
      fireEvent.click(screen.getByTestId(`field-${key}-accept`));
    });
  }
  await act(async () => {
    fireEvent.click(screen.getByTestId('field-tob-decline'));
  });
  await screen.findByTestId('place-resolved', {}, { timeout: 3000 });
  await act(async () => {
    fireEvent.click(screen.getByTestId('confirm'));
  });
  await waitFor(() => expect(port).not.toBeNull());
  port!.emit({ type: 'chat', chatId: 'chat-1' });
  port!.emit({ type: 'outcome', outcome: FIRM_ONLY });
  await screen.findByTestId('two-outcomes');
}

const posts = () => port?.posted.filter((m) => m.type === 'widget/answer') ?? [];

describe('the choice is two acts, and neither happens on its own', () => {
  it('offers both, with what each one does', async () => {
    await reachTheReading();
    const card = screen.getByTestId('two-outcomes');
    expect(card.textContent).toContain('Add to my matches');
    expect(card.textContent).toContain("Instant reading — don't save");
    // ASTRAL-335's sentence, telling the truth about the residue
    expect(card.textContent).toContain(
      'The conversation itself is saved in your history for a day',
    );
  });

  it('writes NOTHING until one is pressed (F149)', async () => {
    await reachTheReading();
    expect(posts()).toHaveLength(0);
  });
});

describe('(a) Add to my matches — the shipped save path (ASTRAL-334)', () => {
  it('answers the ENGINE\'s offer on the one carrier', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    expect(posts()).toHaveLength(1);
    const text = String(posts()[0].text);
    expect(text).toContain('```input_response');
    const payload = JSON.parse(/```input_response\n([\s\S]*?)\n```/.exec(text)![1]);
    expect(payload.ask).toBe('save_match_offer');
    expect(payload.values.save_match).toBe('save');
    expect(payload.values.person2_name).toBe('Kavya Nair');
  });

  it('stamps the capture channel so an ACCEPTED fact lands parsed_from_page', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    const payload = JSON.parse(
      /```input_response\n([\s\S]*?)\n```/.exec(String(posts()[0].text))![1],
    );
    expect(payload.values.capture_source).toBe('snapshot');
    // nothing was typed, so nothing claims `stated_by_user` (AMB-68(a))
    expect(payload.values.capture_edited).toEqual([]);
  });

  it('carries no birth fact of its own on the save carrier', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    const payload = JSON.parse(
      /```input_response\n([\s\S]*?)\n```/.exec(String(posts()[0].text))![1],
    );
    expect(payload.values.person2_dob).toBeUndefined();
    expect(payload.values.person2_pob).toBeUndefined();
  });

  it('says where to find them, and stops promising a delete', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Saved.', truncated: false } });
    const saved = await screen.findByTestId('saved');
    expect(saved.textContent).toContain('Added to your matches');
    expect(saved.textContent).toMatch(/People/);
    // a reading the user KEPT is never described as one that will be deleted
    expect(screen.queryByTestId('retention')).toBeNull();
    expect(screen.queryByTestId('delete-now')).toBeNull();
  });

  it('a save that FAILED is on screen, not swallowed (F306)', async () => {
    // It used to have nowhere to render: `side` was drawn only inside the
    // `Saved` card (which needs `saved`) and inside the chips (which need
    // the instant choice). So a failed save left the offer card sitting
    // there as if the button had never been pressed — which is exactly how
    // the dynamic-import bug stayed invisible for a whole phase.
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({ type: 'failed', error: 'the connection dropped' });
    const problem = await screen.findByTestId('save-problem');
    expect(problem.textContent).toContain("I couldn't add them to your matches");
    expect(problem.textContent).toContain('the connection dropped');
    expect(problem.textContent).toContain('Nothing was saved');
    expect(screen.queryByTestId('saved')).toBeNull();
  });

  it('a save whose turn came back EMPTY is neither saved nor "nothing saved" (F385)', async () => {
    // Found in PH-41's walk, under a backend that reloads mid-turn (F307):
    // the panel set `saved` on ANY outcome, so it printed "Added to your
    // matches" on the strength of a stream that produced nothing — while the
    // worker, which releases its delete promise only when the turn returns,
    // swept the chat under a card saying the reading had been kept.
    //
    // The engine writes the save BEFORE it narrates, so the honest state is
    // "I couldn't tell", and the repeat is safe: `save_match` is idempotent
    // on the pair.
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({
      type: 'outcome',
      outcome: { kind: 'empty', reason: 'The reading came back empty — nothing to show yet.' },
    });
    const problem = await screen.findByTestId('save-problem');
    expect(problem.textContent).toContain("I couldn't tell whether that saved");
    expect(problem.textContent).toContain('Open your matches');
    expect(problem.textContent).toContain('cannot save them twice');
    // …and neither of the two claims it must not make
    expect(problem.textContent).not.toContain('Nothing was saved');
    expect(screen.queryByTestId('saved')).toBeNull();
  });

  it('says a save is IN FLIGHT rather than looking untouched', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    const problem = await screen.findByTestId('save-problem');
    expect(problem.textContent).toContain('Adding them to your matches');
  });

  it('a saved reading is NOT deleted on the way out', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Saved.', truncated: false } });
    await screen.findByTestId('saved');
    await act(async () => {
      fireEvent.click(screen.getByText('Read another match'));
    });
    expect(sent.filter((m) => m.type === 'reading/delete')).toHaveLength(0);
  });

  it('the scorecard stays on screen — the save\'s turn does not replace it', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Saved.', truncated: false } });
    await screen.findByTestId('saved');
    expect(document.body.textContent).toContain('Kundli Milan');
  });
});

describe('(b) Instant reading — nothing durable, and the residue is named (ASTRAL-335)', () => {
  it('sends NOTHING at all', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    expect(posts()).toHaveLength(0);
    expect(sent.filter((m) => m.type === 'reading/delete')).toHaveLength(0);
  });

  it('keeps the retention card and its promise to delete', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    const retention = await screen.findByTestId('retention');
    expect(retention.textContent).toContain('was not saved to your matches');
    expect(screen.getByTestId('delete-now')).toBeTruthy();
  });

  it('deletes the chat when the user leaves it', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('delete-now'));
    });
    await waitFor(() =>
      expect(sent.some((m) => m.type === 'reading/delete' && m.chatId === 'chat-1')).toBe(true),
    );
  });
});

describe('the chips (ASTRAL-336)', () => {
  const instant = async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await screen.findByTestId('chips');
  };

  it('belong to the instant reading, and are not offered before the choice', async () => {
    await reachTheReading();
    expect(screen.queryByTestId('chips')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    expect(await screen.findByTestId('chips')).toBeTruthy();
  });

  it('label which are instant and which ask', async () => {
    await instant();
    for (const id of ['dosha', 'strongest', 'friction', 'birth-time']) {
      expect(screen.getByTestId(`chip-${id}`).getAttribute('data-cost')).toBe('instant');
    }
    for (const id of ['ask-before', 'outlook']) {
      expect(screen.getByTestId(`chip-${id}`).getAttribute('data-cost')).toBe('asks');
    }
  });

  it('FOUR of them answer with ZERO requests — counted, not claimed', async () => {
    await instant();
    const before = sent.length;
    const postedBefore = port!.posted.length;
    for (const id of ['dosha', 'strongest', 'friction', 'birth-time']) {
      await act(async () => {
        fireEvent.click(screen.getByTestId(`chip-${id}`));
      });
      expect(await screen.findByTestId('chip-answer')).toBeTruthy();
    }
    expect(sent.length).toBe(before);
    expect(port!.posted.length).toBe(postedBefore);
  });

  it('an instant answer is drawn from the payload on screen', async () => {
    await instant();
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-birth-time'));
    });
    const answer = await screen.findByTestId('chip-answer');
    if (FIRM_ONLY.kind !== 'scorecard') throw new Error('unreachable');
    for (const reason of FIRM_ONLY.report.pending_reasons) {
      expect(answer.textContent).toContain(reason.slice(0, 40));
    }
  });

  it('the other two send exactly ONE message each, and no more', async () => {
    await instant();
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-ask-before'));
    });
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0].text)).toMatch(/before deciding anything/i);
    // and it is a plain question, not a carrier
    expect(String(posts()[0].text)).not.toContain('```');
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Ask about **X**.', truncated: false } });
    const answer = await screen.findByTestId('chip-answer');
    expect(answer.textContent).toContain('Ask about');
    expect(posts()).toHaveLength(1);
  });

  it('a model chip\'s answer does NOT replace the scorecard', async () => {
    await instant();
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-outlook'));
    });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Some words.', truncated: false } });
    await screen.findByTestId('chip-answer');
    expect(document.body.textContent).toContain('Kundli Milan');
    expect(screen.getByTestId('chips')).toBeTruthy();
  });

  it('a chip whose stream was cut off says so', async () => {
    await instant();
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-outlook'));
    });
    port!.emit({
      type: 'outcome',
      outcome: { kind: 'text', text: 'Half an ans', truncated: true },
    });
    expect(await screen.findByTestId('chip-truncated')).toBeTruthy();
  });

  it('a chip whose turn FAILED says so rather than spinning', async () => {
    await instant();
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-outlook'));
    });
    port!.emit({ type: 'failed', error: 'the stream died' });
    const answer = await screen.findByTestId('chip-answer');
    expect(answer.textContent).toContain('the stream died');
  });
});

describe('closing leaves nothing behind (ASTRAL-337)', () => {
  it('writes no birth value into chrome.storage at any point', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-strongest'));
    });
    // a SCAN of the whole store, not a whitelist of keys
    const stored = JSON.stringify(localStore);
    for (const secret of ['Kavya Nair', '1988-01-01', 'Coimbatore', 'Q0FQVFVSRQ', 'Q1JPUFBFRA']) {
      expect(stored).not.toContain(secret);
    }
  });

  it('a re-opened panel starts empty and offers no resume', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('delete-now'));
    });
    await screen.findByTestId('snapshot');
    expect(screen.queryByTestId('chips')).toBeNull();
    expect(screen.queryByTestId('crop-canvas')).toBeNull();
    expect(document.body.textContent).not.toContain('Kavya Nair');
    expect(document.body.textContent).not.toMatch(/resume|continue where/i);
  });
});

// ── R5 · a capture that interrupts a reading says so ───────────────────────

describe('a gesture capture during a live reading is explained (R5)', () => {
  it('tells the user the reading was closed and deleted', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    // a shortcut or a menu click arrives while the reading is on screen
    await act(async () => {
      deliver('data:image/png;size=800x600,U0VDT05E');
    });
    const said = await screen.findByTestId('crop-interrupted');
    expect(said.textContent).toContain('was not saved');
    expect(said.textContent).toContain('closed and deleted');
  });

  it('says NOTHING about a reading the user SAVED — that one is theirs', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-match'));
    });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Saved.', truncated: false } });
    await screen.findByTestId('saved');
    await act(async () => {
      deliver('data:image/png;size=800x600,U0VDT05E');
    });
    await screen.findByTestId('crop-canvas');
    expect(screen.queryByTestId('crop-interrupted')).toBeNull();
  });

  it('says nothing when there was no reading to interrupt', async () => {
    render(<App />);
    await screen.findByTestId('snapshot');
    await act(async () => {
      deliver('data:image/png;size=800x600,U0FQVFVSRQ==');
    });
    await screen.findByTestId('crop-canvas');
    expect(screen.queryByTestId('crop-interrupted')).toBeNull();
  });
});

// ── R6 · leaving a reading drops every panel-local copy ───────────────────

describe('leaving a reading drops the values, not only the screen (R6)', () => {
  it('nulls the confirmed profile, the capture and the side answer — in the CODE', () => {
    // A state assertion, because "the DOM no longer shows it" and "the panel
    // no longer holds it" are different facts and only the second one is the
    // promise. The mutation that removes any one of these lines reds this.
    const src = readFileSync(join(__dirname, '..', 'app.tsx'), 'utf8');
    const leave = src.slice(src.indexOf('const leaveReading'), src.indexOf('// ── the camera'));
    for (const cleared of [
      'setSubject(null)',
      'setCapture(null)',
      'setSide(null)',
      'runRef.current = null',
    ]) {
      expect({ line: cleared, inLeavePath: leave.includes(cleared) }).toEqual({
        line: cleared,
        inLeavePath: true,
      });
    }
  });

  it('shows nothing of the person after leaving', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('delete-now'));
    });
    await screen.findByTestId('snapshot');
    expect(document.body.textContent).not.toContain('Kavya Nair');
    expect(document.body.textContent).not.toContain('1988-01-01');
    expect(document.body.textContent).not.toContain('Coimbatore');
  });

  it('the capture is gone too — a later failure offers no way back to it', async () => {
    await reachTheReading();
    await act(async () => {
      fireEvent.click(screen.getByTestId('instant-reading'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('delete-now'));
    });
    await screen.findByTestId('snapshot');
    // the crop screen cannot be reopened on a capture the panel dropped
    expect(screen.queryByTestId('crop-canvas')).toBeNull();
  });
});
