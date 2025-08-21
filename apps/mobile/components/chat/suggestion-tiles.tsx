import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SuggestionTileData } from '@wealthwise/types';

interface SuggestionTilesProps {
  suggestions: SuggestionTileData[];
  onSuggestionClick: (suggestion: SuggestionTileData) => void;
}

export function SuggestionTiles({ suggestions, onSuggestionClick }: SuggestionTilesProps) {
  return (
    <View className="w-full mt-6">
      <Text className="text-lg font-semibold text-gray-700 mb-4 text-center">
        Quick Start Suggestions
      </Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        className="flex-row space-x-3"
      >
        {suggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            onPress={() => onSuggestionClick(suggestion)}
            className="bg-white border border-gray-200 rounded-xl p-4 min-w-[200] shadow-sm"
            style={{ minWidth: 200 }}
          >
            <Text className="text-base font-medium text-gray-800 mb-2">
              {suggestion.title}
            </Text>
            <Text className="text-sm text-gray-600 leading-5">
              {suggestion.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
