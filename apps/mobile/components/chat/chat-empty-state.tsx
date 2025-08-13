import React from 'react';
import { View, Text } from 'react-native';

interface ChatEmptyStateProps {
  isFirstMessage?: boolean;
  isSignedIn?: boolean;
  userName?: string;
}

export function ChatEmptyState({
  isFirstMessage = false,
  isSignedIn = false,
  userName,
}: ChatEmptyStateProps) {
  if (!isSignedIn) {
    return (
      <View className="items-center space-y-4">
        <Text className="text-4xl">🤖</Text>
        <View className="text-center space-y-2">
          <Text className="text-2xl font-bold text-foreground">
            Welcome to YourFinAdvisor
          </Text>
          <Text className="text-muted-foreground text-base">
            Sign in to start chatting with your AI financial advisor
          </Text>
        </View>
      </View>
    );
  }

  if (isFirstMessage) {
    return (
      <View className="items-center space-y-4">
        <Text className="text-4xl">🎉</Text>
        <View className="text-center space-y-2">
          <Text className="text-2xl font-bold text-foreground">
            Welcome back, {userName || 'there'}!
          </Text>
          <Text className="text-muted-foreground text-base">
            Start a new conversation with your AI financial advisor
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="items-center space-y-4">
      <Text className="text-4xl">💬</Text>
      <View className="text-center space-y-2">
        <Text className="text-2xl font-bold text-foreground">
          Start a conversation
        </Text>
        <Text className="text-muted-foreground text-base">
          Ask me anything about your finances, investments, or financial planning
        </Text>
      </View>
    </View>
  );
}
