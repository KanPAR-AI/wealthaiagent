import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { Paperclip, Mic, MicOff, Send, Square } from '@expo/vector-icons';
import { MessageFile } from '@wealthwise/types';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface PromptInputProps {
  onSubmit: (text: string, attachments: MessageFile[]) => void;
  isLoading?: boolean;
}

export function PromptInput({ onSubmit, isLoading = false }: PromptInputProps) {
  const [input, setInput] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<MessageFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  const inputRef = useRef<TextInput>(null);

  // Effect to clear input and uploaded files when not busy
  useEffect(() => {
    if (!isLoading) {
      setInput('');
      setUploadedFiles([]);
    }
  }, [isLoading]);

  // Handles submitting the message (text and/or files)
  const handleSubmitInternal = (): void => {
    if (input.trim() || uploadedFiles.length > 0) {
      onSubmit(input.trim(), uploadedFiles);
    }
  };

  // Handles keyboard events, specifically Enter for submission
  const handleKeyPress = (event: any): void => {
    if (event.nativeEvent.key === 'Enter' && !isLoading) {
      handleSubmitInternal();
    }
  };

  // File upload handling
  const handleFileUpload = async (): Promise<void> => {
    try {
      setIsUploading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: MessageFile[] = [];
        
        for (const asset of result.assets) {
          if (asset.uri) {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            if (fileInfo.exists) {
              const fileContent = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              newFiles.push({
                name: asset.name || 'Unknown file',
                content: fileContent,
                type: asset.mimeType || 'application/octet-stream',
                size: fileInfo.size || 0,
              });
            }
          }
        }
        
        setUploadedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      Alert.alert('Error', 'Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Image picker handling
  const handleImagePicker = async (): Promise<void> => {
    try {
      setIsUploading(true);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: MessageFile[] = [];
        
        for (const asset of result.assets) {
          if (asset.base64) {
            newFiles.push({
              name: asset.fileName || 'image.jpg',
              content: asset.base64,
              type: 'image/jpeg',
              size: asset.base64.length * 0.75, // Approximate size
            });
          }
        }
        
        setUploadedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Voice recording functions (placeholder for now)
  const startRecording = async (): Promise<void> => {
    try {
      // TODO: Implement voice recording with expo-av
      Alert.alert('Voice Recording', 'Voice recording feature coming soon!');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = (): void => {
    setIsRecording(false);
    // TODO: Implement stop recording
  };

  // Remove file from uploaded files
  const removeFile = (index: number): void => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <View className="bg-white border-t border-gray-200 p-4">
      {/* File attachments display */}
      {uploadedFiles.length > 0 && (
        <View className="flex-row flex-wrap mb-3">
          {uploadedFiles.map((file, index) => (
            <View key={index} className="bg-blue-100 rounded-lg px-3 py-2 mr-2 mb-2 flex-row items-center">
              <Text className="text-blue-800 text-sm mr-2 flex-1" numberOfLines={1}>
                {file.name}
              </Text>
              <TouchableOpacity
                onPress={() => removeFile(index)}
                className="ml-2"
              >
                <Text className="text-blue-600 text-lg">×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input area */}
      <View className="flex-row items-end space-x-2">
        {/* File upload button */}
        <TouchableOpacity
          onPress={handleFileUpload}
          disabled={isUploading}
          className="p-2 rounded-lg bg-gray-100"
        >
          <Paperclip size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Image picker button */}
        <TouchableOpacity
          onPress={handleImagePicker}
          disabled={isUploading}
          className="p-2 rounded-lg bg-gray-100"
        >
          <Text className="text-gray-600 text-lg">📷</Text>
        </TouchableOpacity>

        {/* Voice recording button */}
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          className={`p-2 rounded-lg ${isRecording ? 'bg-red-100' : 'bg-gray-100'}`}
        >
          {isRecording ? (
            <Square size={20} color="#EF4444" />
          ) : (
            <Mic size={20} color="#6B7280" />
          )}
        </TouchableOpacity>

        {/* Text input */}
        <View className="flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            multiline
            maxLength={1000}
            className="text-gray-900 text-base"
            style={{ minHeight: 20, maxHeight: 100 }}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSubmitInternal}
          disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
          className={`p-2 rounded-lg ${
            isLoading || (!input.trim() && uploadedFiles.length === 0)
              ? 'bg-gray-300'
              : 'bg-blue-500'
          }`}
        >
          <Send 
            size={20} 
            color={
              isLoading || (!input.trim() && uploadedFiles.length === 0)
                ? '#9CA3AF'
                : '#FFFFFF'
            } 
          />
        </TouchableOpacity>
      </View>

      {/* Upload status */}
      {isUploading && (
        <View className="mt-2">
          <Text className="text-gray-500 text-sm text-center">Uploading files...</Text>
        </View>
      )}

      {/* Recording status */}
      {isRecording && (
        <View className="mt-2">
          <Text className="text-red-500 text-sm text-center">Recording... Tap to stop</Text>
        </View>
      )}
    </View>
  );
}
