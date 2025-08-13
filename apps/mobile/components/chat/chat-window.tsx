// import React, { useEffect, useRef, useState } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   SafeAreaView,
//   StatusBar,
//   KeyboardAvoidingView,
//   Platform,
// } from 'react-native';
// import { useUser } from '@clerk/clerk-react';
// import { nanoid } from 'nanoid';

// // Import shared types and hooks
// import { Message, MessageFile, SuggestionTileData } from '@wealthwise/types';
// import { useJwtTokenMobile } from '../../hooks/use-jwt-token-mobile';

// // Import mobile-specific components (we'll create these)
// import { ChatMessageList } from './message-list';
// import { ChatEmptyState } from './chat-empty-state';
// import { PromptInput } from './prompt-input';
// import { SuggestionTiles } from './suggestion-tiles';
// import { AiLoadingIndicator } from './ai-loading-indicator';
// import { ChatLoadingSkeleton } from './chat-loading-skeleton';

// // Import mobile-specific hooks and services (we'll create these)
// import { useChatMessages } from '../../hooks/use-chat-messages';
// import { useChatSession } from '../../hooks/use-chat-session';
// import { useMessageActions } from '../../hooks/use-message-actions';
// import { useChatStore } from '../../store/chat';
// import { createChatSession, fetchChatHistory, listenToChatStream, sendChatMessage } from '../../services/chat-service';

// const suggestionTiles: SuggestionTileData[] = [
//   { id: 1, title: "Show me sales data", description: "Generate content or brainstorm ideas" },
//   { id: 2, title: "Analyze my user demographics", description: "Get assistance with any topic" },
//   { id: 3, title: "Show me my product list", description: "Condense long documents" },
//   { id: 4, title: "Code assistance", description: "Debug or create new code" }
// ];

// interface ChatWindowProps {
//   chatId?: string;
//   className?: string;
// }

// export default function ChatWindow({
//   chatId,
//   className = ''
// }: ChatWindowProps) {
//   const { user, isSignedIn } = useUser();
//   const { token, isLoadingToken, tokenError } = useJwtTokenMobile();
//   const [selectedFile, setSelectedFile] = useState<MessageFile | null>(null);
//   const [isHistoryLoading, setIsHistoryLoading] = useState(!!chatId);

//   const { isFirstMessage } = useChatSession(chatId);
//   const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  
//   const pendingMessage = useChatStore(state => state.pendingMessage);
//   const clearPendingMessage = useChatStore(state => state.clearPendingMessage);

//   const {
//     handleCopy,
//     handleLike,
//     handleDislike,
//     handleRegenerate,
//     isRegenerating
//   } = useMessageActions(chatId || '');

//   const [isSending, setIsSending] = useState(false);
//   const [isNewChatInitiating, setIsNewChatInitiating] = useState(false);
//   const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
//   const streamingControllerRef = useRef<AbortController | null>(null);
//   const isProcessingRef = useRef(false);
//   const [isProcessingPendingMessage, setIsProcessingPendingMessage] = useState(false);

//   // Process pending messages (same logic as web)
//   useEffect(() => {
//     if (token && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current) {
//       const { text, files } = pendingMessage;

//       isProcessingRef.current = true;
//       setIsProcessingPendingMessage(true);
//       console.log("Processing pending message for new chat:", pendingMessage);

//       clearPendingMessage();

//       const userMessageId = nanoid();
//       addMessage({
//         id: userMessageId,
//         message: text,
//         sender: "user",
//         files,
//         timestamp: new Date().toISOString()
//       });
//       setLastUserMessageId(userMessageId);

//       setIsSending(true);

//       const aiMessageId = nanoid();
//       addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

//       const startListening = async () => {
//         try {
//           let receivedText = '';
//           streamingControllerRef.current = new AbortController();

