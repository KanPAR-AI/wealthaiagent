/**
 * Words a host gives back to the composer (bug 29c19678, E2 round 3): a turn
 * the Astral sign-in gate held and had to drop comes back to the box rather
 * than being retyped. The composer cannot be mounted here, so the merge is a
 * pure function; that the composer CALLS it on every restore is pinned below.
 */
import fs from 'fs';
import path from 'path';

import { mergeRestoredText } from '../composer-restore';

const TEXT = 'I was born on 11 March 1994 at 6:40 am in Pune';

describe('mergeRestoredText', () => {
  it('an empty box gets the words back', () => {
    expect(mergeRestoredText('', TEXT)).toBe(TEXT);
    expect(mergeRestoredText('   ', TEXT)).toBe(TEXT);
  });
  it('never clobbers what the user is typing now — the restored words go first', () => {
    expect(mergeRestoredText('and Meera?', TEXT)).toBe(`${TEXT}\nand Meera?`);
  });
  it('restoring the same words twice does not duplicate them', () => {
    expect(mergeRestoredText(TEXT, TEXT)).toBe(TEXT);
  });
  it('nothing to restore leaves the box alone', () => {
    expect(mergeRestoredText('draft', '')).toBe('draft');
    expect(mergeRestoredText('draft', '  ')).toBe('draft');
  });
});

describe('the composer applies it', () => {
  const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('ChatInput merges on every restore request', () => {
    expect(src('chat-input.tsx')).toMatch(
      /useEffect\(\(\) => \{\s*if \(restore\) setText\(\(cur\) => mergeRestoredText\(cur, restore\.text\)\);\s*\}, \[restore\]\);/,
    );
  });
  it('ChatSurface hands the request to the composer', () => {
    expect(src('chat-surface.tsx')).toMatch(/renderSendIcon=\{renderSendIcon\}\s*restore=\{restore\}/);
  });
});
