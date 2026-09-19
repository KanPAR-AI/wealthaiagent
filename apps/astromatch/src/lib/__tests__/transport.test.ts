/**
 * docs/73 ASTRAL-324 / ASTRAL-328 — the four calls, in order, against a
 * stream CAPTURED FROM THE RUNNING ENGINE.
 *
 * The two `.sse` files next door are byte-for-byte what `chatservice` sent on
 * 2026-09-19 for a manual-entry match on a local container: the partner ask,
 * then the scorecard and the save offer. They are not hand-written — a
 * hand-written fixture proves the client parses what somebody imagined.
 *
 * What this pins:
 *   - `POST /chats` → `GET /stream?force_agent=…` → `POST /messages?auto_reply=false`
 *     → `GET /stream?force_agent=…`, with their exact query strings. Drop
 *     `force_agent` or flip `auto_reply` and the URL assertion reds.
 *   - the answer is the TYPED carrier and nothing else (F18's anti-pattern).
 *   - the panel's state comes from FENCES. A stream with no `input_request`
 *     and no `match_report` is a STATED state, never a spinner.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { initCore, type PlatformAdapter } from '@wealthai/core';
import { parseInputRequest } from '@wealthai/astral';

import { confirmProfile, type ConfirmedProfile } from '../confirmed';
import {
  answerAsk,
  classifyTurn,
  isAuthFailure,
  MATCH_OPENER,
  openMatchChat,
  planAnswer,
  readTurn,
  runTurn,
  SAVE_MATCH_ASK,
  SIGNED_OUT_NOTE,
} from '../transport';

const FIXTURES = join(__dirname, 'fixtures');
const ASK_STREAM = readFileSync(join(FIXTURES, 'stream-ask-person2.sse'), 'utf8');
const MATCH_STREAM = readFileSync(join(FIXTURES, 'stream-match-complete.sse'), 'utf8');
const REFUSED_STREAM = readFileSync(
  join(FIXTURES, 'stream-refused-ambiguous-rashi.sse'),
  'utf8',
);

/** the assistant text out of a captured SSE file, the way core assembles it */
function textOf(sse: string): string {
  return sse
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta as string)
    .join('');
}

// ── a fetch spy that replays the captured bytes ────────────────────────────


/**
 * Minimal `fetch` responses.
 *
 * jsdom has no WHATWG `Response`, and core's SSE reader only ever touches
 * `ok`, `json()` and `body.getReader()` — so these are exactly those, and
 * nothing is stubbed that the code under test does not really use.
 */
function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
  } as unknown as Response;
}

function streamResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  let done = false;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: async () => (done ? { done: true, value: undefined }
          : ((done = true), { done: false, value: bytes })),
        cancel: async () => {},
        releaseLock: () => {},
      }),
    },
  } as unknown as Response;
}

interface Call {
  url: string;
  method: string;
  body: unknown;
}

function installTransport(streams: string[]) {
  const calls: Call[] = [];
  let streamIndex = 0;

  const fetchSpy: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.includes('/stream')) {
      const sse = streams[Math.min(streamIndex++, streams.length - 1)];
      return streamResponse(sse);
    }
    if (url.endsWith('/chats')) {
      return jsonResponse({ chat: { id: 'chat-1' }, messages: [{ id: 'm-1' }] });
    }
    return jsonResponse({ id: 'm-2' });
  };

  const adapter: PlatformAdapter = {
    fetch: fetchSpy,
    getApiUrl: (endpoint) => `https://backend.test/api/v1${endpoint}`,
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    events: { emit: () => {}, on: () => () => {} },
  };
  initCore(adapter);
  return calls;
}

const deps = { getToken: async () => 'token-abc' };

function confirmed(): ConfirmedProfile {
  const outcome = confirmProfile('manual', {
    name: { act: 'typed', value: 'Test Person' },
    dob: { act: 'typed', value: '1992-03-14' },
    tob: { act: 'typed', value: '10:30' },
    pob: { act: 'typed', value: 'Pune, India' },
  });
  if (!outcome.ok) throw new Error('fixture profile did not confirm');
  return outcome.profile;
}

describe('the captured streams are the ones this test is about', () => {
  it('the first carries the partner ask and no scorecard', () => {
    expect(ASK_STREAM).toContain('input_request');
    expect(ASK_STREAM).not.toContain('match_report');
  });

  it('the second carries the scorecard AND the save offer', () => {
    expect(MATCH_STREAM).toContain('match_report');
    expect(MATCH_STREAM).toContain(SAVE_MATCH_ASK);
  });
});

