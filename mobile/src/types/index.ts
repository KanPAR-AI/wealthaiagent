export interface MessageFile {
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  files?: MessageFile[];
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: string;
  createdAt: string;
  isFavorite?: boolean;
}

export interface SSEEvent {
  event: string;
  data: string;
}

export interface StreamDelta {
  type: 'message_delta' | 'message_complete' | 'graph_data' | 'table_data' | 'error';
  content?: string;
  data?: unknown;
}
