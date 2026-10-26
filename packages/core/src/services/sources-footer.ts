// The Sources footer as a gallery (bug 6c329647).
//
// The backend appends every retrieved source to an answer as a markdown list
// ("---\n**Sources:**\n- [title](url)…"). Both clients turn each YouTube
// link into a player or a card, so an answer with twenty sources ends in a
// vertical stack of twenty players — the "scroll this much" the owner filed.
// Since chatservice 2026-10-26 the same sources also arrive as a
// `widget_sources` widget. A client that renders the widget hides the list;
// one that does not (an older app build) keeps it. Pure: no React, no DOM.

import type { ContentBlock, Widget } from '../types';

export const SOURCES_WIDGET_TYPE = 'widget_sources';

export interface SourceCard {
  title: string;
  url: string;
  video_id?: string | null;
  /** The cited moment, seconds into the video. */
  t?: number | null;
  chapter?: string | null;
  verse?: string | null;
  /** explanation / story / verse / chapter / source — what kind of thing this is. */
  kind?: string | null;
  /** The parent talk, short: "Ch 14 · Talk 3". */
  talk?: string | null;
  /** The parent talk's full title. */
  document_title?: string | null;
}

export interface SourcesWidgetData {
  title?: string;
  items: SourceCard[];
}

/** The gallery's items from a widget of either shape the stream produces
 *  (`{type, items}` flat, or `{type, data: {items}}`). [] when it is not a
 *  sources widget or carries nothing. */
export function sourceCardsOf(widget: Widget | undefined | null): SourceCard[] {
  if (!widget || widget.type !== SOURCES_WIDGET_TYPE) return [];
  const data: any = (widget as any).items ? widget : widget.data;
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .filter((it: any) => it && typeof it.url === 'string' && it.url)
    .map((it: any) => ({ ...it, video_id: youtubeIdOf(it.url, it.video_id) }));
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_URL = /(?:[?&]v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;

/** The 11-character YouTube id, from the URL first. A payload's own
 *  `video_id` counts only when it IS such an id: the backend's first gallery
 *  carried the corpus filename there ("… [OhwW_MqgTPk].youtube"), which drew
 *  grey stills and a dead player. */
export function youtubeIdOf(url: string, videoId?: string | null): string | null {
  const m = YT_URL.exec(url || '');
  if (m) return m[1];
  if (videoId && YT_ID.test(videoId)) return videoId;
  const f = /\[([A-Za-z0-9_-]{11})\]\.youtube$/.exec(videoId || '');
  return f ? f[1] : null;
}

/** Whether a message carries a sources gallery, in its ordered blocks or in
 *  the legacy flat widget list. */
export function hasSourcesWidget(
  blocks?: ContentBlock[] | null,
  widgets?: Widget[] | null,
): boolean {
  if (blocks?.some((b) => b.type === 'widget' && sourceCardsOf(b.widget).length > 0)) return true;
  return Boolean(widgets?.some((w) => sourceCardsOf(w).length > 0));
}

// "---" (any rule length), then **Sources:** (bold optional, colon optional),
// then the bullet list. Whatever follows the list — the disclaimer line —
// stays. Anchored to a line start so a "Sources" word in prose is untouched.
const FOOTER = /\n*^[ \t]*(?:-{3,}|\*{3,}|_{3,})?[ \t]*\n+[ \t]*\**Sources:?\**[ \t]*\n(?:[ \t]*[-*] .*(?:\n|$))+/m;

/** The answer without its Sources list. Text with no footer comes back as
 *  it was. */
export function stripSourcesFooter(text: string): string {
  if (!text || !/Sources/.test(text)) return text;
  const out = text.replace(FOOTER, '\n');
  return out === text ? text : out.replace(/\n{3,}/g, '\n\n').trimEnd();
}

/** Strip the footer from every text block when the same message carries the
 *  gallery; blocks come back untouched (same array) otherwise. */
export function hideFooterWhenGallery(blocks: ContentBlock[]): ContentBlock[] {
  if (!hasSourcesWidget(blocks)) return blocks;
  let changed = false;
  const out = blocks.map((b) => {
    if (b.type !== 'text') return b;
    const content = stripSourcesFooter(b.content);
    if (content === b.content) return b;
    changed = true;
    return { type: 'text' as const, content };
  });
  return changed ? out : blocks;
}

/** YouTube's own still for a video id — a public image, no auth. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** "12:34" for a moment in seconds; "" for none. */
export function formatMoment(t?: number | null): string {
  if (t == null || !Number.isFinite(t) || t < 0) return '';
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "2.47" for a card that names a verse, "Ch. 2" for a chapter-only one,
 *  "" otherwise. */
export function verseLabel(card: SourceCard): string {
  const ch = (card.chapter || '').toString().trim();
  const v = (card.verse || '').toString().trim();
  if (ch && v) return `${ch}.${v}`;
  if (ch) return `Ch. ${ch}`;
  return '';
}

/** The line under a card's title that says WHERE the moment lives: the
 *  shloka and the talk ("2.47 · Ch 2 · Talk 29"), the talk alone, or "". */
export function whereLabel(card: SourceCard): string {
  const verse = verseLabel(card);
  const talk = (card.talk || '').trim();
  return [verse, talk].filter(Boolean).join(' · ');
}

/** The caption for a video embedded in the answer's body: the link text the
 *  writer chose, then the shloka and the talk when a source card matches the
 *  video (and, when several moments of one talk are cited, the nearest). */
export function captionFor(title: string, url: string, cards: SourceCard[] | undefined): string {
  if (!cards || cards.length === 0) return title;
  const id = youtubeIdOf(url, null);
  if (!id) return title;
  const t = Number((/[?&#]t=(\d+)/.exec(url) || [])[1] ?? NaN);
  const same = cards.filter((c) => c.video_id === id);
  if (same.length === 0) return title;
  const best = Number.isFinite(t)
    ? same.reduce((a, b) => (Math.abs((b.t ?? 0) - t) < Math.abs((a.t ?? 0) - t) ? b : a))
    : same[0];
  const where = whereLabel(best);
  if (!where) return title;
  return title.includes(where) ? title : `${title} · ${where}`;
}
