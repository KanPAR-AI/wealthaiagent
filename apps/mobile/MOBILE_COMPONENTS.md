# Mobile Components Integration

This document describes the mobile components that have been integrated with the web components structure for the YourFinAdvisor mobile app.

## Overview

The mobile app now includes a complete set of chat components that mirror the functionality of the web version while maintaining native mobile UX patterns.

## Components

### 1. ChatWindow (`chat-window.tsx`)
- **Purpose**: Main chat interface component
- **Features**: 
  - Message handling and streaming
  - File upload support
  - Chat session management
  - Integration with web hooks and services
- **Integration**: Uses the same hooks and services as web version

### 2. PromptInput (`prompt-input.tsx`)
- **Purpose**: Text input with file upload and voice recording
- **Features**:
  - Text input with multiline support
  - File attachment (documents and images)
  - Voice recording (placeholder for future implementation)
  - Send button with loading states
- **Integration**: Compatible with web message handling

### 3. MessageList (`message-list.tsx`)
- **Purpose**: Displays chat messages with pull-to-refresh
- **Features**:
  - Scrollable message list
  - Pull-to-refresh functionality
  - Proper spacing for mobile input
- **Integration**: Uses same message structure as web

### 4. ChatBubble (`chat-bubble.tsx`)
- **Purpose**: Individual message display
- **Features**:
  - User/bot message styling
  - File attachment display
  - Timestamp display
  - Message actions integration
- **Integration**: Compatible with web message types

### 5. MessageActions (`message-actions.tsx`)
- **Purpose**: Message interaction buttons
- **Features**:
  - Copy, like, dislike, regenerate actions
  - Expandable action menu
  - Loading states for actions
- **Integration**: Uses same action handlers as web

### 6. SuggestionTiles (`suggestion-tiles.tsx`)
- **Purpose**: Quick start suggestion buttons
- **Features**:
  - Horizontal scrollable suggestions
  - Touch-friendly button sizes
  - Consistent with web suggestion data
- **Integration**: Uses same suggestion data structure

### 7. ChatEmptyState (`chat-empty-state.tsx`)
- **Purpose**: Welcome screen for new users
- **Features**:
  - Welcome message and instructions
  - Consistent branding with web
- **Integration**: Same content structure as web

### 8. AiLoadingIndicator (`ai-loading-indicator.tsx`)
- **Purpose**: Shows when AI is processing
- **Features**:
  - Native loading spinner
  - Status text
- **Integration**: Same loading states as web

### 9. ChatLoadingSkeleton (`chat-loading-skeleton.tsx`)
- **Purpose**: Loading placeholder for chat
- **Features**:
  - Skeleton UI for messages
  - Input area skeleton
- **Integration**: Same loading patterns as web

### 10. FileRenderer (`file-renderer.tsx`)
- **Purpose**: File attachment display
- **Features**:
  - File type icons
  - File size and type info
  - Image previews
  - Touch interaction
- **Integration**: Same file handling as web

## Dependencies Added

The following Expo packages were added to support the mobile components:

- `expo-document-picker`: File selection
- `expo-file-system`: File operations
- `expo-image-picker`: Image selection
- `expo-linear-gradient`: Gradient effects

## Integration Points

### Hooks
- `useChatMessages`: Message state management
- `useChatSession`: Chat session handling
- `useJwtToken`: Authentication
- `useMessageActions`: Message interactions
- `useChatStore`: Global chat state

### Services
- `chat-service`: Chat API integration
- File upload and streaming

### Types
- `@wealthwise/types`: Shared type definitions
- Message, MessageFile, SuggestionTileData interfaces

## Usage

The components are designed to work together seamlessly:

```tsx
import ChatWindow from '../components/chat/chat-window';

export default function App() {
  return (
    <ChatWindow 
      chatId={chatId}
      className="flex-1"
    />
  );
}
```

## Mobile-Specific Features

1. **Touch Interactions**: All components use TouchableOpacity for proper touch feedback
2. **Keyboard Handling**: KeyboardAvoidingView prevents input overlap
3. **Native Components**: Uses React Native components optimized for mobile
4. **Responsive Design**: Tailwind classes adapted for mobile screens
5. **File Handling**: Native file picker and image selection
6. **Pull-to-Refresh**: Native refresh control for message list

## Future Enhancements

1. **Voice Recording**: Implement actual voice recording with expo-av
2. **File Preview**: Add file preview modal for documents
3. **Push Notifications**: Chat notifications
4. **Offline Support**: Message caching and offline functionality
5. **Biometric Auth**: Touch ID/Face ID integration

## Testing

To test the mobile components:

1. Install dependencies: `pnpm install`
2. Start the development server: `pnpm start`
3. Run on device or simulator: `pnpm android` or `pnpm ios`

## Notes

- All components use NativeWind (Tailwind CSS for React Native)
- Components maintain the same API as web versions where possible
- Mobile-specific UX patterns are implemented while keeping functionality consistent
- Error handling and loading states match web behavior
