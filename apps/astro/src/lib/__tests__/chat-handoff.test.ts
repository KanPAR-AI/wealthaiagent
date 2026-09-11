// Owner ruling 2026-09-11: "when ask about my match always start a new
// chat." The decision table for a handed-off turn, pinned.

import { handoffAction } from '../chat-handoff';

describe('handoffAction', () => {
  it('no pending turn is no action', () => {
    expect(handoffAction({}, 'c1', null).kind).toBe('none');
    expect(handoffAction({ pending: '  ' }, null, null).kind).toBe('none');
  });

  it('a fresh handoff LEAVES the mounted conversation first', () => {
    // The match surfaces: fresh:'1', no chatId — even with a running chat
    // on the mounted tab, the turn must not land in it.
    const a = handoffAction({ pending: 'Tell me about Anjali', fresh: '1',
                              handoffKey: 'k1' }, 'running-chat', null);
    expect(a.kind).toBe('reset');
  });

  it('and sends once the conversation is gone', () => {
    const a = handoffAction({ pending: 'Tell me about Anjali', fresh: '1',
                              handoffKey: 'k1' }, null, null);
    expect(a).toEqual({ kind: 'send', key: 'k1' });
  });

  it('a SECOND match ask goes through — keys, not a once-ever flag', () => {
    const a = handoffAction({ pending: 'Tell me about Rohan', fresh: '1',
                              handoffKey: 'k2' }, null, 'k1');
    expect(a).toEqual({ kind: 'send', key: 'k2' });
  });

  it('the same handoff never sends twice', () => {
    const a = handoffAction({ pending: 'Tell me about Anjali', fresh: '1',
                              handoffKey: 'k1' }, null, 'k1');
    expect(a.kind).toBe('none');
  });

  it('a named chat waits for adoption, then joins — screen 2 unchanged', () => {
    const params = { pending: 'answer', chatId: 'c9' };
    expect(handoffAction(params, null, null).kind).toBe('wait');
    expect(handoffAction(params, 'c9', null)).toEqual(
      { kind: 'send', key: 'answer' });
  });

  it('a chatless non-fresh handoff keeps the old semantics', () => {
    // Insights/Timeline suggestions: join the mounted chat, dedupe by the
    // turn text (the pre-key behaviour, per text instead of per launch).
    const params = { pending: 'How is today looking?' };
    expect(handoffAction(params, 'running-chat', null)).toEqual(
      { kind: 'send', key: 'How is today looking?' });
    expect(handoffAction(params, 'running-chat',
                         'How is today looking?').kind).toBe('none');
  });
});
