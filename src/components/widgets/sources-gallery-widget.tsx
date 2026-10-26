'use client';

import { useState } from 'react';
import {
  formatMoment,
  sourceCardsOf,
  verseLabel,
  whereLabel,
  youtubeThumbnail,
  type SourceCard,
  type Widget,
} from '@wealthai/core';

/**
 * The Sources footer as a horizontal gallery (bug 6c329647).
 *
 * One card per cited moment — YouTube's still, the verse, the timestamp, the
 * title — in a snap-scrolling row, so twenty sources take one row instead of
 * twenty stacked players. Tapping a card opens ONE player under the row at
 * the cited moment; tapping another swaps it. A card with no video id opens
 * its link in a new tab. The markdown list this replaces is hidden by the
 * bubble when this widget is present (`hideFooterWhenGallery`).
 */
export function SourcesGalleryWidget({ widget }: { widget: Widget }) {
  const cards = sourceCardsOf(widget);
  const [active, setActive] = useState<SourceCard | null>(null);
  if (cards.length === 0) return null;

  const open = (card: SourceCard) => {
    if (card.video_id) {
      setActive((cur) => (cur && cur.url === card.url ? null : card));
    } else {
      window.open(card.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full min-w-0 sources-gallery" data-testid="sources-gallery">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sources
        </span>
        <span className="text-xs text-muted-foreground">{cards.length}</span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {cards.map((card) => {
          const verse = verseLabel(card);
          const at = formatMoment(card.t);
          const isActive = active?.url === card.url;
          return (
            <button
              key={card.url}
              type="button"
              onClick={() => open(card)}
              title={card.title}
              className={`snap-start shrink-0 w-44 text-left rounded-lg border bg-background overflow-hidden transition
                ${isActive ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60'}`}
            >
              <div className="relative aspect-video bg-muted">
                {card.video_id ? (
                  <img
                    src={youtubeThumbnail(card.video_id)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute left-1.5 bottom-1.5 flex gap-1">
                  {verse ? (
                    <span className="rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5 font-medium">
                      {verse}
                    </span>
                  ) : null}
                  {at ? (
                    <span className="rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5">
                      {at}
                    </span>
                  ) : null}
                </div>
                {card.video_id ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">
                      ▶
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="px-2 py-1.5 min-h-[2.5rem]">
                <div className="text-xs leading-snug line-clamp-2">{card.title}</div>
                {whereLabel(card) ? (
                  <div className="text-[10px] leading-snug text-muted-foreground mt-0.5 truncate">
                    {whereLabel(card)}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {active?.video_id ? (
        <div className="youtube-embed my-2">
          <iframe
            src={`https://www.youtube.com/embed/${active.video_id}?start=${active.t ?? 0}&rel=0&autoplay=1`}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className="youtube-embed-caption flex items-center justify-between gap-2">
            <a href={active.url} target="_blank" rel="noopener noreferrer">{active.title}</a>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Close player"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