describe('§3a — the four calls, in order', () => {
  it('opens a chat, streams, answers on the carrier, streams again', async () => {
    const calls = installTransport([ASK_STREAM, MATCH_STREAM]);

    const chatId = await openMatchChat(deps, 'Match — Test Person');
    expect(chatId).toBe('chat-1');

    const first = await runTurn(deps, chatId);
    expect(first.kind).toBe('ask');
    if (first.kind !== 'ask') throw new Error('unreachable');

    const plan = planAnswer(first.request, confirmed());
    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') throw new Error('unreachable');
    await answerAsk(deps, chatId, first.request, plan.values);

    const second = await runTurn(deps, chatId);
    expect(second.kind).toBe('scorecard');

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://backend.test/api/v1/chats',
      'GET https://backend.test/api/v1/chats/chat-1/stream?force_agent=astrology_ai',
      'POST https://backend.test/api/v1/chats/chat-1/messages?auto_reply=false',
      'GET https://backend.test/api/v1/chats/chat-1/stream?force_agent=astrology_ai',
    ]);
  });

  it('opens with the sentence that makes the intent switch deterministic', async () => {
    const calls = installTransport([ASK_STREAM]);
    await openMatchChat(deps, 'Match — Test Person');
    expect((calls[0].body as { firstMessage: { content: string } }).firstMessage.content)
      .toBe(MATCH_OPENER);
  });

  it('sends the typed carrier and no flattened sentence for a model to re-read', async () => {
    const calls = installTransport([ASK_STREAM, MATCH_STREAM]);
    const chatId = await openMatchChat(deps, 'x');
    const first = await runTurn(deps, chatId);
    if (first.kind !== 'ask') throw new Error('expected the partner ask');
    const plan = planAnswer(first.request, confirmed());
    if (plan.kind !== 'send') throw new Error('expected an answerable ask');
    await answerAsk(deps, chatId, first.request, plan.values);

    const post = calls.find((c) => c.url.includes('/messages'))!;
    const content = (post.body as { content: string }).content;
    expect(content).toContain('```input_response');
    const fence = /```input_response\n([\s\S]*?)```/.exec(content)!;
    const payload = JSON.parse(fence[1]);
    expect(payload.type).toBe('input_response');
    expect(payload.ask).toBe('required_slots_missing');
    expect(payload.values).toEqual({
      person2_dob: '1992-03-14',
      person2_tob: '10:30',
      person2_pob: 'Pune, India',
      // PH-38's two capture stamps ride along with the details, where they
      // are true (ASTRAL-313). Both are DECLARED engine fields; an
      // undeclared key would come back refused by name.
      capture_source: 'manual',
      capture_edited: ['person2_dob', 'person2_tob', 'person2_pob'],
    });
    // Delete the fence and NOTHING is recoverable — the echo is presentation.
    expect(content.replace(fence[0], '')).not.toContain('1992-03-14');
  });

  it('puts no birth value on any query string', async () => {
    const calls = installTransport([ASK_STREAM, MATCH_STREAM]);
    const chatId = await openMatchChat(deps, 'x');
    const first = await runTurn(deps, chatId);
    if (first.kind !== 'ask') throw new Error('expected the partner ask');
    const plan = planAnswer(first.request, confirmed());
    if (plan.kind !== 'send') throw new Error('expected an answerable ask');
    await answerAsk(deps, chatId, first.request, plan.values);
    await runTurn(deps, chatId);
    for (const call of calls) {
      const query = call.url.split('?')[1] ?? '';
      for (const banned of ['1992', 'Pune', 'Test%20Person', '10%3A30']) {
        expect(query).not.toContain(banned);
      }
    }
  });

  it('never calls POST /people', async () => {
    const calls = installTransport([ASK_STREAM, MATCH_STREAM]);
    const chatId = await openMatchChat(deps, 'x');
    const first = await runTurn(deps, chatId);
    if (first.kind !== 'ask') throw new Error('expected the partner ask');
    const plan = planAnswer(first.request, confirmed());
    if (plan.kind !== 'send') throw new Error('expected an answerable ask');
    await answerAsk(deps, chatId, first.request, plan.values);
    expect(calls.filter((c) => /\/people/.test(c.url))).toEqual([]);
  });
});

