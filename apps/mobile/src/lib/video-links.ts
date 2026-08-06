// Corpus-media citations inside assistant markdown, split out for native
// playback. The backend cites the platform's own hosted footage as
//   [Title](https://…/api/v1/files/corpus-media/{sha}?t={token}#t={seconds})
// — a URL that streams mp4 but has no web page behind it. The web app swaps
// these for an inline <video>; on mobile the markdown renderer would show a
// link that dumps the user into a raw browser stream, so the same split
// happens here and the player is expo-video.
//
// Kept pure (no RN imports) so the parsing is unit-testable.

export interface VideoSegment {
  kind: 'video';
  url: string;
  posterUrl: string;
  title: string;
  sha: string;
  startSeconds: number;
}

export interface TextSegment {
  kind: 'text';
  text: string;
}

export type MessageSegment = VideoSegment | TextSegment;

const CORPUS_MEDIA_LINK =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]*\/api\/v1\/files\/corpus-media\/([0-9a-f]{64})\?[^\s)#]*(?:#t=(\d+))?)\)/g;

/**
 * Split markdown into text and video segments.
 *
 * One player per asset: repeat citations of the same footage collapse to a
 * plain "(see video above)" so three chunks from one video don't stack three
 * players in a scrolling list.
 */
export function splitVideoSegments(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const m of text.matchAll(CORPUS_MEDIA_LINK)) {
    const [whole, title, fullUrl, sha, startS] = m;
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: 'text', text: text.slice(last, start) });
    if (seen.has(sha)) {
      out.push({ kind: 'text', text: '*(see video above)*' });
    } else {
      seen.add(sha);
      out.push({
        kind: 'video',
        url: fullUrl,
        posterUrl: fullUrl.replace(/#t=\d+$/, '') + '&kind=poster',
        title,
        sha,
        startSeconds: startS ? parseInt(startS, 10) : 0,
      });
    }
    last = start + whole.length;
  }
  if (last === 0) return [{ kind: 'text', text }];
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}
