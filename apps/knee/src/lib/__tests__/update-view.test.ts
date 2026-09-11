// The update popup's pure decisions: prompt on a fetched update, don't re-nag
// a deferred one, prompt again for a NEWER one.

import { initialState, onAccepted, onDeferred, onFetched } from '../update-view';

describe('update prompt state', () => {
  it('a fetched update shows the popup', () => {
    expect(onFetched(initialState, 'u1').ready).toBe(true);
  });

  it('"Later" hides it and the SAME update does not re-nag on refetch', () => {
    let s = onFetched(initialState, 'u1');
    s = onDeferred(s, 'u1');
    expect(s.ready).toBe(false);
    expect(onFetched(s, 'u1').ready).toBe(false);   // foreground re-check, same id
  });

  it('a NEWER update supersedes the deferral and prompts again', () => {
    let s = onDeferred(onFetched(initialState, 'u1'), 'u1');
    expect(onFetched(s, 'u2').ready).toBe(true);
  });

  it('an id-less update always prompts (never silently swallowed)', () => {
    const s = onDeferred(onFetched(initialState, null), null);
    expect(onFetched(s, null).ready).toBe(true);
  });

  it('"Update now" hides the popup (the caller reloads)', () => {
    expect(onAccepted(onFetched(initialState, 'u1')).ready).toBe(false);
  });
});
