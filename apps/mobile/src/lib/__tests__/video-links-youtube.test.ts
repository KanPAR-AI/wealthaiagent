/**
 * Bug f4d0201a — "Video thumbnails don't come" (Arthur1203, 2026-08-10).
 *
 * The chat behind the report carried ONLY YouTube links: the knee agent's
 * curated catalog references (`**Watch:** [title](https://www.youtube.com/
 * watch?v=ID&t=NN)`). `splitVideoSegments` only knew corpus-media citations,
 * so those rendered as bare markdown links — no card, no still. Pinned here:
 * a YouTube citation becomes a `youtube` segment with YouTube's own
 * thumbnail and the cited start, corpus-media citations are untouched, and
 * a message with neither is still one text segment.
 */
import { splitVideoSegments, youtubeStartSeconds, youtubeThumbnailUrl } from '../video-links';

const SHA = 'a'.repeat(64);
const CORPUS = `https://x/api/v1/files/corpus-media/${SHA}?t=tok`;
// the shape the failing chat's answers used (video ids are synthetic)
const WATCH = 'https://www.youtube.com/watch?v=abcDEF12345&t=630';

function youtube(text: string) {
  const seg = splitVideoSegments(text).find((s) => s.kind === 'youtube');
  if (!seg || seg.kind !== 'youtube') throw new Error('no youtube segment');
  return seg;
}

describe('a YouTube citation becomes a card with a thumbnail', () => {
  it('the curated "Watch:" reference the knee agent writes', () => {
    const segs = splitVideoSegments(`**Watch:** [Top 10 Glute Exercises](${WATCH})\n\nmore`);
    expect(segs.map((s) => s.kind)).toEqual(['text', 'youtube', 'text']);
    const yt = youtube(`[Top 10 Glute Exercises](${WATCH})`);
    expect(yt.videoId).toBe('abcDEF12345');
    expect(yt.title).toBe('Top 10 Glute Exercises');
    expect(yt.url).toBe(WATCH);
    expect(yt.startSeconds).toBe(630);
    expect(yt.thumbnailUrl).toBe('https://img.youtube.com/vi/abcDEF12345/hqdefault.jpg');
  });

  it('youtu.be, shorts and embed forms all resolve the same id', () => {
    for (const u of [
      'https://youtu.be/abcDEF12345?t=36',
      'https://www.youtube.com/shorts/abcDEF12345',
      'https://www.youtube.com/embed/abcDEF12345?start=36',
      'https://m.youtube.com/watch?feature=share&v=abcDEF12345',
    ]) {
      expect(youtube(`[T](${u})`).videoId).toBe('abcDEF12345');
    }
  });

  it('a repeat citation of the same video stays a plain link, not a second card', () => {
    const segs = splitVideoSegments(
      `[A](${WATCH}) then [A again](https://www.youtube.com/watch?v=abcDEF12345&t=900)`);
    expect(segs.filter((s) => s.kind === 'youtube')).toHaveLength(1);
    const tail = segs[segs.length - 1];
    expect(tail.kind).toBe('text');
    if (tail.kind === 'text') expect(tail.text).toContain('[A again](');
  });

  it('a non-YouTube, non-corpus link is left alone', () => {
    const segs = splitVideoSegments('see [Amazon](https://amzn.to/3keBJcq) for it');
    expect(segs).toEqual([{ kind: 'text', text: 'see [Amazon](https://amzn.to/3keBJcq) for it' }]);
  });
});

describe('a 12-character id is not an 11-character id plus a letter (round 2)', () => {
  it('leaves an over-long id alone rather than carding the wrong video', () => {
    const segs = splitVideoSegments('[T](https://www.youtube.com/watch?v=abcDEF123456&t=5)');
    expect(segs.every((s) => s.kind === 'text')).toBe(true);
  });
  it('an id followed by a query or fragment still matches', () => {
    expect(youtube('[T](https://youtu.be/abcDEF12345?t=5)').videoId).toBe('abcDEF12345');
    expect(youtube('[T](https://www.youtube.com/watch?v=abcDEF12345#x)').videoId).toBe('abcDEF12345');
  });
});

describe('start seconds', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abcDEF12345&t=630', 630],
    ['https://www.youtube.com/watch?v=abcDEF12345&t=90s', 90],
    ['https://www.youtube.com/watch?v=abcDEF12345&t=1m30s', 90],
    ['https://www.youtube.com/watch?v=abcDEF12345&t=1m30', 90],   // round 2: bare trailing seconds
    ['https://www.youtube.com/watch?v=abcDEF12345&t=1h2m3s', 3723],
    ['https://www.youtube.com/embed/abcDEF12345?start=45', 45],
    ['https://www.youtube.com/watch?v=abcDEF12345', 0],
  ])('%s → %d', (url, seconds) => {
    expect(youtubeStartSeconds(url)).toBe(seconds);
  });

  it('thumbnail url is YouTube\'s public still for the id', () => {
    expect(youtubeThumbnailUrl('abcDEF12345')).toMatch(/^https:\/\/img\.youtube\.com\/vi\/abcDEF12345\//);
  });
});

describe('corpus-media citations are untouched by the YouTube path', () => {
  it('a mixed message keeps document order: corpus card, then youtube card', () => {
    const segs = splitVideoSegments(
      `intro [Bridges](${CORPUS}#t=61) mid [Watch](${WATCH}) end`);
    expect(segs.map((s) => s.kind)).toEqual(['text', 'video', 'text', 'youtube', 'text']);
    const v = segs[1];
    if (v.kind === 'video') {
      expect(v.sha).toBe(SHA);
      expect(v.startSeconds).toBe(61);
      expect(v.posterUrl).toContain('&kind=poster');
    }
  });

  it('a repeated corpus citation still collapses to "(see video above)"', () => {
    const segs = splitVideoSegments(`[A](${CORPUS}#t=1) [B](${CORPUS}#t=2)`);
    expect(segs.filter((s) => s.kind === 'video')).toHaveLength(1);
    expect(segs.some((s) => s.kind === 'text' && s.text === '*(see video above)*')).toBe(true);
  });

  it('a message with no citation is one text segment', () => {
    expect(splitVideoSegments('plain words')).toEqual([{ kind: 'text', text: 'plain words' }]);
  });
});
