import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MessageFile } from '@wealthwise/types';

interface PromptInputProps {
  onSubmit: (text: string, attachments: MessageFile[]) => void;
  isLoading?: boolean;
}

export function PromptInput({ onSubmit, isLoading = false }: PromptInputProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageFile[]>([]);

  const handleSubmit = () => {
    if (!text.trim() && attachments.length === 0) {
      return;
    }

    if (isLoading) {
      return;
    }

    onSubmit(text, attachments);
    setText('');
    setAttachments([]);
  };

  const handleAttachFile = () => {
    // TODO: Implement file attachment for mobile
    Alert.alert('File Attachment', 'File attachment will be implemented soon');
  };

  const isSubmitDisabled = (!text.trim() && attachments.length === 0) || isLoading;

  return (
    <View className="flex-row items-end space-x-2 bg-background rounded-lg border border-border p-2">
      <TouchableOpacity
        onPress={handleAttachFile}
        disabled={isLoading}
        className="p-2 rounded-md bg-muted"
      >
        <Text className="text-muted-foreground text-lg">📎</Text>
      </TouchableOpacity>

      <View className="flex-1">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type your message..."
          placeholderTextColor="#6B7280"
          multiline
          maxLength={4000}
          editable={!isLoading}
          className="text-foreground text-base min-h-[40px] max-h-[120px] px-3 py-2"
          style={{
            textAlignVertical: 'center',
          }}
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
        className={`p-2 rounded-md ${
          isSubmitDisabled 
            ? 'bg-muted' 
            : 'bg-primary'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text className={`text-lg ${
            isSubmitDisabled 
              ? 'text-muted-foreground' 
              : 'text-primary-foreground'
          }`}>
            ➤
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
