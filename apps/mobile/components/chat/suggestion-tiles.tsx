import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SuggestionTileData } from '@wealthwise/types';

interface SuggestionTilesProps {
  tiles: SuggestionTileData[];
  onSuggestionClick: (title: string) => void;
  disabled?: boolean;
}

export function SuggestionTiles({
  tiles,
  onSuggestionClick,
  disabled = false,
}: SuggestionTilesProps) {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      className="space-x-3"
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {tiles.map((tile) => (
        <TouchableOpacity
          key={tile.id}
          onPress={() => !disabled && onSuggestionClick(tile.title)}
          disabled={disabled}
          className={`min-w-[200px] p-4 rounded-lg border ${
            disabled
              ? 'bg-muted border-muted'
              : 'bg-background border-border active:bg-muted'
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              disabled ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {tile.title}
          </Text>
          <Text
            className={`text-xs mt-1 ${
              disabled ? 'text-muted-foreground' : 'text-muted-foreground'
            }`}
          >
            {tile.description}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
