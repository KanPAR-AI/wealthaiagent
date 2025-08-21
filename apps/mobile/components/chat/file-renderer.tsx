import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MessageFile } from '@wealthwise/types';

interface FileRendererProps {
  file: MessageFile;
  onFileClick?: (file: MessageFile) => void;
}

export function FileRenderer({ file, onFileClick }: FileRendererProps) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const isText = file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml');

  const getFileIcon = () => {
    if (isImage) return '🖼️';
    if (isPdf) return '📄';
    if (isText) return '📝';
    return '📎';
  };

  const getFileSize = () => {
    if (file.size < 1024) return `${file.size} B`;
    if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
    return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileClick = () => {
    if (onFileClick) {
      onFileClick(file);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleFileClick}
      className="flex-row items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
    >
      {/* File icon */}
      <Text className="text-2xl mr-3">{getFileIcon()}</Text>

      {/* File info */}
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900 mb-1" numberOfLines={1}>
          {file.name}
        </Text>
        <Text className="text-xs text-gray-500">
          {getFileSize()} • {file.type}
        </Text>
      </View>

      {/* Preview for images */}
      {isImage && file.content && (
        <View className="ml-3">
          <Image
            source={{ uri: `data:${file.type};base64,${file.content}` }}
            className="w-12 h-12 rounded-lg"
            resizeMode="cover"
          />
        </View>
      )}
    </TouchableOpacity>
  );
}
