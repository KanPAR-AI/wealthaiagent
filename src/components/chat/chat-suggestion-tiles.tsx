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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          onClick={() => onSuggestionClick(tile.title)}
          disabled={disabled}
          className="p-3 text-left bg-background dark:bg-zinc-700 hover:bg-muted dark:hover:bg-zinc-600 rounded-lg border border-border transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <h3 className="font-medium text-sm text-foreground dark:text-zinc-200">{tile.title}</h3>
          <p className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">{tile.description}</p>
        </button>
      ))}
    </div>
  );
}