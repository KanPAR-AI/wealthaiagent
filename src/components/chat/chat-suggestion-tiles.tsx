'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SuggestionTileData {
  id: number;
  title: string;
  description: string;
  useMockService?: boolean; // Optional flag to use mock SSE service
}

interface SuggestionTilesProps {
  tiles: SuggestionTileData[];
  onSuggestionClick: (title: string, useMockService?: boolean) => void;
  disabled?: boolean;
}

// Campaign tile titles often end in an emoji ("Read my palm 🔮"). On the
// mobile cards we lift it out as a glyph; the full title (emoji included)
// is still what gets sent as the chat message.
const TRAILING_EMOJI =
  /\s*(\p{Extended_Pictographic}(?:[\u{FE0F}\u{200D}]|\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*$/u;

function splitTrailingEmoji(title: string): { text: string; emoji: string | null } {
  const match = title.match(TRAILING_EMOJI);
  if (!match || match[1] === title.trim()) return { text: title, emoji: null };
  return { text: title.slice(0, match.index).trimEnd(), emoji: match[1] };
}

function MobileTileCard({
  tile,
  index,
  disabled,
  onClick,
}: {
  tile: SuggestionTileData;
  index: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const { text, emoji } = splitTrailingEmoji(tile.title);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ animationDelay: `${index * 70}ms` }}
      className={cn(
        'group flex h-full flex-col items-start gap-2 rounded-2xl border border-border/50 bg-secondary/40 p-3 text-left',
        'transition-all duration-200 hover:border-border hover:bg-accent/60 active:scale-[0.97]',
        'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500',
      )}
    >
      {emoji && (
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-background/80 text-base ring-1 ring-border/40 transition-transform duration-200 group-active:scale-110"
        >
          {emoji}
        </span>
      )}
      <span className="line-clamp-3 text-[13px] font-medium leading-snug text-foreground/90">
        {text}
      </span>
    </button>
  );
}

export function SuggestionTiles({ tiles, onSuggestionClick, disabled = false }: SuggestionTilesProps) {
  return (
    <>
      {/* Mobile: 2x2 grid of card tiles — emoji lifted out as a glyph, text
          left-aligned and clamped so all four tiles read as one set. */}
      <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
        {tiles.map((tile, index) => (
          <MobileTileCard
            key={tile.id}
            tile={tile}
            index={index}
            disabled={disabled}
            onClick={() => onSuggestionClick(tile.title, tile.useMockService)}
          />
        ))}
      </div>
      {/* ≥640px: horizontal scroll row of single-line pills. */}
      <ScrollArea className="hidden w-full overflow-x-auto whitespace-nowrap sm:block">
        <div className="flex w-max flex-nowrap items-center gap-2">
          {tiles.map((tile) => (
            <Button
              key={tile.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="cursor-pointer rounded-full px-4"
              onClick={() => onSuggestionClick(tile.title, tile.useMockService)}
            >
              {tile.title}
            </Button>
          ))}
        </div>
        <ScrollBar className="hidden" orientation="horizontal" />
      </ScrollArea>
    </>
  );
}
