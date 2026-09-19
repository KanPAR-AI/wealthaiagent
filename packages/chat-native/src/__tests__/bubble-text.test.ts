/**
 * What a bubble's text ends up being (Role-3 NEW-1 and NEW-4).
 *
 * `message-bubble.tsx` cannot be mounted by any jest project here, and
 * Role-3 measured the cost: the bubble ignoring `userText`, the bubble
 * ignoring `assistantText`, and the list not passing `previous` were THREE
 * separate mutations that each left the whole root suite green while a
 * user's own birth date rendered in clear. The decisions moved into
 * `bubble-text.ts` so they can be driven; that the component still CALLS
 * them is pinned in `apps/astro/src/lib/__tests__/birth-privacy-structure.test.ts`.
 */
import type { ContentBlock, Message } from '@wealthai/core';

import {
  applyAssistantOverride,
  resolveAssistantOverride,
  resolveUserText,
} from '../bubble-text';

const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1', chatId: 'c1', sender: 'bot', message: 'hello', timestamp: '', ...over,
} as Message);

const ANSWER = `Birth time: x\n\n\`\`\`input_response\n${JSON.stringify({
  type: 'input_response', ask: 'field_correction', echo: 'x', values: { tob: '15:20' },
})}\n\`\`\``;

describe('a USER bubble', () => {
  it('is the shipped default when the host passes nothing', () => {
    // AMB-17 (a): the raw fence is suppressed, the ASTRAL-89 echo remains.
    const out = resolveUserText(msg({ sender: 'user', message: ANSWER }));
    expect(out).toBe('Birth time: x');
    expect(out).not.toContain('```');
  });

  it('is the HOST’s when it passes one', () => {
    const out = resolveUserText(msg({ sender: 'user', message: ANSWER }), () => '••••••');
    expect(out).toBe('••••••');
  });
});

describe('an ASSISTANT bubble’s override', () => {
  it('is undefined when the host passes nothing — draw it as before', () => {
    expect(resolveAssistantOverride(msg(), undefined, undefined)).toBeUndefined();
  });

  it('is asked WITH the previous turn, which is the whole point', () => {
    const seen: Array<string | undefined> = [];
    const before = msg({ sender: 'user', message: ANSWER });
    resolveAssistantOverride(msg(), before, (_m, p) => { seen.push(p?.message); return 'x'; });
    expect(seen).toEqual([ANSWER]);
  });

  it('a host given no previous turn sees undefined, not a crash', () => {
    expect(resolveAssistantOverride(msg(), undefined, (_m, p) => (p ? 'reply' : 'standalone')))
      .toBe('standalone');
  });
});

describe('applying it — NEW-4: it replaces the PROSE, not the reply', () => {
  const widget: ContentBlock = { type: 'widget', widget: { type: 'input_request' } } as ContentBlock;
  const text = (content: string): ContentBlock => ({ type: 'text', content });

  it('keeps an input_request widget so a RE-ASK stays answerable', () => {
    // The measured break: a correction the engine REFUSES comes back as a
    // sentence plus a fresh picker. Replacing the blocks wholesale deleted
    // the picker, leaving the user with nothing to answer.
    const out = applyAssistantOverride([text('Your birth time is now 15:20.'), widget], 'hidden');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ type: 'text', content: 'hidden' });
    expect(out[1]).toBe(widget);
  });

  it('collapses several text runs into one, in the FIRST run’s place', () => {
    const out = applyAssistantOverride([text('a'), widget, text('b'), text('c')], 'one');
    expect(out).toEqual([{ type: 'text', content: 'one' }, widget]);
  });

  it('puts the sentence FIRST when the reply is all widget', () => {
    const out = applyAssistantOverride([widget], 'one');
    expect(out).toEqual([{ type: 'text', content: 'one' }, widget]);
  });

  it('returns the SAME array untouched when there is no override', () => {
    const blocks = [text('a'), widget];
    expect(applyAssistantOverride(blocks, undefined)).toBe(blocks);
  });

  it('an empty-string override still replaces — "" is a decision, not absence', () => {
    expect(applyAssistantOverride([text('a')], '')).toEqual([{ type: 'text', content: '' }]);
  });
});
