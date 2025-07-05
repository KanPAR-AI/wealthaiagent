import { http, HttpResponse } from 'msw';
import { env } from '@/config/environment';

const BASE_URL = env.apiBaseUrl;

export const handlers = [
  // JWT Token endpoint
  http.post(`${BASE_URL}/api/${env.apiVersion}/auth/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
      expires_in: 3600
    });
  }),

  // Create chat endpoint
  http.post(`${BASE_URL}/api/${env.apiVersion}/chats`, () => {
    return HttpResponse.json({
      id: 'chat-123',
      name: 'New Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }),

  // Send message endpoint
  http.post(`${BASE_URL}/api/${env.apiVersion}/chats/:chatId/messages`, () => {
    return HttpResponse.json({
      id: 'msg-123',
      chatId: 'chat-123',
      message: 'Test message',
      sender: 'user',
      timestamp: new Date().toISOString()
    });
  }),

  // Get chat by ID
  http.get(`${BASE_URL}/api/${env.apiVersion}/chats/:chatId`, ({ params }) => {
    return HttpResponse.json({
      id: params.chatId,
      name: 'Test Chat',
      messages: [
        {
          id: 'msg-1',
          message: 'Hello',
          sender: 'user',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg-2',
          message: 'Hi there!',
          sender: 'bot',
          timestamp: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }),

  // Stream endpoint
  http.get(`${BASE_URL}/api/${env.apiVersion}/chats/:chatId/stream`, () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial message
        controller.enqueue(encoder.encode('data: {"type": "message_start", "id": "msg-123"}\n\n'));
        
        // Send message chunks
        const chunks = ['Hello', ' from', ' the', ' AI', ' assistant!'];
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            controller.enqueue(
              encoder.encode(`data: {"type": "message_delta", "delta": "${chunk}"}\n\n`)
            );
            
            // Send completion after last chunk
            if (index === chunks.length - 1) {
              setTimeout(() => {
                controller.enqueue(
                  encoder.encode('data: {"type": "message_stop"}\n\n')
                );
                controller.close();
              }, 100);
            }
          }, index * 200);
        });
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // Delete chat endpoint
  http.delete(`${BASE_URL}/api/${env.apiVersion}/chats/:chatId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

// Error handlers for testing error scenarios
export const errorHandlers = {
  tokenError: http.post(`${BASE_URL}/api/${env.apiVersion}/auth/token`, () => {
    return HttpResponse.json(
      { error: 'Unauthorized', message: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  createChatError: http.post(`${BASE_URL}/api/${env.apiVersion}/chats`, () => {
    return HttpResponse.json(
      { error: 'Server Error', message: 'Failed to create chat' },
      { status: 500 }
    );
  }),

  networkError: http.post(`${BASE_URL}/api/${env.apiVersion}/auth/token`, () => {
    return HttpResponse.error();
  }),
}; 