describe('ASTRAL-314 — an undetermined Moon rashi is a REFUSAL, and it is designed', () => {
  /**
   * Captured from the running engine on 2026-09-19 with PH-38 live locally:
   * person2 born 1990-08-02 in Ranchi with NO birth time, a day on which the
   * Moon crosses Scorpio into Sagittarius.
   *
   * The engine returns NO `match_report` — not even a firm-only one — because
   * four of the eight kootas are read from the Moon's rashi alone and each
   * would have two answers. The panel's job is to render that sentence and
   * stop, never to wait for a scorecard that is not coming.
   */
  const outcome = readTurn(textOf(REFUSED_STREAM));

  it('carries no scorecard at all', () => {
    expect(REFUSED_STREAM).not.toContain('match_report');
    expect(outcome.kind).toBe('text');
  });

  it('renders the engine\'s own sentence, naming whose Moon and which rashis', () => {
    if (outcome.kind !== 'text') throw new Error('unreachable');
    expect(outcome.text).toContain("I can't score this match");
    expect(outcome.text).toContain('Scorpio');
    expect(outcome.text).toContain('Sagittarius');
    expect(outcome.text).toContain('birth time');
  });

  it('shows no raw JSON — the other fences on that turn are still blocks', () => {
    if (outcome.kind !== 'text') throw new Error('unreachable');
    // the reply also carries a ```reading_subject``` fence
    expect(REFUSED_STREAM).toContain('reading_subject');
    expect(outcome.text).not.toContain('reading_subject');
    expect(outcome.text).not.toContain('{"type"');
  });

  it('is a STATED state, not an empty one the panel would spin on', () => {
    expect(outcome.kind).not.toBe('empty');
  });
});

describe('the panel branches on fences, never on prose', () => {
  it('reads the partner ask out of the captured stream', () => {
    const outcome = readTurn(textOf(ASK_STREAM));
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') throw new Error('unreachable');
    expect(outcome.request.ask).toBe('required_slots_missing');
    expect(outcome.request.fields.map((f) => f.key)).toEqual([
      'person2_dob',
      'person2_tob',
      'person2_pob',
    ]);
    // ASTRAL-87: the birth time always carries a way out
    expect(outcome.request.fields.find((f) => f.key === 'person2_tob')!.allowUnknown).toBe(true);
  });

  it('reads the scorecard AND the save offer out of the second one', () => {
    const outcome = readTurn(textOf(MATCH_STREAM));
    expect(outcome.kind).toBe('scorecard');
    if (outcome.kind !== 'scorecard') throw new Error('unreachable');
    expect(outcome.report.kootas).toHaveLength(8);
    expect(outcome.report.total).toBe(26);
    expect(outcome.saveOffer?.ask).toBe(SAVE_MATCH_ASK);
  });

  it('renders the engine\'s own sentence as TEXT when no block came', () => {
    const outcome = readTurn('[Using astrology_ai agent]\n\nI cannot score this match.');
    expect(outcome).toEqual({
      kind: 'text',
      text: 'I cannot score this match.',
      truncated: false,
    });
  });

  it('states an empty turn instead of spinning on it', () => {
    const outcome = readTurn('');
    expect(outcome.kind).toBe('empty');
    if (outcome.kind !== 'empty') throw new Error('unreachable');
    expect(outcome.reason).toMatch(/empty/i);
  });

  it('draws nothing from a half-streamed block instead of leaking raw JSON', () => {
    const half = 'Casting…\n\n```match_report\n{"type": "match_report", "kootas": [';
    const outcome = readTurn(half);
    expect(outcome.kind).toBe('text');
    if (outcome.kind !== 'text') throw new Error('unreachable');
    expect(outcome.text).not.toContain('match_report');
    expect(outcome.text).not.toContain('kootas');
  });

  it('a stream that errored with no text is stated, with the reason', async () => {
    installTransport(['']);
    const outcome = await runTurn(deps, 'chat-1');
    expect(outcome.kind).toBe('empty');
  });
});

describe('B6 — a stream that DIED is not the answer', () => {
  const MATCH_TEXT = textOf(MATCH_STREAM);
  const dropped = new Error('SSE idle timed out');
  const unauthorized = new Error('Failed to connect to SSE stream: 401 Unauthorized');

  it('keeps a scorecard whose fence CLOSED, and marks the words cut off', () => {
    const outcome = classifyTurn(MATCH_TEXT, dropped);
    expect(outcome.kind).toBe('scorecard');
    if (outcome.kind !== 'scorecard') throw new Error('unreachable');
    expect(outcome.report.total).toBe(26);
    expect(outcome.truncated).toBe(true);
  });

  it('marks prose that stopped mid-sentence as cut off rather than serving it whole', () => {
    const outcome = classifyTurn('[Using astrology_ai agent]\n\nYour Moon is in', dropped);
    expect(outcome).toEqual({ kind: 'text', text: 'Your Moon is in', truncated: true });
  });

  it('shows NOTHING from a fence that never closed', () => {
    // half a JSON object is not half a scorecard; `splitDataBlocks` holds an
    // unterminated data fence back, so the panel draws no ring at all.
    const half = MATCH_TEXT.slice(0, MATCH_TEXT.indexOf('"kootas"') + 20);
    const outcome = classifyTurn(half, dropped);
    expect(outcome.kind).not.toBe('scorecard');
    if (outcome.kind === 'text') {
      expect(outcome.truncated).toBe(true);
      expect(outcome.text).not.toContain('kootas');
    }
  });

  it('does not serve an ASK whose stream died — we cannot know it finished asking', () => {
    const outcome = classifyTurn(textOf(ASK_STREAM), dropped);
    expect(outcome.kind).toBe('empty');
    if (outcome.kind !== 'empty') throw new Error('unreachable');
    expect(outcome.reason).toContain('cut off');
  });

  it('a clean stream is never marked truncated', () => {
    const outcome = classifyTurn(MATCH_TEXT, null);
    if (outcome.kind !== 'scorecard') throw new Error('unreachable');
    expect(outcome.truncated).toBe(false);
  });

  it('an empty stream with an error reports the error, not a blank', () => {
    const outcome = classifyTurn('', dropped);
    expect(outcome).toEqual({ kind: 'empty', reason: 'SSE idle timed out' });
  });
});

