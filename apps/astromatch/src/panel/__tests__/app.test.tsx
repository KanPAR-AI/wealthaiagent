/**
 * The panel, driven end to end in jsdom (docs/73 B1, B4, B6).
 *
 * The browser walk proves the same path against the real engine, and it takes
 * three minutes and a running container. These are the cases that are hard to
 * arrange there: a stream that dies mid-reading, an expired session, a delete
 * that FAILS. All three are states a user can land in, and none of them can be
 * left to "we'll see it if it happens".
 *
 * The fake `chrome` answers the worker's side of the protocol; the fake port
 * plays a match run.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { readTurn, SIGNED_OUT_NOTE, type TurnOutcome } from '../../lib/transport';
import { App } from '../app';

// ── the captured scorecard ─────────────────────────────────────────────────

const MATCH_TEXT = readFileSync(
  join(__dirname, '..', '..', 'lib', '__tests__', 'fixtures', 'stream-match-complete.sse'),
  'utf8',
)
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

const SCORECARD = readTurn(MATCH_TEXT);

// ── the fake worker ────────────────────────────────────────────────────────

let sent: Array<{ type: string; [k: string]: unknown }> = [];
let deleteStatus = 204;
let signedIn = true;
let sweepNotice = '';
let port: {
  emit: (event: unknown) => void;
  posted: Array<Record<string, unknown>>;
} | null = null;
/** PH-40 — what the fake worker answers the camera with. */
const deliveryListeners: Array<(m: unknown, s: unknown) => void> = [];
let pendingCapture: unknown = null;
let captureReply: unknown = { outcome: { kind: 'needs-gesture' }, shortcut: 'Alt+Shift+M' };
let extractReply: unknown = { status: 200, body: {}, resetsOn: null };

beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'astromatch-test',
      // PH-40: the panel listens for a capture the worker pushes after a
      // keyboard or context-menu gesture (`onCaptureDelivered`). The handler
      // is kept so a case can fire one.
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
            return {
              ok: true,
              value: signedIn
                ? { signedIn: true, identifier: 'walk@local.test', notice: sweepNotice }
                : { signedIn: false },
            };
          case 'auth/sign-out':
            signedIn = false;
            return { ok: true, value: { signedIn: false } };
          case 'reading/delete':
            return { ok: true, value: { status: deleteStatus, body: null, resetsOn: null } };
          case 'place/resolve':
            return {
              ok: true,
              value: {
                status: 200,
                body: {
                  display_name: 'Pune, Maharashtra, India',
                  timezone: 'Asia/Kolkata',
                  timezone_candidates: [],
                  place_candidates: [],
                },
                resetsOn: null,
              },
            };
          case 'place/suggest':
            return { ok: true, value: { status: 200, body: { places: [] }, resetsOn: null } };
          case 'capture/pending':
            return { ok: true, value: pendingCapture };
          case 'capture/request':
            return { ok: true, value: captureReply };
          case 'capture/extract':
            return { ok: true, value: extractReply };
          default:
            return { ok: true, value: null };
        }
      },
      connect: () => {
        const listeners: Array<(e: unknown) => void> = [];
        const posted: Array<Record<string, unknown>> = [];
        port = {
          emit: (event: unknown) => act(() => listeners.forEach((fn) => fn(event))),
          posted,
        };
        return {
          onMessage: { addListener: (fn: (e: unknown) => void) => listeners.push(fn) },
          postMessage: (m: Record<string, unknown>) => posted.push(m),
          disconnect: () => {},
        };
      },
    },
  };
});

beforeEach(() => {
  sent = [];
  deleteStatus = 204;
  signedIn = true;
  sweepNotice = '';
  port = null;
});

/** Sign in, enter a synthetic person, confirm, and play `outcome` back. */
async function runAMatch(outcome: TurnOutcome = SCORECARD) {
  render(<App />);
  await screen.findByTestId('manual');
  fireEvent.click(screen.getByTestId('manual'));

  fireEvent.change(await screen.findByTestId('field-name'), {
    target: { value: 'Test Person' },
  });
  fireEvent.change(screen.getByTestId('field-dob'), { target: { value: '1992-03-14' } });
  fireEvent.change(screen.getByTestId('field-tob'), { target: { value: '10:30' } });
  fireEvent.change(screen.getByTestId('field-pob'), { target: { value: 'Pune, India' } });
  await screen.findByTestId('place-resolved', {}, { timeout: 3000 });
  fireEvent.click(screen.getByTestId('confirm'));

  await waitFor(() => expect(port).not.toBeNull());
  port!.emit({ type: 'chat', chatId: 'chat-1' });
  port!.emit({ type: 'outcome', outcome });
}

