# WealthAI Agent PWA - Complete Documentation

## Overview

This document provides a comprehensive breakdown of the WealthAI Agent PWA, including frontend architecture, component structure, API calls, and system design. The application is a React-based Progressive Web App (PWA) that provides an AI-powered chat interface for financial advisory services.

## Table of Contents

1. [Frontend Architecture](#frontend-architecture)
2. [Component Hierarchy](#component-hierarchy)
3. [Component Responsibilities](#component-responsibilities)
4. [API Documentation](#api-documentation)
5. [State Management](#state-management)
6. [Routing Structure](#routing-structure)
7. [Custom Hooks](#custom-hooks)
8. [Error Handling](#error-handling)
9. [Security & Performance](#security--performance)
10. [Testing & Deployment](#testing--deployment)

---

## Frontend Architecture

### Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6.3.1
- **State Management**: Zustand 5.0.4
- **Routing**: React Router DOM 7.5.3
- **UI Components**: Radix UI + Tailwind CSS 4.1.4
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React 0.503.0
- **Charts**: Recharts 2.15.3
- **PWA**: Vite Plugin PWA 1.0.3
- **Testing**: Jest 29.7.0 + Testing Library
- **Linting**: ESLint 9.22.0

### Project Structure

```
src/
├── components/           # React components
│   ├── chat/            # Chat-specific components
│   │   └── hooks/       # Chat-specific custom hooks
│   ├── ui/              # Reusable UI primitives
│   ├── layout/          # Layout components
│   ├── providers/       # Context providers
│   ├── theme/           # Theme components
│   ├── charts/          # Chart components
│   ├── table/           # Table components
│   └── debug/           # Debug components
├── hooks/               # Global custom React hooks
│   └── use-cached-file.ts  # File caching hook
├── services/            # API services and business logic
│   └── file-cache.ts    # IndexedDB file caching service
├── store/               # Zustand state stores
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── config/              # Configuration files
├── pages/               # Page components
├── assets/              # Static assets
└── test/                # Test utilities and mocks
```

### Design Patterns

1. **Component Composition**: Heavy use of compound components
2. **Custom Hooks**: Business logic extracted into reusable hooks
3. **State Colocation**: State management close to where it's used
4. **Error Boundaries**: Graceful error handling at component level
5. **Optimistic Updates**: Immediate UI feedback for better UX
6. **Lazy Loading**: Code splitting and dynamic imports
7. **Single Responsibility Principle**: Each hook and component has a focused purpose
8. **Separation of Concerns**: UI logic separated from business logic
9. **Hook Composition**: Complex components broken down into focused custom hooks
10. **Cache-First Strategy**: Local caching with backend fallback for optimal performance
11. **Granular State Management**: Fine-grained loading states for better UX

---

## Component Hierarchy

### Application Root Structure

```
App
├── AppProviders (Context providers)
├── BrowserRouter
│   ├── AppLayout (Persistent layout)
│   │   ├── ChatSidebar (Navigation)
│   │   └── Routes
│   │       ├── New (New chat page)
│   │       ├── Chat (Existing chat page)
│   │       └── Logs (Debug page)
│   └── NotFound (404 page)
└── PWAInstall (PWA installation prompt)
```

### Chat Interface Hierarchy

```
ChatWindow (Main chat container)
├── ChatHeader (Page header)
├── ScrollArea (Message container)
│   ├── ChatEmptyState (Empty state)
│   ├── SuggestionTiles (Quick actions)
│   ├── ChatMessageList (Message list)
│   │   └── ChatBubble (Individual messages)
│   └── AiLoadingIndicator (Loading state)
├── PromptInputWithActions (Input area)
│   ├── FileUpload (File attachment)
│   ├── VoiceRecording (Audio input)
│   └── TextInput (Text input)
└── FilePreviewModal (File preview)
```

### Sidebar Hierarchy

```
ChatSidebar
├── SidebarHeader
│   ├── NewChatButton
│   └── SearchInput
├── SidebarContent
│   ├── FavoriteChats (Favorites section)
│   └── RecentChats (Recent section)
│       └── ChatMenuItem (Individual chat)
└── SidebarFooter
    └── UserProfile
```

---

## Component Responsibilities

### Core Components

#### 1. **App** (`src/App.tsx`)
**Responsibility**: Application root and routing setup
- Configures React Router with base path
- Sets up global providers
- Defines route structure
- Handles PWA installation

**Key Features**:
- Base path configuration (`/chataiagent`)
- Route protection and navigation
- Global error boundaries

#### 2. **AppLayout** (`src/components/layout/app-layout.tsx`)
**Responsibility**: Persistent application layout
- Provides consistent layout across pages
- Manages sidebar visibility
- Handles responsive design
- Integrates with routing

**Key Features**:
- Responsive sidebar
- Layout persistence
- Mobile navigation

#### 3. **ChatWindow** (`src/components/chat/chat-window.tsx`)
**Responsibility**: Main chat interface orchestrator
- Manages chat session state
- Handles message sending/receiving
- Coordinates AI response streaming
- Manages file uploads and previews

**Key Features**:
- Real-time message streaming
- File attachment handling
- Chat history loading
- Error state management
- Optimistic UI updates
- **Refactored Architecture**: Uses custom hooks for better separation of concerns
- **Improved Maintainability**: Reduced from 425 lines to ~200 lines (53% reduction)

#### 4. **ChatSidebar** (`src/components/chat/chat-sidebar.tsx`)
**Responsibility**: Chat navigation and management
- Displays chat history
- Handles chat creation/deletion
- Manages favorites
- Provides search functionality

**Key Features**:
- Chat list with pagination
- Favorite management
- Search and filtering
- Optimistic updates
- Context menu actions

#### 5. **PromptInputWithActions** (`src/components/chat/chat-input.tsx`)
**Responsibility**: Message input and actions
- Handles text input
- Manages file uploads with instant previews
- Provides voice recording
- Handles message submission
- Manages granular loading states

**Key Features**:
- Multi-file upload with instant previews
- Voice-to-text transcription
- Real-time validation
- Progress indicators
- Keyboard shortcuts
- **Granular Loading States**: Users can type while files upload
- **File Caching Integration**: Instant previews using IndexedDB cache
- **Smart UI Controls**: Only disables conflicting actions during operations

### UI Components

#### 6. **ChatMessageList** (`src/components/chat/message-list.tsx`)
**Responsibility**: Message display and rendering
- Renders message bubbles
- Handles message actions
- Manages file previews
- Provides message interactions

**Key Features**:
- Message bubble rendering
- Action button integration
- File preview handling
- Message formatting
- Responsive design

#### 7. **ChatBubble** (`src/components/chat/chat-bubbles.tsx`)
**Responsibility**: Individual message display
- Renders message content
- Handles message formatting
- Provides action buttons
- Manages file attachments with instant previews

**Key Features**:
- Markdown rendering
- File attachment display with instant previews
- Action button integration
- Message status indicators
- Responsive layout
- **File Caching Integration**: Uses IndexedDB cache for instant file previews

#### 8. **FilePreviewModal** (`src/components/chat/file-preview-modal.tsx`)
**Responsibility**: Secure file preview with instant loading
- Handles file preview display
- Manages blob URL creation from cache
- Provides download functionality
- Ensures secure access

**Key Features**:
- Image preview with instant loading
- PDF viewer with instant loading
- Download functionality
- Secure blob handling
- Responsive modal
- **File Caching Integration**: Instant previews using IndexedDB cache

### Utility Components

#### 9. **SuggestionTiles** (`src/components/chat/chat-suggestion-tiles.tsx`)
**Responsibility**: Quick action suggestions
- Displays suggested prompts
- Handles suggestion clicks
- Provides onboarding help

**Key Features**:
- Configurable suggestions
- Click handling
- Responsive grid
- Accessibility support

#### 10. **AiLoadingIndicator** (`src/components/chat/ai-loading-indicator.tsx`)
**Responsibility**: Loading state display
- Shows AI response loading
- Provides visual feedback
- Handles streaming states

**Key Features**:
- Animated loading indicator
- Streaming state display
- Responsive design
- Accessibility support

---

## Custom Hooks

### 1. **useJwtToken** (`src/hooks/use-jwt-token.ts`)
**Responsibility**: Authentication token management
- Fetches JWT token on app start
- Manages token state
- Handles authentication errors
- Provides token to components

**Key Features**:
- Automatic token fetching
- Error handling
- Session storage persistence
- Loading states

### 2. **useChatMessages** (`src/hooks/use-chat-messages.ts`)
**Responsibility**: Message state management
- Manages message list state
- Handles message operations
- Provides cleanup functions
- Manages file URLs

**Key Features**:
- Message CRUD operations
- File URL management
- Memory cleanup
- State persistence

### 3. **useMessageActions** (`src/hooks/use-message-actions.ts`)
**Responsibility**: Message interaction handling
- Handles message actions (copy, like, regenerate)
- Manages regeneration flow
- Provides action feedback
- Handles error states

**Key Features**:
- Copy to clipboard
- Message regeneration
- Like/dislike actions
- Error handling

### 4. **useChatSession** (`src/hooks/use-chat-session.ts`)
**Responsibility**: Chat session management
- Manages chat session state
- Handles new chat creation
- Provides navigation helpers
- Manages pending messages

**Key Features**:
- Session state management
- New chat creation
- Navigation handling
- Pending message management

### 5. **File Caching System** (`src/services/file-cache.ts`, `src/hooks/use-cached-file.ts`)
**Responsibility**: Local file caching for instant previews
- **FileCacheService**: IndexedDB-based storage for file blobs
- **useCachedFile**: React hook for seamless file fetching with caching
- **Cache Management**: Automatic cleanup and size management

**Key Features**:
- **Instant Previews**: Files cached after first load for instant subsequent views
- **Smart Cache Management**: 100MB limit with LRU eviction and 7-day expiration
- **Seamless Fallback**: Cache miss → backend fetch → cache result
- **Memory Management**: Proper blob URL cleanup prevents memory leaks
- **No Backend Changes**: Works with existing backend integration

### 6. **ChatWindow Custom Hooks** (`src/components/chat/hooks/`)
**Responsibility**: ChatWindow component logic separation
- **useChatWindowState**: Centralized state management for chat window
- **useChatHistory**: Chat history loading and management logic
- **usePendingMessage**: Pending message processing logic
- **useMessageSending**: Message sending and streaming logic

**Key Features**:
- **Single Responsibility**: Each hook handles one specific concern
- **Improved Testability**: Logic is isolated and easier to test
- **Better Maintainability**: Complex logic is broken into focused hooks
- **Reusability**: Hooks can be reused across components
- **Code Organization**: Reduces component complexity significantly

---

## SSE Streaming Flow

### Overview

The application uses Server-Sent Events (SSE) to stream AI responses in real-time, providing a smooth, progressive text display as the AI generates its response. This section details the complete flow from receiving SSE events to displaying streamed text in the UI.

### Architecture Flow Diagram

```
User Types Message → handleSend()
                        ↓
                 POST /chats/{chatId}/messages → Backend processes request
                        ↓
                 GET /chats/{chatId}/stream ← Backend streams SSE events
                        ↓
              listenToChatStream() ← Parses SSE event chunks
                        ↓
                onMessageChunk() ← Accumulates text chunks
                        ↓
               updateMessage() → Updates Zustand store
                        ↓
             useChatMessages() ← Hook reacts to store change
                        ↓
            ChatMessageList ← Re-renders with new messages
                        ↓
               ChatBubble ← Displays individual message
                        ↓
            StreamingResponse ← Renders streaming content with animation
                        ↓
                   UI Updates! ✨
```

### Step-by-Step Flow

#### Step 1: User Sends a Message
**File**: `src/components/chat/hooks/use-message-sending.ts`

```typescript
// User message is immediately added to the store
const userMessageId = nanoid();
addMessage({
  id: userMessageId,
  message: text,
  sender: "user",
  files: attachments,
  timestamp: new Date().toISOString(),
});

// Placeholder bot message created with streaming flag
const aiMessageId = nanoid();
addMessage({
  id: aiMessageId,
  message: '',
  sender: 'bot',
  timestamp: new Date().toISOString(),
  isStreaming: true,
  streamingContent: '',
  streamingChunks: [],
});
```

**Purpose**: Creates optimistic UI updates, showing the user message immediately and preparing a placeholder for the AI response.

#### Step 2: HTTP POST + SSE Stream Initiated
**File**: `src/components/chat/hooks/use-message-sending.ts`

```typescript
// Send message to backend
await sendChatMessage(token, chatId, text, attachments);

// Initialize streaming
let receivedText = '';
const streamingChunks: string[] = [];

// Open SSE connection
await listenToChatStream(
  token,
  chatId,
  onMessageChunk,  // Callback for each chunk
  onComplete,      // Callback when streaming completes
  onError          // Callback for errors
);
```

**Purpose**: Sends the user's message via HTTP POST, then opens an SSE connection to receive the AI's response in real-time.

#### Step 3: SSE Stream Processing
**File**: `src/services/chat-service.ts`

```typescript
export const listenToChatStream = async (
  jwt: string,
  chatId: string,
  onMessageChunk: (chunk: string, type: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) => {
  const response = await fetch(getApiUrl(`/chats/${chatId}/stream`), {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${jwt}`,
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      onComplete();
      break;
    }

    // Decode and parse SSE events
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      
      const payload = line.replace(/^data:\s*/, "");
      const parsedEvent = JSON.parse(payload);
      
      if (parsedEvent.type === 'message_delta') {
        onMessageChunk(parsedEvent.delta, "text_chunk");
        // Yield to browser to allow React to update UI
        await new Promise(resolve => setTimeout(resolve, 0));
      } else if (parsedEvent.type === 'message_complete') {
        onComplete();
        return;
      }
    }
  }
};
```

**Purpose**: 
- Reads SSE stream chunks from the network
- Parses JSON events (`message_delta`, `message_complete`, etc.)
- Calls `onMessageChunk` callback for each text chunk
- **Critical**: `setTimeout(..., 0)` yields control back to the browser, allowing React to flush state updates and re-render immediately rather than batching all updates together

**SSE Event Types**:
- `message_start`: Signals the start of a new message
- `message_delta`: Contains a text chunk to append
- `message_complete`: Signals the end of the message
- `graph_data`: Contains structured graph data (for charts)
- `table_data`: Contains structured table data

#### Step 4: Update Message in Store
**File**: `src/components/chat/hooks/use-message-sending.ts`

```typescript
// Callback invoked for each chunk
(chunk: string, type: string) => {
  if (type === 'text_chunk') {
    // Accumulate text
    receivedText += chunk;
    streamingChunks.push(chunk);
    
    // Update message in store
    updateMessage(aiMessageId, { 
      message: receivedText,
      streamingContent: receivedText,
      streamingChunks: [...streamingChunks],
    });
  }
}
```

**Purpose**: Each chunk appends to the accumulated text, and `updateMessage()` updates the message in the Zustand store, triggering React re-renders.

#### Step 5: Zustand Store Update
**File**: `src/store/chat.ts`

```typescript
updateMessage: (chatId, messageId, updates) =>
  set((state) => ({
    chats: {
      ...state.chats,
      [chatId]: {
        messages: (state.chats[chatId]?.messages || []).map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
      },
    },
  })),
```

**Purpose**: 
- Store finds the message by ID and merges the updates
- This triggers React re-renders for all components subscribed to this state
- Each update is processed immediately due to the `setTimeout` yield in Step 3

#### Step 6: Hook Receives Updated Messages
**File**: `src/hooks/use-chat-messages.ts`

```typescript
const selector = useCallback(
  (state: any) => {
    const messages = state.chats[chatId]?.messages;
    return messages || emptyArrayRef.current;
  },
  [chatId]
);

const messages = useChatStore(selector);
```

**Purpose**: 
- `useChatMessages` hook subscribes to the Zustand store
- Receives updated messages array on each chunk
- Re-renders components that use this hook

#### Step 7: Message List Renders
**File**: `src/components/chat/message-list.tsx`

```typescript
{messages.map((message) => (
  <motion.div
    key={message.id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <ChatBubble
      message={message}
      currentUser={currentUser}
      onFileClick={onFileClick}
      actionIcons={actionIcons}
    />
  </motion.div>
))}
```

**Purpose**: 
- `ChatMessageList` maps over messages array
- Each message wrapped in Framer Motion for smooth animations
- Re-renders on each store update with new content

#### Step 8: Chat Bubble Renders Content
**File**: `src/components/chat/chat-bubbles.tsx`

```typescript
{message.sender === 'bot' ? (
  <StreamingResponse 
    content={message.streamingContent || message.message}
    isStreaming={message.isStreaming || false}
    className="chat-bubble-content"
  />
) : (
  <div className="break-all overflow-wrap-anywhere">
    {message.message}
  </div>
)}
```

**Purpose**: 
- `ChatBubble` checks if it's a bot message
- Passes `streamingContent` to `StreamingResponse` component
- `isStreaming` flag controls streaming animation/behavior
- Bot messages use `StreamingResponse` for progressive rendering
- User messages use simple div for static display

#### Step 9: Stream Completion
**File**: `src/components/chat/hooks/use-message-sending.ts`

```typescript
// Callback when streaming completes
() => {
  updateMessage(aiMessageId, { 
    isStreaming: false,
    message: receivedText,
    streamingContent: receivedText,
  });
  setIsSending(false);
}
```

**Purpose**: 
- When backend sends `message_complete` event, `onComplete` callback fires
- Sets `isStreaming: false` to finalize the message
- Hides loading indicators and enables input controls
- Final content stored in both `message` and `streamingContent` fields

### Key Implementation Details

#### 1. React 18 Automatic Batching
**Problem**: React 18 batches multiple state updates within the same event loop, which would cause all SSE chunks to be batched together and displayed at once instead of progressively.

**Solution**: Added `await new Promise(resolve => setTimeout(resolve, 0))` after each `onMessageChunk()` call to yield control back to the browser, allowing React to flush pending state updates and re-render the UI immediately.

```typescript
if (parsedEvent.type === 'message_delta') {
  onMessageChunk(parsedEvent.delta, "text_chunk");
  // Force React to update the UI by yielding to the browser
  await new Promise(resolve => setTimeout(resolve, 0));
}
```

#### 2. History Message Loading
**File**: `src/components/chat/hooks/use-chat-history.ts`

When loading messages from chat history, the system properly initializes streaming-related fields:

```typescript
return {
  id: msg.id,
  message: msg.content,
  sender: msg.sender === 'assistant' ? 'bot' : 'user',
  timestamp: msg.timestamp,
  files: files.length > 0 ? files : undefined,
  // For history messages, streaming is complete
  isStreaming: false,
  streamingContent: msg.content,
};
```

**Purpose**: Ensures history messages are treated as complete, non-streaming messages.

#### 3. Streaming Response Component
**File**: `src/components/chat/streaming-response.tsx`

```typescript
export const StreamingResponse = ({ content, isStreaming, className }) => {
  return (
    <div className={cn("break-all overflow-wrap-anywhere", className)}>
      {isStreaming ? (
        <StreamingTextRenderer content={content} />
      ) : (
        <Response>{content}</Response>
      )}
      {isStreaming && <BlinkingCursor />}
    </div>
  );
};
```

**Features**:
- Displays blinking cursor during streaming
- Uses `StreamingTextRenderer` for progressive text display
- Switches to full markdown renderer (`Response`) when streaming completes
- Applies basic formatting (bold, italic, code) during streaming

#### 4. Error Handling

```typescript
// Error callback
(error) => {
  console.error("Error in SSE stream:", error);
  updateMessage(aiMessageId, {
    message: receivedText || "Error getting AI response",
    streamingContent: receivedText || "Error getting AI response",
    error: "Failed response",
    isStreaming: false,
  });
  setIsSending(false);
}
```

**Purpose**: Gracefully handles stream errors, displays partial content if any was received, and shows error state to the user.

### Performance Optimizations

1. **Incremental Updates**: Only the changed message is updated in the store, not the entire message list
2. **Efficient Re-renders**: React only re-renders components affected by the store update
3. **Blob URL Management**: Proper cleanup of file URLs prevents memory leaks
4. **Debounced Rendering**: The `setTimeout(..., 0)` creates natural debouncing between chunks
5. **Stable Selectors**: `useChatMessages` uses stable selectors to prevent unnecessary re-renders

### Debugging Tips

1. **Enable Console Logging**: Check browser console for streaming logs:
   - `"Streaming chunk received:"` - Each chunk as it arrives
   - `"ChatBubble bot message:"` - Component re-renders
   - `"StreamingResponse render:"` - Streaming component updates

2. **Network Tab**: Monitor SSE connection in browser DevTools:
   - Look for `/stream` endpoint with `text/event-stream` content type
   - Check for continuous data chunks
   - Verify connection stays open during streaming

3. **React DevTools**: Watch state updates in real-time:
   - Monitor Zustand store changes
   - Track component re-renders
   - Verify `isStreaming` flag transitions

### Common Issues and Solutions

#### Issue: Text appears all at once instead of streaming
**Cause**: React batching multiple updates together
**Solution**: Ensure `setTimeout(..., 0)` is present after each `onMessageChunk` call

#### Issue: Streaming stops midway
**Cause**: Network connection interrupted or backend error
**Solution**: Check error callback is invoked, verify network stability

#### Issue: Multiple messages streaming simultaneously
**Cause**: Race condition from sending messages too quickly
**Solution**: Disable send button while `isSending` is true

#### Issue: Memory leaks from file attachments
**Cause**: Blob URLs not properly cleaned up
**Solution**: Ensure `useEffect` cleanup in `ChatBubble` revokes URLs

---

## Routing Structure

### Route Configuration

```typescript
// Main routes
/ → New (New chat page)
/new → New (New chat page)
/chat → New (New chat page)
/chat/:chatid → Chat (Existing chat page)
/logs → Logs (Debug page)
/* → NotFound (404 page)
```

### Route Components

#### 1. **New** (`src/pages/New.tsx`)
**Responsibility**: New chat page
- Renders empty chat interface
- Provides suggestion tiles
- Handles first message creation

#### 2. **Chat** (`src/pages/Chat.tsx`)
**Responsibility**: Existing chat page
- Renders chat with history
- Handles chat ID validation
- Manages chat loading states

#### 3. **Logs** (`src/pages/Logs.tsx`)
**Responsibility**: Debug and logging page
- Displays application logs
- Provides debug information
- Handles log filtering

#### 4. **NotFound** (`src/pages/NotFound.tsx`)
**Responsibility**: 404 error page
- Handles unknown routes
- Provides navigation back
- Shows helpful error message

---

## State Management Architecture

### Zustand Store Structure

#### 1. **Auth Store** (`useAuthStore`)
```typescript
interface AuthState {
  token: string | null;
  tokenError: string | null;
  isLoadingToken: boolean;
  setToken: (token: string | null) => void;
  setTokenError: (error: string | null) => void;
  setIsLoadingToken: (loading: boolean) => void;
}
```

**Responsibility**: Authentication state management
- JWT token storage
- Authentication status
- Error handling
- Loading states

#### 2. **Chat Store** (`useChatStore`)
```typescript
interface ChatState {
  chats: Record<string, { messages: Message[] }>;
  pendingMessage: { chatId: string; text: string; files: MessageFile[] } | null;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  clearChat: (chatId: string) => void;
  getMessages: (chatId: string) => Message[];
  setPendingMessage: (text: string, files: MessageFile[], targetChatId: string) => void;
  getPendingMessage: (chatId: string) => { text: string; files: MessageFile[] } | null;
  clearPendingMessage: () => void;
}
```

**Responsibility**: Chat state management
- Message storage
- Chat session management
- Pending message handling
- State persistence

### State Flow Patterns

1. **Authentication Flow**:
   - App start → `useJwtToken` → Auth store → Components

2. **Message Flow**:
   - User input → `ChatWindow` → API call → State update → UI render

3. **File Upload Flow**:
   - File selection → Upload API → URL generation → Message attachment

4. **Chat Navigation Flow**:
   - Sidebar click → Route change → Chat loading → History fetch → State update

---

## API Documentation

### Base Configuration

- **Base URL**: `https://chatbackend.yourfinadvisor.com`
- **API Version**: `v1`
- **Authentication**: JWT Bearer Token
- **Content Type**: `application/json` (except file uploads and form data)

### API Endpoints Summary

| Method | Endpoint | Purpose | Component/Page |
|--------|----------|---------|----------------|
| POST | `/api/v1/auth/token` | Authentication | `useJwtToken` hook |
| POST | `/api/v1/chats` | Create new chat | `ChatWindow` component |
| POST | `/api/v1/chats/{chatId}/messages` | Send message | `ChatWindow` component |
| GET | `/api/v1/chats/{chatId}` | Get chat history | `ChatWindow` component |
| DELETE | `/api/v1/chats/{chatId}` | Delete chat | `ChatSidebar` component |
| GET | `/api/v1/chats/{chatId}/stream` | SSE stream for AI responses | `ChatWindow` component |
| GET | `/api/v1/chats?page=1&limit=20` | List user chats | `ChatSidebar` component |
| POST | `/api/v1/chats/{chatId}/favorite` | Toggle favorite status | `ChatSidebar` component |
| POST | `/api/v1/files/upload` | Upload files | `ChatInput` component |
| POST | `/api/v1/audio/transcribe` | Transcribe audio | `ChatInput` component |

### Component-wise API Breakdown

#### 1. Authentication (`useJwtToken` hook)

**File**: `src/hooks/use-jwt-token.ts`

##### API Call: Get JWT Token
```typescript
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

Body:
- username: "test_username"
- password: "kzjdbv"
```

**Response**:
```json
{
  "access_token": "jwt_token_string"
}
```

**Usage**: 
- Automatically called when the app starts
- Token is stored in Zustand store and sessionStorage
- Used for all subsequent authenticated requests

**Error Handling**: 
- Sets `tokenError` state on failure
- Displays authentication error in UI

---

#### 2. Chat Window (`ChatWindow` component)

**File**: `src/components/chat/chat-window.tsx`

##### API Call: Create New Chat Session
```typescript
POST /api/v1/chats
Authorization: Bearer {jwt_token}
Content-Type: application/json

Body:
{
  "title": "New Chat",
  "firstMessage": {
    "content": "user_message_text",
    "attachments": ["file_url_1", "file_url_2"]
  }
}
```

**Response**:
```json
{
  "chat": {
    "id": "chat_id_string"
  }
}
```

**Usage**: Called when user sends first message in a new chat
**State Management**: Creates new chat ID and navigates to chat route

##### API Call: Send Follow-up Message
```typescript
POST /api/v1/chats/{chatId}/messages
Authorization: Bearer {jwt_token}
Content-Type: application/json

Body:
{
  "content": "user_message_text",
  "attachments": ["file_url_1", "file_url_2"]
}
```

**Response**: No content (204 status)
**Usage**: Called for subsequent messages in existing chats

##### API Call: Get Chat History
```typescript
GET /api/v1/chats/{chatId}
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "chat": {
    "id": "string",
    "title": "string",
    "createdAt": "ISO_date_string",
    "updatedAt": "ISO_date_string",
    "userId": "string",
    "messageCount": number,
    "lastMessage": {}
  },
  "messages": [
    {
      "id": "string",
      "content": "string",
      "attachments": [
        {
          "name": "string",
          "type": "string",
          "url": "string",
          "size": number
        }
      ],
      "chatId": "string",
      "sender": "user" | "assistant",
      "timestamp": "ISO_date_string",
      "status": "string",
      "metadata": {}
    }
  ],
  "hasMoreMessages": boolean
}
```

**Usage**: Called when loading existing chat history
**State Management**: Populates message list in Zustand store

##### API Call: Listen to AI Response Stream (SSE)
```typescript
GET /api/v1/chats/{chatId}/stream
Authorization: Bearer {jwt_token}
Accept: text/event-stream
```

**Response**: Server-Sent Events stream
**Event Types**:
- `message_delta`: Text chunks from AI
- `message_complete`: End of message signal
- `graph_data`: Structured graph data
- `table_data`: Structured table data

**Usage**: Real-time streaming of AI responses
**State Management**: Updates message content in real-time

---

#### 3. Chat Sidebar (`ChatSidebar` component)

**File**: `src/components/chat/chat-sidebar.tsx`

##### API Call: List User Chats
```typescript
GET /api/v1/chats?page=1&limit=20
Authorization: Bearer {jwt_token}
```

**Response**:
```json
[
  {
    "id": "string",
    "title": "string",
    "updatedAt": "ISO_date_string",
    "isFavorite": boolean
  }
]
```

**Usage**: Loads chat history for sidebar display
**State Management**: Local component state

##### API Call: Toggle Chat Favorite Status
```typescript
POST /api/v1/chats/{chatId}/favorite
Authorization: Bearer {jwt_token}
Content-Type: application/json

Body:
{
  "isFavorite": boolean
}
```

**Response**: Success status
**Usage**: Add/remove chat from favorites
**State Management**: Optimistic UI updates

##### API Call: Delete Chat (TODO - Currently Simulated)
```typescript
DELETE /api/v1/chats/{chatId}
Authorization: Bearer {jwt_token}
```

**Response**: 204 No Content
**Usage**: Remove chat from history
**Status**: Currently simulated in code, not implemented

##### API Call: Rename Chat (TODO - Currently Simulated)
```typescript
PUT /api/v1/chats/{chatId}/rename
Authorization: Bearer {jwt_token}
Content-Type: application/json

Body:
{
  "title": "new_chat_title"
}
```

**Response**: Success status
**Usage**: Update chat title
**Status**: Currently simulated in code, not implemented

---

#### 4. Chat Input (`ChatInput` component)

**File**: `src/components/chat/chat-input.tsx`

##### API Call: Upload Files
```typescript
POST /api/v1/files/upload
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

Body:
- files: File[] (multiple files supported)
```

**Response**:
```json
{
  "files": [
    {
      "fileName": "string",
      "url": "string",
      "size": number,
      "type": "string"
    }
  ]
}
```

**Usage**: Upload attachments for chat messages
**State Management**: Local component state for uploaded files

##### API Call: Transcribe Audio
```typescript
POST /api/v1/audio/transcribe
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

Body:
- file: Blob (audio/webm format)
```

**Response**:
```json
{
  "transcription": "transcribed_text_string"
}
```

**Usage**: Convert voice input to text
**State Management**: Appends transcribed text to input field

---

#### 5. File Preview Modal (`FilePreviewModal` component)

**File**: `src/components/chat/file-preview-modal.tsx`

##### API Call: Fetch File for Preview
```typescript
GET {file_url}
Authorization: Bearer {jwt_token}
```

**Response**: File blob data
**Usage**: Secure file preview with authentication
**State Management**: Creates blob URL for preview
**Caching**: Files are cached in IndexedDB for instant subsequent previews

---

#### 6. Message Actions (`useMessageActions` hook)

**File**: `src/hooks/use-message-actions.ts`

##### API Calls: Regenerate AI Response
Uses the same endpoints as `ChatWindow`:
- `POST /api/v1/chats/{chatId}/messages` - Resend user message
- `GET /api/v1/chats/{chatId}/stream` - Get new AI response

**Usage**: Regenerate AI response for a specific message
**State Management**: Updates existing message content

---

---

## Error Handling

### Error Handling Patterns

#### 1. Authentication Errors
- Token expiration handled by `useJwtToken` hook
- Automatic retry on token refresh
- User-friendly error messages

#### 2. Network Errors
- Graceful degradation for offline scenarios
- Retry mechanisms for failed requests
- Loading states for better UX

#### 3. File Upload Errors
- Individual file error handling
- Progress indicators
- Rollback on partial failures

#### 4. SSE Stream Errors
- Connection retry logic
- Fallback to polling if SSE fails
- Error state management

#### 5. File Caching Errors
- Cache miss fallback to backend
- IndexedDB storage errors handled gracefully
- Memory cleanup on cache failures
- Blob URL cleanup prevents memory leaks

---

## Security & Performance

### Security Considerations

#### 1. JWT Token Management
- Secure token storage in sessionStorage
- Automatic token refresh
- Token validation on each request

#### 2. File Access with Caching
- Authenticated file downloads
- Secure blob URL generation
- Proper cleanup of blob URLs
- **IndexedDB Security**: Files cached locally with same authentication requirements
- **Cache Isolation**: Each user's cache is isolated and secure
- **Memory Management**: Automatic cleanup prevents data persistence issues

#### 3. CORS Configuration
- Proper CORS headers for API access
- Preflight request handling
- Credential inclusion

### Performance Optimizations

#### 1. Message Streaming
- Real-time AI response streaming
- Chunked message updates
- Efficient re-rendering

#### 2. File Handling with Caching
- **IndexedDB Caching**: Files cached locally for instant previews
- **Cache-First Strategy**: Check cache → fetch if miss → cache result
- **Smart Cache Management**: 100MB limit with LRU eviction and 7-day expiration
- **Memory Management**: Proper blob URL cleanup prevents memory leaks
- **Instant Previews**: Previously viewed files load instantly
- **Seamless Fallback**: Graceful degradation when cache fails

#### 3. Granular Loading States
- **Smart UI Controls**: Only disables conflicting actions during operations
- **User-Friendly UX**: Users can type while files upload
- **Clear Feedback**: Tooltips explain why actions are disabled
- **Logical Restrictions**: Prevents race conditions and conflicts

#### 4. State Management
- Optimistic UI updates
- Efficient state updates
- Minimal re-renders

---

## Testing & Deployment

### Testing

#### Mock Handlers
Located in `src/test/mocks/handlers.ts`:
- Authentication endpoints
- Chat management endpoints
- File upload endpoints
- Error scenarios

#### Test Coverage
- JWT authentication flow
- File upload functionality
- Chat session management
- Message streaming
- Error handling
- **Recent Improvements**:
  - Added tests for pages (Index, NotFound)
  - Added utility function tests
  - Improved test infrastructure
  - **Current Coverage**: 6.87% (improved from 6.28%)
  - **Target Coverage**: 70% (infrastructure in place for expansion)

#### Code Quality Improvements
- **ESLint Warnings**: Reduced from 16 to 6 (62% reduction)
- **Component Refactoring**: ChatWindow reduced from 425 to ~200 lines
- **Custom Hooks**: Added 4 new hooks for better code organization
- **Maintainability**: Significantly improved through separation of concerns

### Environment Configuration

The application uses a centralized environment configuration system located in `src/config/environment.ts`. This system provides type-safe access to environment variables with validation, defaults, and helper functions.

#### Environment Configuration Interface

```typescript
interface EnvironmentConfig {
  // API Configuration
  apiBaseUrl: string;
  apiVersion: string;
  
  // Application Configuration
  appBasePath: string;
  appName: string;
  appPort: number;
  
  // Feature Flags
  enableAnalytics: boolean;
  enableDebug: boolean;
  
  // Build Configuration
  buildTarget: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Authentication (testing only)
  testUsername?: string;
  testPassword?: string;
  
  // External Services
  sentryDsn?: string;
  gaTrackingId?: string;
}
```

#### Environment Variable Helper Functions

The configuration system includes several helper functions for different data types:

##### 1. **getRequiredEnv(key: string, fallback?: string)**
- Throws error if variable is missing and no fallback provided
- Returns fallback value if variable is missing
- Used for critical configuration values

##### 2. **getOptionalEnv(key: string, defaultValue?: string)**
- Returns `undefined` if variable is missing
- Returns `defaultValue` if provided
- Used for optional configuration values

##### 3. **getBooleanEnv(key: string, defaultValue: boolean = false)**
- Converts string values to boolean
- Accepts `'true'`, `'1'` as truthy values
- Returns `defaultValue` if variable is missing

##### 4. **getNumberEnv(key: string, defaultValue: number)**
- Converts string values to numbers
- Returns `defaultValue` if conversion fails
- Handles NaN cases gracefully

#### Environment Variables

##### Required Environment Variables
```bash
# API Configuration
VITE_API_BASE_URL=https://chatbackend.yourfinadvisor.com
VITE_API_VERSION=v1

# Application Configuration
VITE_APP_BASE_PATH=/chataiagent
VITE_APP_NAME=WealthAI Agent
VITE_APP_PORT=5173
```

##### Optional Environment Variables
```bash
# Feature Flags
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=false

# Build Configuration
VITE_BUILD_TARGET=production

# Authentication (testing only)
VITE_TEST_USERNAME=testuser
VITE_TEST_PASSWORD=***

# External Services
VITE_SENTRY_DSN=your_sentry_dsn_here
VITE_GA_TRACKING_ID=your_ga_tracking_id_here
```

#### Usage in Application

##### 1. **Direct Access**
```typescript
import { env } from '@/config/environment';

// Access configuration values
const apiUrl = env.apiBaseUrl;
const isDebug = env.enableDebug;
const appName = env.appName;
```

##### 2. **API URL Construction**
```typescript
import { getApiUrl } from '@/config/environment';

// Construct API URLs
const chatEndpoint = getApiUrl('/chats');
const authEndpoint = getApiUrl('/auth/token');

// Results in:
// https://chatbackend.yourfinadvisor.com/api/v1/chats
// https://chatbackend.yourfinadvisor.com/api/v1/auth/token
```

##### 3. **App URL Construction**
```typescript
import { getAppUrl } from '@/config/environment';

// Construct app URLs
const chatUrl = getAppUrl('/chat/123');
const newChatUrl = getAppUrl('/new');

// Results in:
// /chataiagent/chat/123
// /chataiagent/new
```

#### Environment File Setup

##### 1. **Development Environment (.env.local)**
```bash
# Copy from example
cp config/env.example .env.local

# Edit with your values
nano .env.local
```

##### 2. **Production Environment (.env.production)**
```bash
# Copy from example
cp config/env.production.example .env.production

# Edit with production values
nano .env.production
```

##### 3. **Environment Validation**
```bash
# Check environment configuration
npm run env:check
```

#### Configuration Features

##### 1. **Type Safety**
- Full TypeScript support
- Compile-time validation
- IntelliSense support

##### 2. **Validation**
- Required variable checking
- Type conversion validation
- Fallback value support

##### 3. **Debug Support**
- Development mode logging
- Configuration validation
- Sensitive value masking

##### 4. **Build Integration**
- Vite environment variable support
- Build-time configuration
- Environment-specific builds

#### Environment Variable Naming Convention

All environment variables must be prefixed with `VITE_` to be accessible in the browser:

- ✅ `VITE_API_BASE_URL` - Accessible in browser
- ❌ `API_BASE_URL` - Not accessible in browser (server-side only)

#### Security Considerations

##### 1. **Sensitive Data**
- Never expose sensitive data in `VITE_` prefixed variables
- Use server-side environment variables for secrets
- Mask sensitive values in debug output

##### 2. **Client-Side Exposure**
- All `VITE_` variables are bundled into the client
- Assume all client-side variables are public
- Use server-side validation for sensitive operations

##### 3. **Default Values**
- Provide secure defaults for all variables
- Avoid hardcoded sensitive values
- Use fallbacks for non-critical configuration

#### Development Workflow

##### 1. **Local Development**
```bash
# Initialize environment
npm run env:init

# Start development server
npm run dev
```

##### 2. **Environment Validation**
```bash
# Check configuration
npm run env:check

# View current configuration
npm run env:debug
```

##### 3. **Production Deployment**
```bash
# Build with production environment
npm run build

# Deploy with environment variables
npm run deploy:production
```

#### Troubleshooting

##### 1. **Missing Variables**
- Check variable names (case-sensitive)
- Verify `VITE_` prefix
- Check file location and naming

##### 2. **Type Conversion Issues**
- Verify boolean values (`'true'`, `'false'`)
- Check number format
- Validate string values

##### 3. **Build Issues**
- Clear build cache
- Restart development server
- Check environment file syntax

#### Best Practices

##### 1. **Variable Organization**
- Group related variables
- Use descriptive names
- Document variable purposes

##### 2. **Default Values**
- Provide sensible defaults
- Use environment-specific defaults
- Document fallback behavior

##### 3. **Validation**
- Validate critical variables
- Provide helpful error messages
- Test configuration loading

##### 4. **Documentation**
- Document all variables
- Provide examples
- Update when adding new variables

### Caching Strategy

#### 1. Token Caching
- JWT tokens cached in sessionStorage
- Automatic cleanup on logout

#### 2. Chat History Caching
- Recent chats cached in Zustand store
- Automatic cleanup on navigation

#### 3. File Caching with IndexedDB
- **Local File Storage**: Files cached in IndexedDB for instant previews
- **Cache-First Strategy**: Check local cache before backend fetch
- **Smart Eviction**: LRU (Least Recently Used) eviction with size limits
- **Automatic Cleanup**: 7-day expiration with automatic cleanup
- **Memory Management**: Proper blob URL cleanup prevents memory leaks
- **Seamless Integration**: Works with existing backend without changes

#### 4. Granular Loading States
- **Smart UI Controls**: Only disables conflicting actions during operations
- **User Experience**: Users can continue typing while files upload
- **Clear Feedback**: Tooltips explain why actions are disabled
- **Performance**: Reduces perceived loading time through better UX

### Future Enhancements

#### 1. Implemented but Not Connected
- Chat rename functionality (API endpoint exists but not connected)
- Chat deletion functionality (API endpoint exists but not connected)

#### 2. Planned Features
- Real-time chat notifications
- File sharing between users
- Advanced search functionality
- Export chat history
- **File Caching Enhancements**:
  - Cache compression for large files
  - Background sync for offline support
  - Cache warming strategies
  - Analytics and usage tracking
  - Custom cache policies per file type

### Troubleshooting

#### Common Issues

1. **Authentication Failures**
   - Check JWT token validity
   - Verify API endpoint configuration
   - Check network connectivity

2. **File Upload Issues**
   - Verify file size limits
   - Check file type restrictions
   - Ensure proper authentication

3. **SSE Stream Issues**
   - Check browser compatibility
   - Verify network stability
   - Monitor connection status

4. **State Management Issues**
   - Check Zustand store updates
   - Verify component re-rendering
   - Monitor memory usage

5. **File Caching Issues**
   - Check IndexedDB support in browser
   - Verify cache size limits (100MB)
   - Monitor blob URL cleanup
   - Check for memory leaks in file previews

---

## Code Quality Improvements

### Recent Refactoring and Quality Enhancements

The project has undergone significant code quality improvements to enhance maintainability, testability, and developer experience.

#### 1. **Component Refactoring**

##### ChatWindow Component Refactoring
- **Before**: 425 lines of complex, monolithic component
- **After**: ~200 lines with 4 focused custom hooks (53% reduction)
- **Benefits**:
  - Improved readability and maintainability
  - Better separation of concerns
  - Enhanced testability
  - Easier debugging and development

##### Custom Hooks Created
- **`useChatWindowState`**: Centralized state management
- **`useChatHistory`**: Chat history loading logic
- **`usePendingMessage`**: Pending message processing
- **`useMessageSending`**: Message sending and streaming

#### 2. **Linting and Code Standards**

##### ESLint Improvements
- **Warnings Reduced**: From 16 to 6 (62% reduction)
- **Issues Fixed**:
  - Unused variables and imports
  - Missing React Hook dependencies
  - Fast refresh warnings
  - TypeScript strict mode compliance

##### Code Quality Metrics
- **Maintainability**: Significantly improved through hook composition
- **Readability**: Complex logic broken into focused, single-purpose functions
- **Testability**: Isolated logic makes unit testing easier
- **Reusability**: Custom hooks can be reused across components

#### 3. **Testing Infrastructure**

##### Test Coverage Improvements
- **Current Coverage**: 6.87% (improved from 6.28%)
- **Target Coverage**: 70% (infrastructure in place)
- **Tests Added**:
  - Page component tests (Index, NotFound)
  - Utility function tests
  - Component integration tests
  - Custom hook tests

##### Testing Best Practices
- **Mock Handlers**: Comprehensive API mocking
- **Test Utilities**: Reusable test helpers
- **Component Testing**: React Testing Library integration
- **Hook Testing**: Custom hook testing patterns

#### 4. **Architecture Patterns**

##### Design Pattern Enhancements
- **Single Responsibility Principle**: Each hook handles one concern
- **Separation of Concerns**: UI logic separated from business logic
- **Hook Composition**: Complex components broken into focused hooks
- **State Colocation**: State management close to usage

##### Code Organization
- **Component Structure**: Clear hierarchy and responsibilities
- **Hook Organization**: Global hooks vs component-specific hooks
- **File Structure**: Logical grouping and naming conventions
- **Import Management**: Clean import statements and dependencies

#### 5. **Performance and Maintainability**

##### Performance Benefits
- **Reduced Re-renders**: Better state management through focused hooks
- **Memory Management**: Proper cleanup in custom hooks
- **Bundle Size**: No significant impact, improved tree-shaking potential
- **Development Experience**: Faster debugging and development
- **File Caching**: Instant file previews through IndexedDB caching
- **Granular Loading States**: Better perceived performance through smart UI controls

##### Maintainability Benefits
- **Easier Debugging**: Isolated logic is easier to trace
- **Simpler Testing**: Focused hooks are easier to test
- **Better Documentation**: Clear separation makes code self-documenting
- **Future Development**: Easier to add new features and modifications
- **File Caching System**: Centralized caching logic with clear separation of concerns
- **Granular State Management**: Easier to understand and modify loading states

#### 6. **Development Workflow**

##### Quality Assurance Process
- **Automated Linting**: ESLint integration with pre-commit hooks
- **Test Automation**: Jest integration with coverage reporting
- **Code Review**: Improved review process with focused changes
- **Documentation**: Updated documentation reflecting architectural changes

##### Developer Experience
- **Type Safety**: Full TypeScript integration maintained
- **IntelliSense**: Better IDE support with focused hooks
- **Error Handling**: Improved error boundaries and handling
- **Debugging**: Better debugging experience with isolated logic

### Future Quality Improvements

#### Planned Enhancements
1. **Test Coverage Expansion**: Reach 70% coverage target
2. **Error Handling**: Enhanced error boundaries and user feedback
3. **Performance Optimization**: Identify and fix performance bottlenecks
4. **Accessibility**: Improve accessibility compliance
5. **Documentation**: Expand inline documentation and examples
6. **File Caching Improvements**: 
   - Cache compression for large files
   - Background sync for offline support
   - Cache warming strategies
   - Analytics and usage tracking
   - Custom cache policies per file type

#### Quality Metrics
- **Code Complexity**: Reduced through hook composition
- **Maintainability Index**: Improved through separation of concerns
- **Technical Debt**: Reduced through refactoring and cleanup
- **Developer Productivity**: Enhanced through better code organization
- **File Caching Performance**: Instant file previews improve user experience
- **Memory Management**: Proper cleanup and eviction strategies prevent memory leaks
- **Cache Hit Rate**: High cache hit rates reduce backend load and improve performance

---

## Mock SSE Service

### Overview

The application includes a comprehensive mock SSE service for testing widget-based chat responses without backend dependencies. This enables rapid frontend development, testing, and demonstrations.

### Features

- **Zero Backend Dependencies**: No API calls during mock mode
- **6 Financial Scenarios**: Portfolio analysis, SIP explanations, compound interest, etc.
- **4 Widget Types**: Pie charts, bar charts, line charts, data tables
- **Realistic Streaming**: Word-by-word text streaming with widgets
- **Ordered Content**: Text and widgets interleaved in stream order
- **shadcn/ui Components**: Beautiful, interactive visualizations

### Mock Service Architecture

**Trigger Mechanism:**
- Suggestion tiles have optional `useMockService: true` flag
- Creates mock chat ID (`mock-{timestamp}`)
- Routes to `listenToMockChatStream` instead of real backend
- Generates contextual responses based on prompt keywords

**Widget Integration:**
- Widgets appear inline with text (not at the bottom)
- Content blocks preserve SSE stream order
- Text streams continuously before and after widgets
- Each text segment gets its own bubble

**File Location:** `src/services/mock-sse-service.ts`

### Supported Scenarios

1. **Portfolio Allocation** - Pie chart showing asset breakdown
2. **Performance Analysis** - Bar chart with 6-month growth
3. **Top Holdings** - Data table with stock positions
4. **SIP Explanation** - Line chart showing systematic investment growth
5. **Mutual Fund Comparison** - Bar chart comparing fund categories
6. **Compound Interest** - Line chart showing exponential growth

### Usage Example

```typescript
// Add to suggestion tiles
const tiles = [
  {
    id: 1,
    title: "Show my portfolio",
    description: "View breakdown",
    useMockService: true, // ← Enable mock service
  }
];
```

### Documentation

- **Complete Guide**: See `MOCK_SERVICE_GUIDE.md`
- **Widget Details**: See `ALL_WIDGETS_SUMMARY.md`
- **Streaming Fix**: See `STREAMING_FIX.md`

---

## Conclusion

This PWA provides a comprehensive chat interface with AI integration, file handling, and real-time communication. The frontend architecture is designed for scalability, maintainability, and user experience. The component structure follows React best practices with clear separation of concerns, and the API integration is robust with comprehensive error handling. The file caching system provides instant previews through IndexedDB storage, while granular loading states ensure a smooth user experience during file operations. The mock SSE service enables rapid development and testing of widget-based responses without backend dependencies.

### Key Architecture Highlights

1. **Modular Component Design**: Clear separation between UI, business logic, and state management
2. **Custom Hooks Pattern**: Reusable business logic extracted into hooks
3. **Zustand State Management**: Lightweight and efficient state management
4. **TypeScript Integration**: Full type safety throughout the application
5. **PWA Capabilities**: Offline support and app-like experience
6. **Real-time Features**: SSE streaming for AI responses
7. **File Handling with Caching**: Secure file upload, instant previews, and local caching
8. **Responsive Design**: Mobile-first approach with Tailwind CSS
9. **Code Quality**: Comprehensive linting, testing, and refactoring for maintainability
10. **Separation of Concerns**: Complex components broken down into focused, single-purpose hooks
11. **File Caching System**: IndexedDB-based local caching for instant file previews
12. **Granular Loading States**: Smart UI controls that only disable conflicting actions
13. **Cache-First Strategy**: Local caching with seamless backend fallback
14. **Memory Management**: Proper cleanup and eviction strategies for optimal performance

For additional information, refer to the source code in the respective component files and the test implementations for usage examples.

## File Caching System Documentation

### Overview
The file caching system provides instant file previews through IndexedDB storage, significantly improving user experience by eliminating loading delays for previously viewed files.

### Key Components
- **FileCacheService** (`src/services/file-cache.ts`): IndexedDB-based storage service
- **useCachedFile** (`src/hooks/use-cached-file.ts`): React hook for seamless file fetching
- **Integration**: Used in `file-renderer.tsx`, `file-preview-modal.tsx`, and `chat-input.tsx`

### Features
- **Instant Previews**: Files cached after first load for instant subsequent views
- **Smart Cache Management**: 100MB limit with LRU eviction and 7-day expiration
- **Seamless Fallback**: Cache miss → backend fetch → cache result
- **Memory Management**: Proper blob URL cleanup prevents memory leaks
- **No Backend Changes**: Works with existing backend integration

### Usage
```tsx
import { useCachedFile } from '@/hooks/use-cached-file';

function MyFileComponent({ file }) {
  const { token } = useJwtToken();
  const { blobUrl, isLoading, error } = useCachedFile(file, token);
  
  if (error) return <ErrorComponent />;
  if (isLoading) return <LoadingComponent />;
  
  return <img src={blobUrl} alt={file.name} />;
}
```

### Performance Benefits
- **Instant Previews**: Previously viewed files load instantly
- **Reduced Network Usage**: Files only fetched once from backend
- **Better Perceived Performance**: Smooth, responsive interface
- **Memory Efficient**: Automatic cleanup prevents memory leaks
