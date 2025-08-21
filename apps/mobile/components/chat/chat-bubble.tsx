import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, FileText, Image } from '@expo/vector-icons';
import { Message, MessageFile } from '@wealthwise/types';
import { FileRenderer } from './file-renderer';
import { MessageActions } from './message-actions';

interface ChatBubbleProps {
  message: Message;
  onCopy: () => void;
  onLike: () => void;
  onDislike: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function ChatBubble({
  message,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
  isRegenerating
}: ChatBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const isUser = message.sender === 'user';

  const handleCopy = () => {
    onCopy();
    Alert.alert('Copied!', 'Message copied to clipboard');
  };

  const handleFileClick = (file: MessageFile) => {
    // TODO: Implement file preview modal
    Alert.alert('File Preview', `Opening ${file.name}`);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image size={16} color="#6B7280" />;
    }
    return <FileText size={16} color="#6B7280" />;
  };

  return (
    <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-500 rounded-br-md'
            : 'bg-white border border-gray-200 rounded-bl-md'
        }`}
      >
        {/* Message text */}
        {message.message && (
          <Text
            className={`text-base leading-6 ${
              isUser ? 'text-white' : 'text-gray-900'
            }`}
          >
            {message.message}
          </Text>
        )}

        {/* Files */}
        {message.files && message.files.length > 0 && (
          <View className="mt-3 space-y-2">
            {message.files.map((file, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleFileClick(file)}
                className={`flex-row items-center p-2 rounded-lg ${
                  isUser ? 'bg-blue-400' : 'bg-gray-100'
                }`}
              >
                {getFileIcon(file.type)}
                <Text
                  className={`ml-2 text-sm flex-1 ${
                    isUser ? 'text-white' : 'text-gray-700'
                  }`}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <Text
                  className={`text-xs ${
                    isUser ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {(file.size / 1024).toFixed(1)} KB
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timestamp */}
        <Text
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {/* Message actions */}
        {!isUser && (
          <MessageActions
            message={message}
            onCopy={handleCopy}
            onLike={onLike}
            onDislike={onDislike}
            onRegenerate={onRegenerate}
            isRegenerating={isRegenerating}
            showActions={showActions}
            onToggleActions={() => setShowActions(!showActions)}
          />
        )}
      </View>
    </View>
  );
}
