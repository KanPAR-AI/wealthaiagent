/**
 * docs/49 ASTRAL-83/85/89 — the carrier, and the sentence that is NOT it.
 *
 * The rendering half lives in `src/components/astral/__tests__/`, driven
 * through the real DOM adapter. This file is about what travels on the wire,
 * because that is where F18's anti-pattern lives: `onboarding-form.tsx:63-70`
 * flattens typed values into "Age: 34, Sex: male" and posts it so an LLM can
 * parse them back out. The tests below assert the opposite property in the
 * strongest form available — delete the fence, and NOTHING is recoverable.
 */

import { inputRequestPayload } from '../fixtures/payloads';
import {
  buildInputResponseMessage,
  echoFor,
  parseInputRequest,
  stripInputResponse,
  type InputRequestPayload,
  type InputValue,
} from '../input-request';

const request = parseInputRequest(inputRequestPayload) as InputRequestPayload;

/** the engine's parser, transcribed — `graph.py::_parse_input_response`. */
function parseAsTheEngineDoes(message: string): {
  ask: string;
  values: Record<string, InputValue>;
} | null {
  const m = /```input_response[ \t]*\r?\n([\s\S]*?)```/.exec(message);
  if (!m) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (parsed?.type !== 'input_response') return null;
  return { ask: parsed.ask, values: parsed.values };
}

describe('ASTRAL-83 — parsing the engine\'s ask', () => {
  it('parses the captured payload', () => {
    expect(request).not.toBeNull();
    expect(request.ask).toBe('birth_time_unlocks');
    expect(request.fields.map((f) => f.key)).toEqual(['tob', 'birth_time_confidence']);
  });

  it('carries the way out on the time field', () => {
    expect(request.fields[0].allowUnknown).toBe(true);
  });

  it('refuses a payload it cannot vouch for, rather than half-rendering it', () => {
    expect(parseInputRequest(null)).toBeNull();
    expect(parseInputRequest({ type: 'input_request' })).toBeNull();
    expect(parseInputRequest({ type: 'natal_chart', fields: [] })).toBeNull();
    expect(parseInputRequest({ type: 'input_request', fields: [{ key: 'tob' }] })).toBeNull();
  });

  it('refuses a `choice` with no options — a dead card is the failure mode', () => {
    expect(
      parseInputRequest({
        type: 'input_request',
        ask: 'x',
        reason: '',
        fields: [{ key: 'birth_time_confidence', kind: 'choice', label: 'How exact?', options: [] }],
      }),
    ).toBeNull();
  });
});

describe('ASTRAL-85 — the carrier is typed, and the echo is not it', () => {
  it('every send carries a fence the engine can parse', () => {
    const cases: Record<string, InputValue>[] = [
      { tob: '00:20' },
      { tob: '23:45', birth_time_confidence: 'exact' },
      { tob: null },
      { tob: '09:00', birth_time_confidence: 'approximate' },
      {},
    ];
    for (const values of cases) {
      const message = buildInputResponseMessage(request, values);
      const seen = parseAsTheEngineDoes(message);
      expect(seen).not.toBeNull();
      expect(seen!.ask).toBe('birth_time_unlocks');
      expect(seen!.values).toEqual(values);
    }
  });

  it('deleting the fence leaves nothing recoverable — the echo is presentation', () => {
    const message = buildInputResponseMessage(request, { tob: '00:20' });
    const proseOnly = message.split('```')[0].trim();
    expect(proseOnly).toBe('Birth time: 12:20 am');
    expect(parseAsTheEngineDoes(proseOnly)).toBeNull();
  });

  it('the 24-hour value travels even though the echo says am/pm', () => {
    // am/pm loss is one of the two failures (A6#3, A6#8) this widget removes.
    // The ambiguous form must never be the thing on the wire.
    const message = buildInputResponseMessage(request, { tob: '00:20' });
    expect(parseAsTheEngineDoes(message)!.values.tob).toBe('00:20');
    expect(message).toContain('12:20 am');
  });

  it('"I don\'t know" travels as an explicit null, not as an absent key', () => {
    const seen = parseAsTheEngineDoes(buildInputResponseMessage(request, { tob: null }));
    expect(Object.prototype.hasOwnProperty.call(seen!.values, 'tob')).toBe(true);
    expect(seen!.values.tob).toBeNull();
  });

  it('ASTRAL-88 — the option VALUE travels, never its label', () => {
    const label = request.fields[1].options[0].label;
    const message = buildInputResponseMessage(request, { birth_time_confidence: 'exact' });
    expect(parseAsTheEngineDoes(message)!.values.birth_time_confidence).toBe('exact');
    // the label may appear in the human echo; it may not be the value
    expect(message).toContain(label);
    expect(JSON.parse(/```input_response\n([\s\S]*?)```/.exec(message)![1]).values)
      .toEqual({ birth_time_confidence: 'exact' });
  });
});

describe('ASTRAL-89 — the echo, and suppressing the fence on a user bubble', () => {
  it('reads as a sentence a human can dispute', () => {
    expect(echoFor(request, { tob: '23:45', birth_time_confidence: 'exact' })).toBe(
      'Birth time: 11:45 pm · How exact is that time?: Exact — off a record or a clock',
    );
    expect(echoFor(request, { tob: null })).toBe("Birth time: I don't know");
  });

  it('strips the fence and keeps the echo', () => {
    const message = buildInputResponseMessage(request, { tob: '00:20' });
    expect(stripInputResponse(message)).toBe('Birth time: 12:20 am');
    expect(stripInputResponse(message)).not.toContain('{');
  });

  it('leaves an ordinary typed message untouched', () => {
    const typed = 'born 2 April 1989 at 12:20 am in Padrauna';
    expect(stripInputResponse(typed)).toBe(typed);
  });

  it('leaves an ordinary code fence alone — this suppresses ONE type', () => {
    const withCode = 'here you go\n\n```json\n{"a":1}\n```';
    expect(stripInputResponse(withCode)).toBe(withCode);
  });
});
