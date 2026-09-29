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
  /** Dubbed audio tracks the backend stamped into the citation URL as
   *  `&dub=hi` (docs/44 CORP-29) — the URL is the only channel between the
   *  resolver and this renderer. Empty for most videos; the player shows a
   *  language toggle only when non-empty. */
  dubLangs: string[];
}

/** The per-language MP4 for a citation URL: same signed URL, same start
 *  moment, only `kind=source_{lang}` added — one auth surface, one timeline. */
export function dubUrl(url: string, lang: string): string {
  const param = `&kind=source_${lang}`;
  const hash = url.indexOf('#');
  return hash >= 0 ? url.slice(0, hash) + param + url.slice(hash) : url + param;
}

export interface TextSegment {
  kind: 'text';
  text: string;
}

/**
 * A YouTube citation — the knee agent's curated catalog links
 * (`**Watch:** [title](https://www.youtube.com/watch?v=ID&t=NN)`) and any
 * other YouTube link an agent writes. Bug f4d0201a ("video thumbnails don't
 * come"): the chat that filed it carried ONLY YouTube links, which rendered
 * as bare markdown text — no card, no thumbnail. The card shows YouTube's
 * own still (public, no auth) and opens the link at its timestamp; nothing
 * is embedded, so no player mounts per citation.
 */
export interface YouTubeSegment {
  kind: 'youtube';
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  startSeconds: number;
}

export type MessageSegment = VideoSegment | YouTubeSegment | TextSegment;

const CORPUS_MEDIA_LINK =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]*\/api\/v1\/files\/corpus-media\/([0-9a-f]{64})\?[^\s)#]*(?:#t=(\d+))?)\)/g;

// watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID — ID is YouTube's 11-char
// alphabet. `t=` may be `36`, `36s` or `1m30s`; `start=` is the embed form.
const YOUTUBE_LINK =
  /\[([^\]]+)\]\((https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s)]*?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])[^\s)]*)\)/g;

/** `t=90`, `t=90s`, `t=1m30s`, `t=1m30` (trailing bare digits are
 *  seconds), `start=90` → seconds; 0 when absent. */
export function youtubeStartSeconds(url: string): number {
  const m = /[?&#](?:t|start)=([0-9hms]+)/.exec(url);
  if (!m) return 0;
  const raw = m[1];
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  let total = 0;
  for (const part of raw.matchAll(/(\d+)([hms]?)/g)) {
    const n = parseInt(part[1], 10);
    total += part[2] === 'h' ? n * 3600 : part[2] === 'm' ? n * 60 : n;
  }
  return total;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Split markdown into text, video and youtube segments.
 *
 * One player per asset: repeat citations of the same footage collapse to a
 * plain "(see video above)" so three chunks from one video don't stack three
 * players in a scrolling list. A repeat YouTube citation keeps its markdown
 * link instead — its timestamp is the point ("jump to 10:30"), and a text
 * link costs nothing to scroll past.
 */
export function splitVideoSegments(text: string): MessageSegment[] {
  type Hit = { start: number; end: number; seg: MessageSegment | null };
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const seenYt = new Set<string>();
  for (const m of text.matchAll(CORPUS_MEDIA_LINK)) {
    const [whole, title, fullUrl, sha, startS] = m;
    const start = m.index ?? 0;
    let seg: MessageSegment;
    if (seen.has(sha)) {
      seg = { kind: 'text', text: '*(see video above)*' };
    } else {
      seen.add(sha);
      seg = {
        kind: 'video',
        url: fullUrl,
        posterUrl: fullUrl.replace(/#t=\d+$/, '') + '&kind=poster',
        title,
        sha,
        startSeconds: startS ? parseInt(startS, 10) : 0,
        dubLangs: [...fullUrl.matchAll(/[?&]dub=([a-z]{2})(?=[&#]|$)/g)]
          .map((d) => d[1]),
      };
    }
    hits.push({ start, end: start + whole.length, seg });
  }
  for (const m of text.matchAll(YOUTUBE_LINK)) {
    const [whole, title, url, videoId] = m;
    const start = m.index ?? 0;
    if (seenYt.has(videoId)) continue; // the repeat stays a text link
    seenYt.add(videoId);
    hits.push({
      start,
      end: start + whole.length,
      seg: {
        kind: 'youtube',
        url,
        videoId,
        title,
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        startSeconds: youtubeStartSeconds(url),
      },
    });
  }
  if (!hits.length) return [{ kind: 'text', text }];
  hits.sort((a, b) => a.start - b.start);

  const out: MessageSegment[] = [];
  let last = 0;
  for (const h of hits) {
    if (h.start > last) out.push({ kind: 'text', text: text.slice(last, h.start) });
    if (h.seg) out.push(h.seg);
    last = h.end;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}
