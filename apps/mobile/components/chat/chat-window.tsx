import React, { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useChatMessages } from '../../hooks/use-chat-messages';
import { useChatSession } from '../../hooks/use-chat-session';
import { useJwtTokenMobile } from '../../hooks/use-jwt-token-mobile';
import { useMessageActions } from '../../hooks/use-message-actions';
import { createChatSession, fetchChatHistory, listenToChatStream, sendChatMessage } from '../../services/chat-service';
import { useChatStore } from '../../store/chat';
import { ChatWindowProps, Message, MessageFile, SuggestionTileData } from '@wealthwise/types';
import { nanoid } from 'nanoid';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInput } from './prompt-input';
import { SuggestionTiles } from './suggestion-tiles';
import { MessageList } from './message-list';
import { ChatLoadingSkeleton } from './chat-loading-skeleton';

const suggestionTiles: SuggestionTileData[] = [
  { id: 1, title: "Show me sales data", description: "Generate content or brainstorm ideas" },
  { id: 2, title: "Analyze my user demographics", description: "Get assistance with any topic" },
  { id: 3, title: "Show me my product list", description: "Condense long documents" },
  { id: 4, title: "Code assistance", description: "Debug or create new code" }
];

export default function ChatWindow({
  chatId,
  className = ''
}: ChatWindowProps) {
  const { token, isLoadingToken, tokenError } = useJwtTokenMobile();
  
  console.log('ChatWindow - Token state:', { token, isLoadingToken, tokenError });
  
  const [selectedFile, setSelectedFile] = useState<MessageFile | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(!!chatId);

  const { isFirstMessage } = useChatSession(chatId);
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  
  const pendingMessage = useChatStore(state => state.pendingMessage);
  const clearPendingMessage = useChatStore(state => state.clearPendingMessage);

  const {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    isRegenerating
  } = useMessageActions(chatId || '');

  const [isSending, setIsSending] = useState(false);
  const [isNewChatInitiating, setIsNewChatInitiating] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const streamingControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  const [isProcessingPendingMessage, setIsProcessingPendingMessage] = useState(false);

  useEffect(() => {
    if (token && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current) {
      const { text, files } = pendingMessage;

      isProcessingRef.current = true;
      setIsProcessingPendingMessage(true);
      console.log("Processing pending message for new chat:", pendingMessage);

      clearPendingMessage();

      const userMessageId = nanoid();
      addMessage({
        id: userMessageId,
        message: text,
        sender: "user",
        files,
        timestamp: new Date().toISOString()
      });
      setLastUserMessageId(userMessageId);

      setIsSending(true);

      const aiMessageId = nanoid();
      addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

      const startListening = async () => {
        try {
          let receivedText = '';
          streamingControllerRef.current = new AbortController();

          await listenToChatStream(
            token,
            chatId,
            (chunk: string, type: string) => {
              if (type === 'text_chunk') {
                receivedText += chunk;
                updateMessage(aiMessageId, { message: receivedText });
              }
            },
            streamingControllerRef.current.signal
          );

          updateMessage(aiMessageId, { isStreaming: false });
          setIsSending(false);
          isProcessingRef.current = false;
          setIsProcessingPendingMessage(false);
        } catch (error) {
          console.error('Error in chat stream:', error);
          updateMessage(aiMessageId, { message: 'Sorry, I encountered an error. Please try again.', isStreaming: false });
          setIsSending(false);
          isProcessingRef.current = false;
          setIsProcessingPendingMessage(false);
        }
      };

      startListening();
    }
  }, [token, chatId, pendingMessage, addMessage, updateMessage, clearPendingMessage]);

  const handleSubmit = async (text: string, files: MessageFile[] = []) => {
    if (!token || !text.trim()) return;

    const userMessageId = nanoid();
    addMessage({
      id: userMessageId,
      message: text,
      sender: "user",
      files,
      timestamp: new Date().toISOString()
    });

    setLastUserMessageId(userMessageId);
    setIsSending(true);

    try {
      let currentChatId = chatId;
      
      if (!currentChatId) {
        setIsNewChatInitiating(true);
        const newChatId = await createChatSession(token);
        currentChatId = newChatId;
        setIsNewChatInitiating(false);
      }

      const aiMessageId = nanoid();
      addMessage({ 
        id: aiMessageId, 
        message: '', 
        sender: 'bot', 
        timestamp: new Date().toISOString(), 
        isStreaming: true 
      });

      await sendChatMessage(token, currentChatId, text, files);

      let receivedText = '';
      streamingControllerRef.current = new AbortController();

      await listenToChatStream(
        token,
        currentChatId,
        (chunk: string, type: string) => {
          if (type === 'text_chunk') {
            receivedText += chunk;
            updateMessage(aiMessageId, { message: receivedText });
          }
        },
        streamingControllerRef.current.signal
      );

      updateMessage(aiMessageId, { isStreaming: false });
      setIsSending(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsSending(false);
    }
  };

  if (isLoadingToken) {
    console.log('ChatWindow - Showing loading skeleton');
    return <ChatLoadingSkeleton />;
  }

  if (tokenError) {
    console.log('ChatWindow - Showing token error:', tokenError);
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center p-5">
        <Text className="text-red-600 text-center mb-4">Authentication error: {tokenError}</Text>
        <Text className="text-gray-600 text-center text-sm">
          Please check your internet connection and ensure the backend server is running.
        </Text>
        <Text className="text-gray-500 text-center text-xs mt-2">
          Backend URL: {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}
        </Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    console.log('ChatWindow - No token available');
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center p-5">
        <Text className="text-orange-600 text-center mb-4">No authentication token available</Text>
        <Text className="text-gray-600 text-center text-sm">
          The app is trying to connect to the backend server. Please wait...
        </Text>
        <Text className="text-gray-500 text-center text-xs mt-2">
          If this persists, check your network connection and backend server status.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1">
          {messages.length === 0 && !isSending ? (
            <>
              <View className="flex-1 justify-center items-center px-5">
                <ChatEmptyState />
                <SuggestionTiles 
                  suggestions={suggestionTiles}
                  onSuggestionClick={(suggestion) => handleSubmit(suggestion.title)}
                />
              </View>
            </>
          ) : (
            <MessageList 
              messages={messages}
              onCopy={handleCopy}
              onLike={handleLike}
              onDislike={handleDislike}
              onRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
            />
          )}
          
          {isSending && <AiLoadingIndicator />}
          
          <PromptInput 
            onSubmit={handleSubmit}
            isLoading={isSending || isNewChatInitiating}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}