describe('B1 — an unsaved reading is deleted, and the panel says what happened', () => {
  it('promises the delete BEFORE it happens, and claims no 24-hour expiry', async () => {
    await runAMatch();
    const retention = await screen.findByTestId('retention');
    expect(retention.textContent).toContain('was not saved to your matches');
    expect(retention.textContent).toMatch(/will delete the conversation/i);
    // the sentence this replaced
    expect(retention.textContent).not.toMatch(/sit in this chat for 24 hours/i);
  });

  it('deletes the chat when the user asks for it now', async () => {
    await runAMatch();
    fireEvent.click(await screen.findByTestId('delete-now'));
    await waitFor(() =>
      expect(sent.some((m) => m.type === 'reading/delete' && m.chatId === 'chat-1')).toBe(true),
    );
  });

  it('states the deletion where the user lands', async () => {
    await runAMatch();
    fireEvent.click(await screen.findByTestId('delete-now'));
    const notice = await screen.findByTestId('choose-notice');
    expect(notice.textContent).toBe('This reading and the details you entered were deleted.');
  });

  it('deletes it on the way out of "Read another match" too', async () => {
    await runAMatch();
    fireEvent.click(await screen.findByText('Read another match'));
    await waitFor(() => expect(sent.some((m) => m.type === 'reading/delete')).toBe(true));
  });

  it('deletes it on sign-out', async () => {
    await runAMatch();
    fireEvent.click(await screen.findByTitle('walk@local.test'));
    await waitFor(() => expect(sent.some((m) => m.type === 'reading/delete')).toBe(true));
  });

  it('says so, and offers a retry, when the delete FAILS — and does not move on', async () => {
    deleteStatus = 500;
    await runAMatch();
    fireEvent.click(await screen.findByTestId('delete-now'));
    await waitFor(() =>
      expect(screen.getByTestId('retention-headline').textContent).toBe(
        'I could not delete this reading.',
      ),
    );
    expect(screen.getByTestId('retention').textContent).toMatch(/still in your chat history/i);
    expect(screen.getByTestId('delete-retry')).toBeTruthy();
    // it did NOT claim the reading is gone and did not leave the screen
    expect(screen.queryByTestId('choose-notice')).toBeNull();
  });

  it('retries the delete from the failed state', async () => {
    deleteStatus = 500;
    await runAMatch();
    fireEvent.click(await screen.findByTestId('delete-now'));
    await screen.findByTestId('delete-retry');
    deleteStatus = 204;
    fireEvent.click(screen.getByTestId('delete-retry'));
    await screen.findByTestId('choose-notice');
  });

  it('treats a 404 as gone — it is, from the user\'s point of view', async () => {
    deleteStatus = 404;
    await runAMatch();
    fireEvent.click(await screen.findByTestId('delete-now'));
    await screen.findByTestId('choose-notice');
  });
});

describe('B1 — a reading the browser interrupted is reported on the way in', () => {
  it('shows the sweep notice the worker sent', async () => {
    sweepNotice = 'The reading you left open was deleted just now.';
    render(<App />);
    const notice = await screen.findByTestId('choose-notice');
    expect(notice.textContent).toBe('The reading you left open was deleted just now.');
  });

  it('says nothing when the sweep deleted nothing', async () => {
    sweepNotice = '';
    render(<App />);
    await screen.findByTestId('manual');
    expect(screen.queryByTestId('choose-notice')).toBeNull();
  });

  it('drops the notice once the user starts a new reading', async () => {
    sweepNotice = 'The reading you left open was deleted just now.';
    render(<App />);
    await screen.findByTestId('choose-notice');
    fireEvent.click(screen.getByTestId('manual'));
    await screen.findByTestId('field-name');
    expect(screen.queryByTestId('choose-notice')).toBeNull();
  });
});

describe('B4 — the narration is drawn as markdown, and the duplicate table is not drawn twice', () => {
  it("renders the engine's bold as bold, not as asterisks", async () => {
    await runAMatch();
    const narration = await screen.findByTestId('narration');
    expect(narration.querySelectorAll('strong').length).toBeGreaterThanOrEqual(1);
    expect(narration.textContent).not.toContain('**');
  });

  it('hides the scorecard FALLBACK table — the panel drew that block itself', async () => {
    await runAMatch();
    const narration = await screen.findByTestId('narration');
    // docs/49 ASTRAL-90's prose fallback exists for clients that cannot draw
    // `match_report`. This one can, and did: showing it too is the same eight
    // rows twice.
    expect(narration.textContent).not.toContain('### Kundli Milan');
    expect(narration.textContent).not.toContain('Kundli Milan — 26 / 36');
    expect(narration.textContent).not.toContain('Moon signs:');
    expect(narration.querySelectorAll('table')).toHaveLength(0);
    // …and the scorecard the panel DID draw is still there
    expect(document.body.textContent).toContain('26');
  });

  it('keeps the sentences around it', async () => {
    await runAMatch();
    const narration = await screen.findByTestId('narration');
    expect(narration.textContent).toContain("Those are Pune's birth details");
    expect(narration.textContent).toContain('Casting both Kundlis');
  });
});

describe('B6 — a cut-off reading and an expired session are their own states', () => {
  it('shows the scorecard, marks the words cut off, and offers a retry', async () => {
    if (SCORECARD.kind !== 'scorecard') throw new Error('fixture is not a scorecard');
    await runAMatch({ ...SCORECARD, truncated: true });
    const note = await screen.findByTestId('truncated');
    expect(note.textContent).toMatch(/cut off/i);
    expect(screen.getByTestId('retry')).toBeTruthy();
    // the scorecard is still there — its fence closed
    expect(document.body.textContent).toContain('26');
  });

  it('sends the user to sign-in with one honest sentence on a 401', async () => {
    await runAMatch({ kind: 'signed-out', reason: SIGNED_OUT_NOTE });
    const notice = await screen.findByTestId('signin-notice');
    expect(notice.textContent).toBe(SIGNED_OUT_NOTE);
    expect(notice.textContent).not.toContain('SSE');
    expect(notice.textContent).not.toContain('401');
    expect(screen.getByTestId('send-code')).toBeTruthy();
  });

  it('states an empty turn rather than spinning on it', async () => {
    await runAMatch({ kind: 'empty', reason: 'The reading came back empty — nothing to show yet.' });
    expect(await screen.findByText(/came back empty/i)).toBeTruthy();
  });
});
