'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => (
  <ScrollArea className="w-full overflow-x-auto whitespace-nowrap hidden sm:block" {...props}>
    <div className={cn('flex w-max flex-nowrap items-center gap-2', className)}>
      {children}
    </div>
    <ScrollBar className="hidden" orientation="horizontal" />
  </ScrollArea>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = 'outline',
  size = 'sm',
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    console.log('[Suggestion] Tile clicked:', suggestion);
    console.log('[Suggestion] Calling onClick callback...');
    onClick?.(suggestion);
    console.log('[Suggestion] onClick callback completed');
  };

  return (
    <Button
      className={cn('cursor-pointer rounded-full px-4', className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};

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

export function SuggestionTiles({ tiles, onSuggestionClick, disabled = false }: SuggestionTilesProps) {
  return (
    <Suggestions>
      {tiles.map((tile) => (
        <Suggestion
          key={tile.id}
          suggestion={tile.title}
          onClick={(title) => onSuggestionClick(title, tile.useMockService)}
          disabled={disabled}
        >
          {tile.title}
        </Suggestion>
      ))}
    </Suggestions>
  );
}