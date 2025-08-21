import React from 'react';
import { View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function ChatLoadingSkeleton() {
  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        {/* Header skeleton */}
        <View className="items-center py-8">
          <View className="w-16 h-16 bg-gray-200 rounded-full mb-4" />
          <View className="w-48 h-6 bg-gray-200 rounded mb-2" />
          <View className="w-64 h-4 bg-gray-200 rounded" />
        </View>

        {/* Message skeletons */}
        <View className="space-y-4">
          {/* User message skeleton */}
          <View className="flex-row justify-end">
            <View className="max-w-[70%] bg-gray-200 rounded-2xl rounded-br-md px-4 py-3">
              <View className="w-32 h-4 bg-gray-300 rounded mb-2" />
              <View className="w-24 h-3 bg-gray-300 rounded" />
            </View>
          </View>

          {/* AI message skeleton */}
          <View className="flex-row justify-start">
            <View className="max-w-[70%] bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <View className="w-40 h-4 bg-gray-200 rounded mb-2" />
              <View className="w-36 h-4 bg-gray-200 rounded mb-2" />
              <View className="w-28 h-4 bg-gray-200 rounded" />
            </View>
          </View>

          {/* Another user message skeleton */}
          <View className="flex-row justify-end">
            <View className="max-w-[70%] bg-gray-200 rounded-2xl rounded-br-md px-4 py-3">
              <View className="w-28 h-4 bg-gray-300 rounded" />
            </View>
          </View>

          {/* Another AI message skeleton */}
          <View className="flex-row justify-start">
            <View className="max-w-[70%] bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <View className="w-44 h-4 bg-gray-200 rounded mb-2" />
              <View className="w-32 h-4 bg-gray-200 rounded" />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Input skeleton */}
      <View className="bg-white border-t border-gray-200 p-4">
        <View className="flex-row items-center space-x-2">
          <View className="w-10 h-10 bg-gray-200 rounded-lg" />
          <View className="w-10 h-10 bg-gray-200 rounded-lg" />
          <View className="w-10 h-10 bg-gray-200 rounded-lg" />
          <View className="flex-1 h-10 bg-gray-200 rounded-lg" />
          <View className="w-10 h-10 bg-gray-200 rounded-lg" />
        </View>
      </View>
    </View>
  );
}
