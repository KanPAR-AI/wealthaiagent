import { ChatMessage, ChatSession, MessageFile } from '../types';
import { useAuthStore } from '../store/auth';

// Configure this for your backend
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com/api/v1';

function getHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Chat sessions
  async getChatSessions(): Promise<ChatSession[]> {
    const res = await fetch(`${API_BASE_URL}/chats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
    const data = await res.json();
    return data.chats || [];
  },

  async createChat(): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE_URL}/chats`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to create chat: ${res.status}`);
    return res.json();
  },

  async getChatHistory(chatId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
    const data = await res.json();
    return data.messages || [];
  },

  async sendMessage(
    chatId: string,
    content: string,
    fileUrls: string[] = []
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, file_urls: fileUrls }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  },

  async deleteChat(chatId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete chat: ${res.status}`);
  },

  async toggleFavorite(chatId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}/favorite`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to toggle favorite: ${res.status}`);
  },

  // File upload
  async uploadFile(uri: string, name: string, type: string): Promise<MessageFile> {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('files', {
      uri,
      name,
      type,
    } as unknown as Blob);

    const res = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    const file = data.files?.[0];
    if (!file?.url) throw new Error('Invalid upload response');

    return {
      name: file.fileName || name,
      url: file.url,
      type,
      size: 0,
    };
  },

  // SSE stream URL
  getStreamUrl(chatId: string): string {
    return `${API_BASE_URL}/chats/${chatId}/stream`;
  },
};
