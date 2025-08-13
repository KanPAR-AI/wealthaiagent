import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Message, MessageFile } from '@wealthwise/types';
import { FileRenderer } from './file-renderer';
import { MessageActions } from './message-actions';

interface ChatBubbleProps {
  message: Message;
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

export function ChatBubble({
  message,
  currentUser,
  onFileClick,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
}: ChatBubbleProps) {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';

  return (
    <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        {!isUser && (
          <View className="w-8 h-8 rounded-full bg-primary mb-2 items-center justify-center">
            <Text className="text-primary-foreground text-sm font-medium">AI</Text>
          </View>
        )}

        {/* Message Content */}
        <View
          className={`rounded-lg p-4 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          }`}
        >
          {/* Message Text */}
          <Text
            className={`text-base ${
              isUser ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {message.message}
          </Text>

          {/* Files */}
          {message.files && message.files.length > 0 && (
            <View className="mt-3 space-y-2">
              {message.files.map((file, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => onFileClick?.(file)}
                  className="bg-background/50 rounded-md p-2"
                >
                  <FileRenderer file={file} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Error State */}
          {message.error && (
            <View className="mt-2 p-2 bg-destructive/10 rounded-md">
              <Text className="text-destructive text-sm">{message.error}</Text>
            </View>
          )}

          {/* Loading State */}
          {message.isStreaming && (
            <View className="mt-2 flex-row items-center">
              <View className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse mr-2" />
              <Text className="text-muted-foreground text-sm">AI is typing...</Text>
            </View>
          )}
        </View>

        {/* Message Actions */}
        {isBot && (
          <MessageActions
            messageId={message.id}
            onCopy={onCopy}
            onLike={onLike}
            onDislike={onDislike}
            onRegenerate={onRegenerate}
          />
        )}
      </View>

      {/* User Avatar */}
      {isUser && currentUser && (
        <View className="order-1 ml-2">
          {currentUser.imageUrl ? (
            <Image
              source={{ uri: currentUser.imageUrl }}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center">
              <Text className="text-secondary-foreground text-sm font-medium">
                {currentUser.firstName?.[0] || 'U'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
