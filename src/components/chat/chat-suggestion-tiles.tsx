import { JSX } from "react";

interface SuggestionTileData {
  id: number;
  title: string;
  description: string;
}

interface SuggestionTilesProps {
  tiles: SuggestionTileData[];
  onSuggestionClick: (title: string) => void;
  disabled?: boolean;
}

export function SuggestionTiles({ tiles, onSuggestionClick, disabled = false }: SuggestionTilesProps): JSX.Element {
  return (
    <div className="flex flex-col space-y-2 mb-4">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          onClick={() => onSuggestionClick(tile.title)}
          disabled={disabled}
          className="text-left text-foreground dark:text-zinc-200 hover:text-foreground/80 dark:hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:pointer-events-none py-1 border-b border-border/50"
        >
          {tile.title}
        </button>
      ))}
    </div>
  );
}