describe('B6 — an expired session is its own state, not a transport sentence', () => {
  const unauthorized = new Error('Failed to connect to SSE stream: 401 Unauthorized');

  it('recognises a 401 before any bytes', () => {
    const outcome = classifyTurn('', unauthorized);
    expect(outcome.kind).toBe('signed-out');
    if (outcome.kind !== 'signed-out') throw new Error('unreachable');
    expect(outcome.reason).toBe(SIGNED_OUT_NOTE);
  });

  it('recognises a 401 AFTER bytes, and does not serve the half-reading', () => {
    const outcome = classifyTurn(textOf(MATCH_STREAM), unauthorized);
    expect(outcome.kind).toBe('signed-out');
  });

  it('never shows the transport\'s own sentence to a user', () => {
    const outcome = classifyTurn('', unauthorized);
    if (outcome.kind !== 'signed-out') throw new Error('unreachable');
    expect(outcome.reason).not.toContain('SSE');
    expect(outcome.reason).not.toContain('401');
    expect(outcome.reason).toMatch(/sign in again/i);
  });

  it.each([
    'Failed to connect to SSE stream: 401 Unauthorized',
    'Failed to connect to SSE stream: 403 Forbidden',
    'Not signed in.',
  ])('classifies %p as an auth failure', (message) => {
    expect(isAuthFailure(new Error(message))).toBe(true);
  });

  it.each([
    'SSE idle timed out',
    'SSE TTFB timed out',
    'Failed to connect to SSE stream: 500 Internal Server Error',
    'network error',
  ])('does NOT classify %p as an auth failure', (message) => {
    expect(isAuthFailure(new Error(message))).toBe(false);
  });
});

describe('ASTRAL-328 — the panel never decides which fields to ask for', () => {
  const SELF_ASK = {
    type: 'input_request',
    ask: 'required_slots_missing',
    reason: 'I need your own details first.',
    fields: [
      { key: 'dob', kind: 'date', label: 'Your date of birth', required: true, allow_unknown: false },
      { key: 'tob', kind: 'time', label: 'Your birth time', required: true, allow_unknown: true },
      { key: 'pob', kind: 'place', label: 'Your birth place', required: true, allow_unknown: false },
    ],
  };

  it('hands a SELF ask to the widget rather than answering it with the partner\'s values', () => {
    const request = parseInputRequest(SELF_ASK)!;
    expect(planAnswer(request, confirmed())).toEqual({ kind: 'ask' });
  });

  it('answers a PARTNER ask from what the user confirmed', () => {
    const request = parseInputRequest(JSON.parse(
      /```input_request\n([\s\S]*?)```/.exec(textOf(ASK_STREAM))![1],
    ))!;
    const plan = planAnswer(request, confirmed());
    expect(plan.kind).toBe('send');
  });

  it('answers only the keys the engine asked for', () => {
    const request = parseInputRequest(JSON.parse(
      /```input_request\n([\s\S]*?)```/.exec(textOf(ASK_STREAM))![1],
    ))!;
    const plan = planAnswer(request, confirmed());
    if (plan.kind !== 'send') throw new Error('unreachable');
    // `person2_name` is real and is NOT on this ask, so it does not travel.
    // The two capture stamps DO: they answer no ask, they are declared
    // fields, and the engine reads them off the belief's slots at save time.
    expect(Object.keys(plan.values).sort()).toEqual([
      'capture_edited',
      'capture_source',
      'person2_dob',
      'person2_pob',
      'person2_tob',
    ]);
    expect(plan.values.person2_name).toBeUndefined();
  });
});
