/**
 * Corpus-media citation parsing, including the dubbed-track stamp
 * (docs/44 CORP-29). Pure module — imported by relative path so the root
 * jest project runs it without the Expo toolchain.
 */
import { dubUrl, splitVideoSegments } from '../video-links';

const SHA = 'a'.repeat(64);
const URL = `https://x/api/v1/files/corpus-media/${SHA}?t=tok`;

function firstVideo(text: string) {
  const seg = splitVideoSegments(text).find((s) => s.kind === 'video');
  if (!seg || seg.kind !== 'video') throw new Error('no video segment');
  return seg;
}

describe('splitVideoSegments dub stamps', () => {
  it('a plain citation carries no dub languages — the player is unchanged', () => {
    expect(firstVideo(`[T](${URL}#t=5)`).dubLangs).toEqual([]);
  });

  it('a stamped citation carries its languages', () => {
    expect(firstVideo(`[T](${URL}&dub=hi#t=5)`).dubLangs).toEqual(['hi']);
    expect(firstVideo(`[T](${URL}&dub=hi)`).dubLangs).toEqual(['hi']);
  });

  it('does not mistake lookalike params for a dub stamp', () => {
    expect(firstVideo(`[T](${URL}&dubious=hi#t=5)`).dubLangs).toEqual([]);
    expect(firstVideo(`[T](${URL}&redub=hi)`).dubLangs).toEqual([]);
  });

  it('the stamp does not break the fields that existed before it', () => {
    const v = firstVideo(`[Toe curls](${URL}&dub=hi#t=71)`);
    expect(v.sha).toBe(SHA);
    expect(v.startSeconds).toBe(71);
    expect(v.posterUrl).toContain('&kind=poster');
  });
});

describe('dubUrl', () => {
  it('inserts the per-language kind before the time fragment', () => {
    expect(dubUrl(`${URL}&dub=hi#t=71`, 'hi'))
      .toBe(`${URL}&dub=hi&kind=source_hi#t=71`);
  });

  it('appends when there is no fragment', () => {
    expect(dubUrl(`${URL}&dub=hi`, 'hi')).toBe(`${URL}&dub=hi&kind=source_hi`);
  });
});
