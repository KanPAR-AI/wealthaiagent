/**
 * Markdown pre-processors that turn video citations into inline players.
 *
 * Kept free of React/ESM-only imports so the transforms are unit-testable
 * under Jest (react-markdown and friends are ESM-only and cannot be imported
 * from a test).
 */

/**
 * Convert YouTube links to embedded iframe HTML.
 *
 * Consolidates multiple references to the same video into a single
 * embedded player so the response doesn't show 3 identical iframes
 * when 3 corpus chunks from the same video are cited.
 */
export function embedYouTubeLinks(text: string): string {
  // First pass: collect all YouTube links and group by video ID
  const ytPattern =
    /^(.*?)\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]*v=([a-zA-Z0-9_-]+)[^\s)]*|youtu\.be\/([a-zA-Z0-9_-]+)[^\s)]*?))\)(.*)$/gm;

  const seenVideos = new Set<string>();
  return text.replace(ytPattern, (_match, before, title, fullUrl, vidId1, vidId2, after) => {
    const videoId = vidId1 || vidId2;
    if (!videoId) return _match;

    // Skip duplicate embeds for the same video — show only the first
    if (seenVideos.has(videoId)) {
      // Keep the surrounding text but replace the link with a plain text ref
      const prefix = before.trim() ? before.trim() + ' ' : '';
      const suffix = after.trim() ? ' ' + after.trim() : '';
      return `${prefix}*(see video above)*${suffix}`;
    }
    seenVideos.add(videoId);

    const timeMatch = fullUrl.match(/[?&]t=(\d+)/);
    const start = timeMatch ? timeMatch[1] : '0';
    const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&rel=0`;
    const prefix = before.trim() ? before.trim() + '\n\n' : '';
    const suffix = after.trim() ? '\n\n' + after.trim() : '';
    return (
      `${prefix}<div class="youtube-embed my-3">` +
      `<iframe src="${embedUrl}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` +
      `<div class="youtube-embed-caption"><a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>` +
      `</div>${suffix}`
    );
  });
}

/**
 * Convert corpus-media links into an inline player.
 *
 * These are the platform's own hosted videos (knee program footage etc.) —
 * they have no YouTube page, only a signed streaming URL at
 * /api/v1/files/corpus-media/{sha}?t={token}#t={seconds}. Without this the
 * link opens a raw mp4 in a new tab; with it the video plays in the chat.
 *
 * Mirrors embedYouTubeLinks: one player per asset, later citations of the
 * same footage collapse to "(see video above)". `preload="none"` + a poster
 * (same token, kind=poster) so a message with three videos doesn't pull
 * three mp4s just to render.
 */
export function embedCorpusMediaLinks(text: string): string {
  const cmPattern =
    /^(.*?)\[([^\]]+)\]\((https?:\/\/[^\s)]*\/api\/v1\/files\/corpus-media\/([0-9a-f]{64})\?[^\s)#]*(?:#t=(\d+))?)\)(.*)$/gm;

  const seenAssets = new Set<string>();
  return text.replace(cmPattern, (_match, before, title, fullUrl, sha, startS, after) => {
    if (seenAssets.has(sha)) {
      const prefix = before.trim() ? before.trim() + ' ' : '';
      const suffix = after.trim() ? ' ' + after.trim() : '';
      return `${prefix}*(see video above)*${suffix}`;
    }
    seenAssets.add(sha);

    const posterUrl = fullUrl.replace(/#t=\d+$/, '') + '&kind=poster';
    // The #t= media fragment starts playback at the cited moment.
    const srcUrl = startS ? fullUrl : fullUrl.replace(/#t=\d+$/, '');
    const prefix = before.trim() ? before.trim() + '\n\n' : '';
    const suffix = after.trim() ? '\n\n' + after.trim() : '';
    return (
      `${prefix}<div class="youtube-embed my-3">` +
      `<video controls preload="none" playsinline src="${srcUrl}" poster="${posterUrl}" title="${title}"></video>` +
      `<div class="youtube-embed-caption"><a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>` +
      `</div>${suffix}`
    );
  });
}
