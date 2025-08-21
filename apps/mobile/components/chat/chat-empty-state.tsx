import React from 'react';
import { View, Text } from 'react-native';

export function ChatEmptyState() {
  return (
    <View className="items-center py-10">
      <Text className="text-6xl mb-4">🤖</Text>
      <Text className="text-2xl font-bold text-gray-800 mb-3 text-center">
        Welcome to YourFinAdvisor
      </Text>
      <Text className="text-base text-gray-600 text-center leading-6 max-w-sm">
        Your AI financial advisor is ready to help you with personalized financial advice, investment strategies, and financial planning.
      </Text>
      
      <View className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
        <Text className="text-sm text-blue-800 text-center">
          💡 Start by asking me about your finances, investments, or financial goals
        </Text>
      </View>
    </View>
  );
}
