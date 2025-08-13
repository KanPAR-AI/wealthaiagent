import { MessageFile } from '@wealthwise/types';

// Update this to match your backend URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

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
      url: string;
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
      url: string;
      size: number;
    }>;
  }>;
  hasMoreMessages: boolean;
}

export async function createChatSession(
  token: string,
  title: string,
  message: string,
  attachments: MessageFile[]
): Promise<string> {
  console.log('Creating chat session:', { title, message, attachments });
  
  const response = await fetch(`${API_BASE_URL}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      firstMessage: {
        content: message,
        attachments: attachments.map(file => ({
          name: file.name,
          type: file.type,
          url: file.url,
          size: file.size,
        })),
      },
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
        url: file.url,
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
  onComplete: () => void,
  onError: (error: any) => void
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
              onComplete();
              return;
            } else if (data.type === 'error') {
              onError(new Error(data.error));
              return;
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', line, e);
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    console.error('Stream error:', error);
    onError(error);
  }
}