//           await listenToChatStream(
//             token,
//             chatId,
//             (chunk: string, type: string) => {
//               if (type === 'text_chunk') {
//                 receivedText += chunk;
//                 updateMessage(aiMessageId, { message: receivedText });
//               }
//             },
//             () => { // onComplete
//               updateMessage(aiMessageId, { isStreaming: false });
//               setIsSending(false);
//               isProcessingRef.current = false;
//               setIsProcessingPendingMessage(false);
//             },
//             (error) => { // onError
//               console.error("Error in SSE stream for pending message:", error);
//               updateMessage(aiMessageId, {
//                 message: receivedText || "Error receiving AI response.",
//                 error: "Failed response",
//                 isStreaming: false
//               });
//               setIsSending(false);
//               isProcessingRef.current = false;
//               setIsProcessingPendingMessage(false);
//             }
//           );
//         } catch (error) {
//           console.error("Failed to listen to chat stream:", error);
//           updateMessage(aiMessageId, {
//             message: "Error connecting to AI.",
//             error: "Failed response",
//             isStreaming: false
//           });
//           setIsSending(false);
//           isProcessingRef.current = false;
//           setIsProcessingPendingMessage(false);
//         }
//       };

//       startListening();
//     }
//   }, [
//     chatId,
//     pendingMessage,
//     token,
//     addMessage,
//     updateMessage,
//     clearPendingMessage
//   ]);

//   // Load chat history
//   useEffect(() => {
//     console.log("Loading chat history", chatId);
//     const loadChatHistory = async () => {
//       if (!chatId || !token) return;
      
//       if (isProcessingPendingMessage) {
//         console.log("Skipping chat history load - pending message being processed");
//         return;
//       }
  
//       try {
//         const chatResponse = await fetchChatHistory(token, chatId);
  
//         const loadedMessages: Message[] = chatResponse.messages.map((msg) => {
//           const files: MessageFile[] = (msg.attachments || []).map((att) => ({
//             name: att.name,
//             type: att.type,
//             url: att.url,
//             size: att.size,
//           }));
  
//           return {
//             id: msg.id,
//             message: msg.content,
//             sender: msg.sender === 'assistant' ? 'bot' : 'user',
//             timestamp: msg.timestamp,
//             files: files.length > 0 ? files : undefined,
//           };
//         });
  
//         if (loadedMessages.length > 0) {
//           setIsHistoryLoading(true);
//           clearMessages();
//           loadedMessages.forEach((m) => addMessage(m));
//         }
//         setIsHistoryLoading(false);
//       } catch (err) {
//         console.error('Failed to load chat history:', err);
//         setIsHistoryLoading(false);
//       }
//     };
  
//     loadChatHistory();
//   }, [chatId, token, clearMessages, addMessage, isProcessingPendingMessage]);

//   // Handle first message
//   useEffect(() => {
//     if (isFirstMessage && chatId) {
//       if (isProcessingPendingMessage) {
//         console.log("Skipping first message clear - pending message being processed");
//         return;
//       }
//       console.log("Detected first message for new chat ID, clearing messages.");
//       clearMessages();
//     }
//   }, [isFirstMessage, chatId, clearMessages, isProcessingPendingMessage]);

//   const handleSend = async (text: string, attachments: MessageFile[]) => {
//     console.log("message:", text, attachments);
//     if (!text.trim() && attachments.length === 0) {
//       console.warn("Send aborted: No text and no files to send.");
//       return;
//     }
//     if (isSending || isRegenerating || isLoadingToken || !token || isNewChatInitiating) {
//       console.warn("Send aborted: busy, loading, or no token, or new chat initiating.");
//       return;
//     }

//     if (!chatId) {
//       // Logic for a NEW CHAT
//       try {
//         setIsNewChatInitiating(true);
//         const newChatId = await createChatSession(token, "New Chat", text, attachments);
//         useChatStore.getState().setPendingMessage(text, attachments, newChatId);
//         // Navigate to new chat (we'll implement navigation later)
//         // navigate(`/chat/${newChatId}`);
//       } catch (error) {
//         console.error("Failed to create new chat session:", error);
//         setIsNewChatInitiating(false);
//       }
//       return;
//     }

//     // Logic for an EXISTING CHAT
//     setIsSending(true);

//     const userMessageId = nanoid();
//     addMessage({
//       id: userMessageId,
//       message: text,
//       sender: "user",
//       files: attachments,
//       timestamp: new Date().toISOString(),
//     });
//     setLastUserMessageId(userMessageId);

