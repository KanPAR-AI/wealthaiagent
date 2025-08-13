import React from 'react';
import { View, ScrollView } from 'react-native';
import { Message, MessageFile } from '@wealthwise/types';
import { ChatBubble } from './chat-bubble';

interface ChatMessageListProps {
  messages: Message[];
  currentUser?: {
    firstName?: string;
    imageUrl?: string;
  };
  onFileClick?: (file: MessageFile) => void;
  onCopy?: (messageId: string) => void;
  onLike?: (messageId: string) => void;
  onDislike?: (messageId: string) => void;
  onRegenerate?: () => void;
}

export function ChatMessageList({
  messages,
  currentUser,
  onFileClick,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
}: ChatMessageListProps) {
  return (
    <ScrollView 
      className="space-y-6"
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <ChatBubble
          key={message.id}
          message={message}
          currentUser={currentUser}
          onFileClick={onFileClick}
          onCopy={onCopy}
          onLike={onLike}
          onDislike={onDislike}
          onRegenerate={onRegenerate}
        />
      ))}
    </ScrollView>
  );
}
