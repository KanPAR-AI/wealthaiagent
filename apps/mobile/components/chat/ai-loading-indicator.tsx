import React from 'react';
import { View, Text } from 'react-native';
import { ActivityIndicator } from 'react-native';

export function AiLoadingIndicator() {
  return (
    <View className="flex-row items-center justify-center p-4 bg-white border-t border-gray-200">
      <ActivityIndicator size="small" color="#3B82F6" />
      <Text className="text-gray-600 text-sm ml-3">
        AI is thinking...
      </Text>
    </View>
  );
}
