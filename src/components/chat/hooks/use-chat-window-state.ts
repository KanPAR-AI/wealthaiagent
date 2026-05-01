import { useState, useRef, useEffect } from 'react';
import { MessageFile } from '@/types';

export interface ChatWindowState {
  selectedFile: MessageFile | null;
  isHistoryLoading: boolean;
  isSending: boolean;
  isNewChatInitiating: boolean;
  lastUserMessageId: string | null;
  isProcessingPendingMessage: boolean;
  streamingController: AbortController | null;
  isProcessingRef: React.MutableRefObject<boolean>;
}

export interface ChatWindowActions {
  setSelectedFile: (file: MessageFile | null) => void;
  setIsHistoryLoading: (loading: boolean) => void;
  setIsSending: (sending: boolean) => void;
  setIsNewChatInitiating: (initiating: boolean) => void;
  setLastUserMessageId: (id: string | null) => void;
  setIsProcessingPendingMessage: (processing: boolean) => void;
  setStreamingController: (controller: AbortController | null) => void;
}

export function useChatWindowState(chatId?: string): ChatWindowState & ChatWindowActions {
  const [selectedFile, setSelectedFile] = useState<MessageFile | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(!!chatId);
  const [isSending, setIsSending] = useState(false);
  const [isNewChatInitiating, setIsNewChatInitiating] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const [isProcessingPendingMessage, setIsProcessingPendingMessage] = useState(false);
  const [streamingController, setStreamingController] = useState<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  // Stable ref so the unmount cleanup below sees the latest controller without
  // having to add it as a dep (which would re-fire on every send).
  const controllerRef = useRef<AbortController | null>(null);
  controllerRef.current = streamingController;

  // On unmount (chat switch, navigation away, hot-reload): abort whatever
  // stream is in flight. Without this, the SSE keeps reading from a dead
  // bot-message id, leaks fetch + decoder, and can race with a new send.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort(new DOMException("ChatWindow unmounted", "AbortError"));
      isProcessingRef.current = false;
    };
  }, []);

  return {
    selectedFile,
    isHistoryLoading,
    isSending,
    isNewChatInitiating,
    lastUserMessageId,
    isProcessingPendingMessage,
    streamingController,
    isProcessingRef,
    setSelectedFile,
    setIsHistoryLoading,
    setIsSending,
    setIsNewChatInitiating,
    setLastUserMessageId,
    setIsProcessingPendingMessage,
    setStreamingController,
  };
}
