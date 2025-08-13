import React from 'react';
import { View, Text, Image } from 'react-native';
import { MessageFile } from '@wealthwise/types';

interface FileRendererProps {
  file: MessageFile;
}

export function FileRenderer({ file }: FileRendererProps) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const isText = file.type.startsWith('text/');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (isImage) return '🖼️';
    if (isPdf) return '📄';
    if (isText) return '📝';
    return '📎';
  };

  return (
    <View className="flex-row items-center space-x-2">
      <Text className="text-lg">{getFileIcon()}</Text>
      
      <View className="flex-1">
        <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
          {file.name}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {formatFileSize(file.size || 0)}
        </Text>
      </View>

      {isImage && file.url && (
        <Image
          source={{ uri: file.url }}
          className="w-12 h-12 rounded-md"
          resizeMode="cover"
        />
      )}
    </View>
  );
}
