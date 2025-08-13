import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';

interface MessageActionsProps {
  messageId: string;
  onCopy?: (messageId: string) => void;
  onLike?: (messageId: string) => void;
  onDislike?: (messageId: string) => void;
  onRegenerate?: () => void;
}

export function MessageActions({
  messageId,
  onCopy,
  onLike,
  onDislike,
  onRegenerate,
}: MessageActionsProps) {
  return (
    <View className="flex-row items-center space-x-4 mt-2">
      <TouchableOpacity
        onPress={() => onCopy?.(messageId)}
        className="flex-row items-center space-x-1"
      >
        <Text className="text-muted-foreground text-sm">📋</Text>
        <Text className="text-muted-foreground text-xs">Copy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onRegenerate?.()}
        className="flex-row items-center space-x-1"
      >
        <Text className="text-muted-foreground text-sm">🔄</Text>
        <Text className="text-muted-foreground text-xs">Regenerate</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onLike?.(messageId)}
        className="flex-row items-center space-x-1"
      >
        <Text className="text-muted-foreground text-sm">👍</Text>
        <Text className="text-muted-foreground text-xs">Like</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onDislike?.(messageId)}
        className="flex-row items-center space-x-1"
      >
        <Text className="text-muted-foreground text-sm">👎</Text>
        <Text className="text-muted-foreground text-xs">Dislike</Text>
      </TouchableOpacity>
    </View>
  );
}
