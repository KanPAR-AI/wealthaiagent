import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { ChatBubble } from './chat-bubble';
import { Message } from '@wealthwise/types';

interface MessageListProps {
  messages: Message[];
  onCopy: (messageId: string) => void;
  onLike: (messageId: string) => void;
  onDislike: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  isRegenerating: boolean;
}

export function MessageList({
  messages,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
  isRegenerating
}: MessageListProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // TODO: Implement refresh logic
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScrollView
      className="flex-1 px-4 pt-4"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#3B82F6']}
          tintColor="#3B82F6"
        />
      }
    >
      <View className="space-y-4">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onCopy={() => onCopy(message.id)}
            onLike={() => onLike(message.id)}
            onDislike={() => onDislike(message.id)}
            onRegenerate={() => onRegenerate(message.id)}
            isRegenerating={isRegenerating}
          />
        ))}
      </View>
      
      {/* Bottom spacing for input */}
      <View className="h-20" />
    </ScrollView>
  );
}
