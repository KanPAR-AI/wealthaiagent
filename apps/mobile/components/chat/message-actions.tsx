import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, MoreHorizontal } from '@expo/vector-icons';
import { Message } from '@wealthwise/types';

interface MessageActionsProps {
  message: Message;
  onCopy: () => void;
  onLike: () => void;
  onDislike: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  showActions: boolean;
  onToggleActions: () => void;
}

export function MessageActions({
  message,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
  isRegenerating,
  showActions,
  onToggleActions
}: MessageActionsProps) {
  return (
    <View className="mt-3">
      {/* Main action buttons */}
      <View className="flex-row items-center space-x-2">
        <TouchableOpacity
          onPress={onCopy}
          className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg"
        >
          <Copy size={16} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-1">Copy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onLike}
          className={`flex-row items-center px-3 py-2 rounded-lg ${
            message.liked ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <ThumbsUp 
            size={16} 
            color={message.liked ? '#059669' : '#6B7280'} 
          />
          <Text 
            className={`text-sm ml-1 ${
              message.liked ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            {message.liked ? 'Liked' : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDislike}
          className={`flex-row items-center px-3 py-2 rounded-lg ${
            message.disliked ? 'bg-red-100' : 'bg-gray-100'
          }`}
        >
          <ThumbsDown 
            size={16} 
            color={message.disliked ? '#DC2626' : '#6B7280'} 
          />
          <Text 
            className={`text-sm ml-1 ${
              message.disliked ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {message.disliked ? 'Disliked' : 'Dislike'}
          </Text>
        </TouchableOpacity>

        {/* More actions toggle */}
        <TouchableOpacity
          onPress={onToggleActions}
          className="p-2 bg-gray-100 rounded-lg"
        >
          <MoreHorizontal size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Extended actions */}
      {showActions && (
        <View className="mt-2 flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={onRegenerate}
            disabled={isRegenerating}
            className={`flex-row items-center px-3 py-2 rounded-lg ${
              isRegenerating ? 'bg-gray-200' : 'bg-blue-100'
            }`}
          >
            <RefreshCw 
              size={16} 
              color={isRegenerating ? '#9CA3AF' : '#3B82F6'} 
            />
            <Text 
              className={`text-sm ml-1 ${
                isRegenerating ? 'text-gray-500' : 'text-blue-600'
              }`}
            >
              {isRegenerating ? 'Regenerating...' : 'Regenerate'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
