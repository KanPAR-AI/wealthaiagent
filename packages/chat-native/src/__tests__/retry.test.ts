/**
 * ↻ Retry REGENERATES (report 3a74d645: the native Retry posted the last user
 * message again, and the server persisted two identical user rows). The
 * lifecycle half is driven in `lifecycle.test.tsx`; this is the pure choice
 * of WHICH turn, plus pins that both apps call it.
 */
import fs from 'fs';
import path from 'path';

import type { Message } from '@wealthai/core';

import { retryTarget } from '../retry';

const m = (id: string, sender: 'user' | 'bot', message: string, over: Partial<Message> = {}): Message =>
  ({ id, chatId: 'c1', sender, message, timestamp: '', ...over } as Message);

const T = [
  m('u1', 'user', 'cast my kundli'),
  m('b1', 'bot', 'Your chart', { error: 'Response interrupted. Tap to retry.' }),
];

describe('retryTarget', () => {
  it('the tapped bubble: its OWN user message, both ids', () => {
    expect(retryTarget(T, 'b1')).toEqual({
      text: 'cast my kundli', files: [], retryOf: { userMessageId: 'u1', botMessageId: 'b1' },
    });
  });
  it('no id: the newest ERRORED bot bubble', () => {
    const msgs = [...T, m('u2', 'user', 'and Meera?'), m('b2', 'bot', 'fine')];
    expect(retryTarget(msgs)?.retryOf).toEqual({ userMessageId: 'u1', botMessageId: 'b1' });
  });
  it('never "the last user message" — after a later send, the tapped turn is still the one retried', () => {
    const msgs = [...T, m('u2', 'user', 'and Meera?'), m('b2', 'bot', 'x', { error: 'e' })];
    expect(retryTarget(msgs, 'b1')?.text).toBe('cast my kundli');
    expect(retryTarget(msgs, 'b2')?.text).toBe('and Meera?');
  });
  it('attachments travel with it', () => {
    const files = [{ name: 'palm.jpg', url: 'u', type: 'image/jpeg' }] as never;
    const msgs = [m('u1', 'user', 'read my palm', { files }), m('b1', 'bot', '', { error: 'e' })];
    expect(retryTarget(msgs, 'b1')?.files).toBe(files);
  });
  it('nothing to retry: null (unknown id, a user id, no preceding user, nothing errored)', () => {
    expect(retryTarget(T, 'nope')).toBeNull();
    expect(retryTarget(T, 'u1')).toBeNull();
    expect(retryTarget([m('b0', 'bot', 'hi', { error: 'e' })], 'b0')).toBeNull();
    expect(retryTarget([m('u1', 'user', 'a'), m('b1', 'bot', 'ok')])).toBeNull();
  });
});

describe('both apps retry by regenerating, never by sending again', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  it('the bubble names the bubble whose Retry was tapped', () => {
    expect(read('packages/chat-native/src/message-bubble.tsx'))
      .toContain('getPlatform().events.emit(CHAT_RETRY_EVENT, { messageId: message.id })');
  });
  it('Astral: retryTarget + retryOf on the raw send; a guest goes to the gate without parking', () => {
    const code = read('apps/astro/src/app/(tabs)/chat.tsx');
    expect(code).toMatch(/const target = retryTarget\(msgs, tapped\);\s*if \(target\) void rawSend\(target\.text, target\.files, \{ retryOf: target\.retryOf \}\);/);
    expect(code).toMatch(/CHAT_RETRY_EVENT, \(payload\) => \{\s*if \(!chatId\) return;\s*if \(readingGated\) \{\s*router\.push\('\/sign-in'\);\s*return;\s*\}/);
    expect(code).not.toMatch(/lastUser\.message/);
  });
  it('Arthur1203: retryTarget + retryOf', () => {
    const code = read('apps/mobile/src/app/(tabs)/index.tsx');
    expect(code).toMatch(/const target = retryTarget\(msgs, tapped\);\s*if \(target\) send\(target\.text, target\.files, \{ retryOf: target\.retryOf \}\);/);
    expect(code).not.toMatch(/lastUser\.message/);
  });
});
