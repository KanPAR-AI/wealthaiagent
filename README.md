# YourFinAdvisor

A modular, type-safe chat interface with AI response generation capabilities, similar to ChatGPT. Built with React, TypeScript, and Vite for fast development and optimal performance.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Component Structure](#component-structure)
- [State Management](#state-management)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Production Build](#production-build)
- [Code Documentation](#code-documentation)
  - [Core Components](#core-components)
  - [Custom Hooks](#custom-hooks)
  - [Services](#services)
  - [Types](#types)
- [Testing](#testing)
- [Deployment](#deployment)

## Features

- Real-time chat interface with message history
- AI response generation with structured content (tables, graphs)
- File upload and preview capabilities
- Message actions (copy, regenerate, like/dislike)
- Responsive design with dark/light mode support
- Clerk authentication integration
- Zustand state management
- TypeScript type safety

## Architecture

```
src/
├── components/
│   ├── chat/                # Chat-specific components
│   ├── ui/                  # UI primitives (shadcn)
├── hooks/                   # Custom React hooks
├── services/                # Business logic/services
├── store/                   # Zustand store
├── types/                   # TypeScript types
├── utils/                   # Utility functions
└── main.tsx                 # Application entry point
```

## Component Structure

### Main Components
- `ChatWindow`: Root component managing chat session
- `ChatMessageList`: Renders message bubbles
- `ChatBubble`: Individual message UI
- `PromptInputWithActions`: Message input with attachments
- `SuggestionTiles`: Suggested prompts for new chats
- `ImageModal`: Full-screen image preview

## State Management

Uses Zustand for global state management with these key stores:
- `useChatStore`: Manages chat messages and sessions
- `useUIStore`: Manages UI state (modals, themes)

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm
- Clerk account (for authentication)
- Vite 5+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo/react-vite-chat.git
cd react-vite-chat
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Create `.env` file:
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_BASE_URL=http://localhost:5173
```

### Development

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

### Production Build

1. Build the application:
```bash
npm run build
# or
yarn build
# or
pnpm build
```

2. Start production server:
```bash
npm run start
# or
yarn start
# or
pnpm start
```

## Code Documentation

### Core Components

#### `ChatWindow`
The main chat interface component that orchestrates:
- Chat session management
- Message sending/receiving
- AI response generation
- User authentication

**Props:**
```typescript
interface ChatWindowProps {
  chatId?: string;             // Existing chat ID
  onNewChatCreated?: (id: string) => void; // Callback for new chats
  className?: string;          // Additional CSS classes
}
```

#### `ChatMessageList`
Displays a list of chat messages with actions.

**Props:**
```typescript
interface ChatMessageListProps {
  messages: Message[];         // Array of messages
  currentUser?: UserInfo;      // Current user data
  onImageClick: (url: string) => void; // Image click handler
  actionIcons?: ActionIconDefinition[]; // Message action icons
}
```

#### `ChatBubble`
Individual message component with sender-specific styling.

**Props:**
```typescript
interface ChatBubbleProps {
  message: Message;            // Message data
  currentUser?: UserInfo;      // Current user info
  onImageClick: (url: string) => void; // Image click handler
  actionIcons?: ActionIconDefinition[]; // Action buttons
}
```

#### `PromptInputWithActions`
Message input component with file attachment support.

**Props:**
```typescript
interface PromptInputWithActionsProps {
  onSendMessage: (text: string, files: File[]) => void;
  disabled?: boolean;          // Input disabled state
  placeholder?: string;        // Input placeholder text
}
```

### Custom Hooks

#### `useChatMessages`
Manages chat message state and cleanup.

**Methods:**
- `addMessage`: Adds new message with cleanup
- `revokeFileObjectURLs`: Cleans up file URLs

**Usage:**
```typescript
const { messages, addMessage, revokeFileObjectURLs } = useChatMessages();
```

#### `useMessageActions`
Handles all message interactions.

**Methods:**
- `handleCopy`: Copies message text
- `handleRegenerate`: Regenerates AI response
- `handleLike/Dislike`: Feedback actions

**Usage:**
```typescript
const { handleCopy, handleRegenerate, handleLike } = useMessageActions();
```

### Services

#### `aiService`
Generates simulated AI responses with structured data.

**Methods:**
```typescript
function generateAiResponse(
  userText: string,
  files: MessageFile[]
): Promise<AiResponse>
```

**Returns:**
- Text responses
- Structured data (tables, graphs)
- File analysis results

### Types

Key TypeScript interfaces:

```typescript
interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  files?: MessageFile[];
  structuredContent?: AiContent;
  timestamp?: Date;
}

interface MessageFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

interface AiContent {
  type: 'table' | 'graph' | 'text';
  data: AiTableContent | AiGraphContent | string;
}

interface AiTableContent {
  headers: string[];
  rows: string[][];
  title?: string;
}

interface AiGraphContent {
  type: 'line' | 'bar' | 'pie';
  data: any;
  title?: string;
}
```

## Testing

Run tests with:
```bash
npm test
# or
yarn test
# or
pnpm test
```

Test coverage includes:
- Component rendering
- Hook behavior
- State management
- AI service responses

### Test Structure
```
__tests__/
├── components/
├── hooks/
├── services/
└── utils/
```

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub/GitLab
2. Import project in Vercel dashboard
3. Set environment variables in Vercel settings
4. Deploy automatically on push

### Manual Deployment
1. Build the application:
```bash
npm run build
```

2. Preview the production build locally:
```bash
npm run preview
```

3. Deploy the `dist` folder to your hosting provider

### Docker
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host"]
```

```bash
docker build -t react-vite-chat .
docker run -p 4173:4173 react-vite-chat
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `VITE_BASE_URL` | Application base URL | Yes |

## Vite Configuration

This project uses Vite with the following plugins:
- `@vitejs/plugin-react` - Fast Refresh with Babel
- TypeScript support out of the box
- Hot Module Replacement (HMR)

### ESLint Configuration

For production applications, consider updating ESLint configuration to enable type-aware lint rules:

```js
// eslint.config.js
import tseslint from 'typescript-eslint'

export default tseslint.config({
  extends: [
    ...tseslint.configs.recommendedTypeChecked,
    // For stricter rules
    ...tseslint.configs.strictTypeChecked,
    // For stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json', './tsconfig.node.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

For React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
