import React from 'react';
import { View } from 'react-native';

export function ChatLoadingSkeleton() {
  return (
    <View className="space-y-6">
      {/* Skeleton for 3 messages */}
      {[1, 2, 3].map((index) => (
        <View key={index} className="space-y-4">
          {/* User message skeleton */}
          <View className="flex-row justify-end">
            <View className="max-w-[80%]">
              <View className="bg-muted rounded-lg p-4">
                <View className="h-4 bg-muted-foreground/20 rounded w-32" />
              </View>
            </View>
          </View>

          {/* AI message skeleton */}
          <View className="flex-row justify-start">
            <View className="max-w-[80%]">
              <View className="bg-muted rounded-lg p-4 space-y-2">
                <View className="h-4 bg-muted-foreground/20 rounded w-full" />
                <View className="h-4 bg-muted-foreground/20 rounded w-3/4" />
                <View className="h-4 bg-muted-foreground/20 rounded w-1/2" />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
