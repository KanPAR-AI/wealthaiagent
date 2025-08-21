import { MessageFile } from '@wealthwise/types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Environment configuration helper (same as in use-jwt-token-mobile.ts)
const getEnvironmentConfig = () => {
  // Priority order: .env file > app.json > platform-specific defaults
  const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const appJsonApiUrl = Constants.expoConfig?.extra?.apiUrl;
  
  let baseUrl = envApiBaseUrl || envApiUrl || appJsonApiUrl;
  
  // If no explicit URL is set, determine the correct localhost IP based on platform
  if (!baseUrl) {
    const isAndroid = Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    
    if (isAndroid) {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      baseUrl = 'http://10.0.2.2:8080';
    } else if (isIOS) {
      // iOS simulator can use localhost directly
      baseUrl = 'http://localhost:8080';
    } else {
      // Web or other platforms
      baseUrl = 'http://localhost:8080';
    }
  }
  
  // Remove /api/v1 suffix if present to normalize the base URL
  baseUrl = baseUrl.replace(/\/api\/v\d+$/, '');
  
  // Get API version from environment or default to v1
  const apiVersion = process.env.EXPO_PUBLIC_API_VERSION || 'v1';
  
  return {
    baseUrl,
    apiVersion,
    fullApiUrl: `${baseUrl}/api/${apiVersion}`
  };
};

// Get the API base URL for this service
const config = getEnvironmentConfig();
const API_BASE_URL = config.fullApiUrl;

console.log('Chat Service Environment Config:', {
  baseUrl: config.baseUrl,
  apiVersion: config.apiVersion,
  fullApiUrl: config.fullApiUrl,
  finalApiBaseUrl: API_BASE_URL
});

interface ChatResponse {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'assistant';
    timestamp: string;
    attachments?: Array<{
      name: string;
      type: string;
      content: string;
      size: number;
    }>;
  }>;
}

interface ChatDetail {
  chat: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'assistant';
    timestamp: string;
    attachments?: Array<{
      name: string;
      type: string;
      content: string;
      size: number;
    }>;
  }>;
  hasMoreMessages: boolean;
}

export async function createChatSession(token: string): Promise<string> {
  console.log('Creating chat session');
  
  const response = await fetch(`${API_BASE_URL}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'New Chat',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  const data: ChatDetail = await response.json();
  return data.chat.id;
}

export async function fetchChatHistory(token: string, chatId: string): Promise<ChatResponse> {
  console.log('Fetching chat history:', chatId);
  
  const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat history: ${response.statusText}`);
  }

  const data: ChatDetail = await response.json();
  return {
    id: data.chat.id,
    title: data.chat.title,
    messages: data.messages,
  };
}

export async function sendChatMessage(
  token: string,
  chatId: string,
  message: string,
  attachments: MessageFile[]
): Promise<void> {
  console.log('Sending chat message:', { chatId, message, attachments });
  
  const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: message,
      attachments: attachments.map(file => ({
        name: file.name,
        type: file.type,
        content: file.content,
        size: file.size,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
}

export async function listenToChatStream(
  token: string,
  chatId: string,
  onChunk: (chunk: string, type: string) => void,
  signal?: AbortSignal
): Promise<void> {
  console.log('Listening to chat stream:', chatId);
  
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/stream`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to start stream: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'message_delta') {
              onChunk(data.delta, 'text_chunk');
            } else if (data.type === 'message_complete') {
              return;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', line, e);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Stream aborted');
      return;
    }
    console.error('Stream error:', error);
    throw error;
  }
}
