/**
 * Corpus-media links must become an inline player, not a raw-mp4 tab.
 *
 * These are the platform's own hosted videos (knee program footage): the
 * backend cites them as [Title](…/api/v1/files/corpus-media/{sha}?t=token#t=s)
 * and the only viewing experience a plain link gives is a full-window mp4 in
 * a new tab. The transform swaps the first citation of each asset for a
 * <video> card and collapses repeat citations, mirroring the YouTube embed.
 */
import { embedCorpusMediaLinks } from '../embed-links';

const SHA = 'a'.repeat(64);
const SHA2 = 'b'.repeat(64);
const URL = `http://localhost:8080/api/v1/files/corpus-media/${SHA}?t=abc.def`;

describe('embedCorpusMediaLinks', () => {
  it('turns a corpus-media link into an inline video with poster and caption', () => {
    const out = embedCorpusMediaLinks(`Watch: [PHASE 1 STRATEGY](${URL}#t=42)`);
    expect(out).toContain('<video controls preload="none" playsinline');
    expect(out).toContain(`src="${URL}#t=42"`);           // starts at the cited moment
    expect(out).toContain(`poster="${URL}&kind=poster"`); // no mp4 pulled just to paint
    expect(out).toContain(`<a href="${URL}#t=42"`);       // caption keeps the raw link
    expect(out).toContain('PHASE 1 STRATEGY');
  });

  it('collapses repeat citations of the same footage', () => {
    const text = `[A](${URL}#t=10)\n\nAlso see [A again](${URL}#t=99).`;
    const out = embedCorpusMediaLinks(text);
    expect(out.match(/<video/g)).toHaveLength(1);
    expect(out).toContain('*(see video above)*');
  });

  it('embeds each distinct asset once', () => {
    const text =
      `[A](http://x/api/v1/files/corpus-media/${SHA}?t=tk)\n\n` +
      `[B](http://x/api/v1/files/corpus-media/${SHA2}?t=tk)`;
    expect(embedCorpusMediaLinks(text).match(/<video/g)).toHaveLength(2);
  });

  it('leaves every other link alone', () => {
    const text =
      '[docs](https://example.com/api/v1/files/abc/download?t=x) and ' +
      '[yt](https://www.youtube.com/watch?v=AAAAAAAAAAA)';
    expect(embedCorpusMediaLinks(text)).toBe(text);
  });

  it('keeps surrounding prose on its own lines around the player', () => {
    const out = embedCorpusMediaLinks(`Intro text [T](${URL}) closing text.`);
    expect(out).toMatch(/^Intro text\n\n<div class="youtube-embed/);
    expect(out).toMatch(/closing text\.$/);
  });

  // ── the Hindi audio toggle (docs/44 CORP-29) ─────────────────────────────

  it('renders no dub toggle for an unstamped URL — the player is unchanged', () => {
    const out = embedCorpusMediaLinks(`[T](${URL}#t=5)`);
    expect(out).not.toContain('data-dub-toggle');
  });

  it('renders the toggle when the URL carries the dub stamp', () => {
    const stamped = `${URL}&dub=hi`;
    const out = embedCorpusMediaLinks(`[T](${stamped}#t=5)`);
    expect(out).toContain('data-dub-toggle');
    expect(out).toContain(`data-src-en="${stamped}#t=5"`);
    // the Hindi source keeps the same signed URL, same start moment, and
    // only adds the kind — one auth surface, one timeline
    expect(out).toContain(`data-src-hi="${stamped}&kind=source_hi#t=5"`);
    expect(out).toContain('हिन्दी');
  });

  it('does not mistake a dub stamp for another language', () => {
    const out = embedCorpusMediaLinks(`[T](${URL}&dub=ta#t=5)`);
    expect(out).not.toContain('data-dub-toggle');
  });
});
