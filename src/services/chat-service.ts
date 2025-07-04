// services/api-service.ts
import { Message, MessageFile } from "@/types/chat";

const BASE_URL = "https://chatbackend.yourfinadvisor.com"; // Matches your Postman baseUrl

interface ChatResponse {
  chat: {
    id: string;
    messageCount: number;
    title: string;
    // Add other chat properties if they exist in your API response
  };
  messages: Omit<Message, "id" | "timestamp">[];
}

/**
 * Creates a new chat session.
 * Corresponds to Postman's "1. Create a new chat".
 */
export const createChatSession = async (
  jwt: string,
  title: string,
  firstMessageContent: string,
  files: MessageFile[]
): Promise<string> => {
  const response = await fetch(`${BASE_URL}/api/v1/chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      title: title,
      firstMessage: {
        content: firstMessageContent,
        attachments: files.map((file) => ({
          name: file.name,
          type: file.type,
          url: file.url, // Assuming URL is available for attachments
        })),
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to create chat: ${errorData.detail || response.statusText}`
    );
  }

  const data = await response.json();
  return data.chat.id; // Return the new chat ID
};

/**
 * Sends a follow-up message to an existing chat.
 * Corresponds to Postman's "2. Send a follow-up message".
 */
export const sendChatMessage = async (
  jwt: string,
  chatId: string,
  content: string,
  files: MessageFile[]
): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      content: content,
      attachments: files.map((file) => ({
        name: file.name,
        type: file.type,
        url: file.url, // Assuming URL is available for attachments
      })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to send message: ${errorData.detail || response.statusText}`
    );
  }
  // No content expected back from this endpoint for now based on Postman
};

/**
 * Retrieves a specific chat and its messages.
 * Corresponds to Postman's "3. Get chat and verify content".
 */
export const fetchChatHistory = async (
  jwt: string,
  chatId: string
): Promise<ChatResponse> => {
  const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to fetch chat history: ${errorData.detail || response.statusText}`
    );
  }

  return response.json();
};

/**
 * Deletes a chat session.
 * Corresponds to Postman's "4. Delete the chat".
 */
export const deleteChatSession = async (
  jwt: string,
  chatId: string
): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (response.status === 204) {
    return; // No content expected for 204
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to delete chat: ${errorData.detail || response.statusText}`
    );
  }
};

/**
 * Listens to the Server-Sent Events (SSE) stream for AI responses.
 * Corresponds to Postman's "6. Test SSE Stream".
 */
export const listenToChatStream = async (
  jwt: string,
  chatId: string,
  onMessageChunk: (
    chunk: string,
    type: "text_chunk" | "graph_data" | "table_data" | string
  ) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/stream`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to connect to SSE stream: ${response.statusText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    // A unique placeholder to protect apostrophes during the replacement process.
    const APOSTROPHE_PLACEHOLDER = "___APOSTROPHE___";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onComplete();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const payload = line.replace(/^data:\s*/, "");

        if (payload.startsWith("{")) {
          try {
            // --- START: Robust Parsing Hack ---

            // 1. Protect apostrophes that are inside double-quoted strings
            //    (like in "we're") by replacing them with a placeholder.
            const protectedPayload = payload.replace(/"([^"]*)"/g, (group) => {
              return '"' + group.replace(/'/g, APOSTROPHE_PLACEHOLDER) + '"';
            });
            
            // 2. Now it's safe to replace all remaining single quotes with double quotes.
            const jsonString = protectedPayload.replace(/'/g, '"');

            // 3. Restore the protected apostrophes.
            const finalJson = jsonString.replace(new RegExp(APOSTROPHE_PLACEHOLDER, "g"), "'");

            // --- END: Robust Parsing Hack ---

            const parsedEvent = JSON.parse(finalJson);
            
            if (parsedEvent.type === 'message_delta') {
                onMessageChunk(parsedEvent.delta, "text_chunk");
            } else if (parsedEvent.type === 'message_complete') {
              console.log("Received message_complete signal.");
            } else if (parsedEvent.type) {
              const content = parsedEvent.message?.content || parsedEvent.content || "";
              onMessageChunk(content, parsedEvent.type);
            }
          } catch (err) {
            console.warn("Could not parse a structured event from the stream:", payload, err);
          }
        } else {
          // This handles any data that is not a structured object.
          onMessageChunk(payload, "text_chunk");
        }
      }
    }
  } catch (error: any) {
    console.error("SSE Stream error:", error);
    onError(error);
  }
};