//     const aiMessageId = nanoid();
//     addMessage({
//       id: aiMessageId,
//       message: '',
//       sender: 'bot',
//       timestamp: new Date().toISOString(),
//       isStreaming: true,
//     });

//     try {
//       await sendChatMessage(token, chatId, text, attachments);

//       let receivedText = '';
//       streamingControllerRef.current = new AbortController();

//       await listenToChatStream(
//         token,
//         chatId,
//         (chunk: string, type: string) => {
//           if (type === 'text_chunk') {
//             receivedText += chunk;
//             updateMessage(aiMessageId, { message: receivedText });
//           }
//         },
//         () => { // onComplete
//           updateMessage(aiMessageId, { isStreaming: false });
//           setIsSending(false);
//         },
//         (error) => { // onError
//           console.error("Error in SSE stream:", error);
//           updateMessage(aiMessageId, {
//             message: receivedText || "Error getting AI response",
//             error: "Failed response",
//             isStreaming: false,
//           });
//           setIsSending(false);
//         }
//       );
//     } catch (error) {
//       console.error("Failed to send message:", error);
//       updateMessage(aiMessageId, {
//         message: "Error processing message.",
//         error: "Failed response",
//         isStreaming: false,
//       });
//       setIsSending(false);
//     }
//   };

//   if (tokenError) {
//     return (
//       <SafeAreaView className="flex-1 bg-background">
//         <View className="flex-1 items-center justify-center">
//           <Text className="text-red-500 text-center px-4">
//             Authentication Error: {tokenError}. Please refresh or try again later.
//           </Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (isLoadingToken) {
//     return (
//       <SafeAreaView className="flex-1 bg-background">
//         <View className="flex-1 items-center justify-center">
//           <Text className="text-muted-foreground">Loading authentication...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView className="flex-1 bg-background">
//       <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
//       <KeyboardAvoidingView 
//         className="flex-1" 
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       >
//         <View className="flex-1">
//           <ScrollView 
//             className="flex-1 px-4 py-6"
//             showsVerticalScrollIndicator={false}
//             contentContainerStyle={{ flexGrow: 1 }}
//           >
//             <View className="max-w-3xl mx-auto w-full space-y-8">
//               {isHistoryLoading ? (
//                 <ChatLoadingSkeleton />
//               ) : messages.length === 0 ? (
//                 <View className="flex-1 items-center justify-center space-y-6 py-8">
//                   <ChatEmptyState
//                     isFirstMessage={isFirstMessage}
//                     isSignedIn={!!isSignedIn}
//                     userName={user?.firstName}
//                   />
//                   <View className="w-full max-w-md">
//                     <SuggestionTiles
//                       tiles={suggestionTiles}
//                       onSuggestionClick={(title) => handleSend(title, [])}
//                       disabled={isSending || isRegenerating || isNewChatInitiating}
//                     />
//                   </View>
//                 </View>
//               ) : (
//                 <ChatMessageList
//                   messages={messages}
//                   currentUser={
//                     user
//                       ? {
//                           firstName: user.firstName,
//                           imageUrl: user.imageUrl,
//                         }
//                       : undefined
//                   }
//                   onFileClick={(file: MessageFile) => setSelectedFile(file)}
//                   onCopy={handleCopy}
//                   onLike={handleLike}
//                   onDislike={handleDislike}
//                   onRegenerate={handleRegenerate}
//                 />
//               )}
//               {(isSending || isRegenerating) && !isNewChatInitiating && <AiLoadingIndicator />}
//             </View>
//           </ScrollView>
//         </View>

//         <View className="border-t border-border/5 bg-background/80 backdrop-blur-sm">
//           <View className="px-4 pb-4">
//             <PromptInput
//               onSubmit={handleSend}
//               isLoading={isSending || isRegenerating || isLoadingToken || isNewChatInitiating}
//             />
//           </View>
//         </View>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }


import { View, Text } from 'react-native'
import React from 'react'

const Hello = () => {
  return (
    <View>
      <Text>Hello</Text>
    </View>
  )
}

export default Hello