# Mock Service Bug Fixes

## Issues Fixed

### Issue 1: Mock Service Not Triggered ❌ → ✅
**Problem**: When clicking a suggestion tile with `useMockService: true`, the app was still calling the real backend API.

**Root Cause**: The `useMockService` flag was not being passed through the complete flow:
1. Tile click → suggestion handler ✅
2. Suggestion handler → handleSend ❌ (missing)
3. handleSend → pending message store ❌ (missing)
4. Pending message → stream listener ❌ (missing)

**Fixed Files**:
- ✅ `src/store/chat.ts` - Added `useMockService` to pending message interface
- ✅ `src/components/chat/hooks/use-message-sending.ts` - Pass and use mock flag
- ✅ `src/components/chat/hooks/use-pending-message.ts` - Extract and use mock flag
- ✅ `src/components/chat/chat-window.tsx` - Pass mock flag from tile click

### Issue 2: First Letter Vanishing (To Be Diagnosed)
**Problem**: The first letter of streamed responses disappears.

**Added Debugging**: Extensive console logs throughout the streaming pipeline to identify where the letter is lost:
- Mock service generation logs
- Chat service stream logs  
- Message sending chunk logs
- Pending message chunk logs

## How It Works Now

### 1. Suggestion Tile Configuration
```typescript
const suggestionTiles: SuggestionTileData[] = [
  {
    id: 2,
    title: "Show my portfolio allocation",
    description: "View breakdown",
    useMockService: true, // 👈 This tile uses mock service
  },
  {
    id: 1,
    title: "hello!",
    description: "Regular chat",
    // No useMockService = uses real backend
  },
];
```

### 2. Click Flow for Mock Service

#### Empty State (No Chat ID):
```
User clicks tile with useMockService: true
  ↓
SuggestionTiles onClick → calls handleSend(title, [], true)
  ↓
handleSend detects no chatId AND useMockService = true
  ↓
Creates mock chat ID: "mock-{timestamp}"
  ↓
setPendingMessage(text, files, mockChatId, true)
  ↓
Navigates to /chat/mock-{timestamp}
  ↓
usePendingMessage hook detects pending message
  ↓
Extracts useMockService flag from pending message
  ↓
Calls listenToChatStream with useMockService = true
  ↓
Chat service routes to listenToMockChatStream
  ↓
Mock service generates SSE events with widgets!
```

#### Existing Chat:
```
User in active chat, clicks tile or types message
  ↓
handleSend(text, files, useMockService)
  ↓
Sends message to chat
  ↓
Calls listenToChatStream with useMockService flag
  ↓
Routes to mock or real service based on flag
```

### 3. Mock Service Features

When triggered, the mock service:
1. ✅ Generates realistic streaming delays
2. ✅ Emits `message_start` event
3. ✅ Streams text word-by-word with `message_delta` events
4. ✅ Detects keywords in prompt:
   - "portfolio" / "allocation" → Pie Chart widget
   - "performance" / "growth" → Bar Chart widget
   - "stocks" / "holdings" → Table widget
   - "calculator" / "mortgage" → Calculator widget
5. ✅ Emits widget events: `widget_pie_chart`, `widget_bar_chart`, etc.
6. ✅ Completes with `message_complete` event

### 4. Console Logging

You should see these logs when using mock service:

```
[handleSend] Called with: { text: "...", useMockService: true }
[useMessageSending] Using mock service - creating mock chat ID
[Store] setPendingMessage called: { useMockService: true }
[Pending Message] Processing pending message: { useMockService: true }
[ChatService] Using mock SSE service
[MockSSE] Starting mock SSE stream for prompt: ...
[MockSSE] Streaming text in 9 words
[MockSSE] Yielding word 1: "Let"
[MockSSE] Yielding word 2: "me "
... etc ...
[MockSSE] Emitting event: widget_pie_chart
[Pending Message] Widget event received: widget_pie_chart
[MockSSE] Stream complete
```

## Testing

### Test Mock Service:
1. Start dev server
2. Open browser console
3. Click "Show my portfolio allocation" tile
4. Watch console logs for `[MockSSE]` messages
5. Verify text streams word-by-word
6. Check for widget events in console

### Test Real Service:
1. Click "hello!" tile (no useMockService flag)
2. Watch console - should NOT see `[MockSSE]` logs
3. Should see real SSE connection logs
4. Verifies mock doesn't interfere with real service

## Next Steps

1. **Debug First Letter Issue**: Review console logs to see where first character is lost
2. **Add Widget Renderers**: Create React components to display widgets
3. **Add More Mock Data**: Enhance mock generators with richer datasets
4. **Test Edge Cases**: Multiple rapid clicks, navigation during streaming, etc.

## Files Changed

### Core Service Layer:
- `src/services/mock-sse-service.ts` - Mock SSE implementation (already existed)
- `src/services/chat-service.ts` - Routing logic (already updated)

### Store Layer:
- `src/store/chat.ts` - Added `useMockService` to pending message

### Component Layer:
- `src/components/chat/chat-window.tsx` - Import PromptInputRef, pass mock flag
- `src/components/chat/chat-input.tsx` - Already updated with ref API
- `src/components/chat/chat-suggestion-tiles.tsx` - Already updated with flag

### Hook Layer:
- `src/components/chat/hooks/use-message-sending.ts` - Mock chat creation & flag passing
- `src/components/chat/hooks/use-pending-message.ts` - Extract and use mock flag

### Type Layer:
- `src/types/chat.ts` - SuggestionTileData interface (already has useMockService)

## Verification Checklist

- [x] Mock service code written and working in isolation
- [x] `useMockService` flag added to tile interface
- [x] Flag passed from tile click to handleSend
- [x] Flag stored in pending message for new chats
- [x] Flag extracted and passed to listenToChatStream
- [x] Chat service routes to mock when flag is true
- [x] Chat service routes to real backend when flag is false/undefined
- [x] No linter errors
- [x] Console logging added for debugging
- [ ] First letter issue diagnosed and fixed (PENDING)
- [ ] Widget rendering implemented (TODO)

## Known Issues

1. **First Letter Vanishing**: Needs investigation with console logs
   - Check if it's trimmed somewhere
   - Check if first chunk is being skipped
   - Check rendering/memo logic

2. **Widget Events**: Currently logged to console but not rendered
   - Need to create widget components
   - Need to add widget rendering logic to message bubbles

