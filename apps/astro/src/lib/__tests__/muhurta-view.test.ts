// docs/49 ASTRAL-17 / F36 / AMB-26(a) — the muhurta surface's decisions.
//
// Relative import: `@/*` maps to the WEB app's `src` in the root jest
// project.

import {
  MUHURTA_COMPOSE_PROMPT,
  MUHURTA_EMPTY_LINE,
  MUHURTA_REPLY_HINT,
  muhurtaReplyKind,
  replyReady,
  stillAsking,
} from '../muhurta-view';

/**
 * There is no opening turn: the user's own sentence is turn one, because a
 * two-turn opening runs into a live subject-attribution defect (the header of
 * `muhurta-view.ts` carries the measurement). What the screen contributes is
 * a PROMPT, and a prompt is not a message.
 */
describe('the compose prompt asks; it does not answer', () => {
  it('asks for the three things the engine needs, in the user’s words', () => {
    expect(MUHURTA_COMPOSE_PROMPT).toMatch(/what are you planning/i);
    expect(MUHURTA_COMPOSE_PROMPT).toMatch(/where/i);
    expect(MUHURTA_COMPOSE_PROMPT).toMatch(/when/i);
  });

  it('carries no event, no place and no date — nothing the client decided', () => {
    expect(MUHURTA_COMPOSE_PROMPT).not.toMatch(
      /wedding|griha|marriage|september|pune|mumbai|\d{4}-\d{2}-\d{2}/i,
    );
  });

  it('is never sent: only a non-empty DRAFT is sendable', () => {
    // The prompt lives on screen beside an empty box, and an empty box sends
    // nothing. A screen that submitted its own prompt would be the client
    // composing the turn.
    expect(replyReady('')).toBe(false);
  });
});

describe('what came back, and in which order it decides the screen', () => {
  it('windows win over a follow-up question — the screen does not bury a result', () => {
    expect(muhurtaReplyKind(true, false, 'Would you like a narrower range?', true))
      .toBe('windows');
    expect(muhurtaReplyKind(true, true, '', true)).toBe('windows');
  });

  it('a structured ask is rendered as a form when one ever arrives', () => {
    expect(muhurtaReplyKind(false, true, 'What is the event?', true)).toBe('form_ask');
  });

  it('prose BEFORE anything is computed is the ask', () => {
    expect(muhurtaReplyKind(false, false, 'Which city, and roughly when?', true))
      .toBe('prose_ask');
  });

  it('prose AFTER a result is commentary, not a new question', () => {
    expect(muhurtaReplyKind(false, false, 'The second window avoids Rahu Kaal.', false))
      .toBe('said');
  });

  it('nothing at all is `empty`, and empty has a sentence rather than a spinner', () => {
    expect(muhurtaReplyKind(false, false, '', true)).toBe('empty');
    expect(muhurtaReplyKind(false, false, '   ', false)).toBe('empty');
    expect(MUHURTA_EMPTY_LINE).toMatch(/didn.t come back/i);
  });
});

/**
 * `stillAsking` is deliberately NOT a cue over the sentence.
 *
 * This is the mistake F46 and F53 both record on the engine side: a bare
 * noun match or a question-mark heuristic answers an ordinary sentence with
 * the wrong surface. The screen knows something the prose does not — whether
 * a result exists yet — so that is what it reads.
 */
describe('ask-or-commentary is decided by state, never by the prose', () => {
  it('before a result, prose is an ask', () => {
    expect(stillAsking(false)).toBe(true);
  });

  it('after a result, prose is commentary', () => {
    expect(stillAsking(true)).toBe(false);
  });

  it('a question mark does not make it an ask, and its absence does not unmake one', () => {
    // Same prose, opposite outcomes, decided by the state alone.
    const q = 'Which city?';
    expect(muhurtaReplyKind(false, false, q, stillAsking(false))).toBe('prose_ask');
    expect(muhurtaReplyKind(false, false, q, stillAsking(true))).toBe('said');
    const noQ = 'I need the city and a rough date range';
    expect(muhurtaReplyKind(false, false, noQ, stillAsking(false))).toBe('prose_ask');
  });
});

describe('the reply box sends the user’s own sentence, or nothing', () => {
  it('blank is not an answer', () => {
    expect(replyReady('')).toBe(false);
    expect(replyReady('   \n ')).toBe(false);
  });

  it('anything typed is', () => {
    expect(replyReady('a wedding in Pune in September')).toBe(true);
  });

  /**
   * F18's line, on this screen: the hint SHOWS the shape of an answer and is
   * never the answer. It has to be inert — a placeholder that submits itself
   * is a client-composed value reaching the extractor, which is precisely
   * the pattern the structural test pins.
   */
  it('the hint is a placeholder, and a placeholder is not a value', () => {
    expect(MUHURTA_REPLY_HINT).toMatch(/^e\.g\. /);
    // `replyReady` is the ONLY gate on sending, and it reads the draft. An
    // empty draft with a hint on screen sends nothing.
    expect(replyReady('')).toBe(false);
  });
});
