import React from 'react';
import { View, Text } from 'react-native';

export function AiLoadingIndicator() {
  return (
    <View className="flex-row items-center space-x-3 p-4 bg-muted rounded-lg">
      <View className="flex-row space-x-1">
        <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
        <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </View>
      <Text className="text-muted-foreground text-sm">AI is thinking...</Text>
    </View>
  );
}
