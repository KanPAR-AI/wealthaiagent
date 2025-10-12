# Mock SSE Service Usage Guide

This guide explains how to use the mock SSE (Server-Sent Events) service for testing widget functionality without a backend.

## Overview

The mock SSE service allows you to test streaming responses with widget events (charts, tables, calculators) by triggering them through specific suggestion tiles or prompts.

## Architecture

### Files Modified/Created:
1. **`src/services/mock-sse-service.ts`** - Main mock service with widget generators
2. **`src/services/chat-service.ts`** - Updated to conditionally route to mock service
3. **`src/components/chat/chat-suggestion-tiles.tsx`** - Added `useMockService` flag to tiles
4. **`src/components/chat/chat-input.tsx`** - Updated to handle and pass mock service flag

## How to Use

### 1. Create Suggestion Tiles with Mock Flag

In your parent component where you define suggestion tiles:

```typescript
const suggestionTiles = [
  {
    id: 1,
    title: "Show my portfolio allocation",
    description: "View asset distribution",
    useMockService: true, // 👈 Enable mock service for this tile
  },
  {
    id: 2,
    title: "View performance history",
    description: "Monthly growth chart",
    useMockService: true, // 👈 Enable mock service for this tile
  },
  {
    id: 3,
    title: "List my holdings",
    description: "Top stocks and values",
    useMockService: true, // 👈 Enable mock service for this tile
  },
  {
    id: 4,
    title: "Calculate mortgage",
    description: "Mortgage payment calculator",
    useMockService: true, // 👈 Enable mock service for this tile
  },
  {
    id: 5,
    title: "Regular question",
    description: "Uses real backend",
    // No useMockService flag = uses real backend
  },
];
```

### 2. Handle Tile Clicks in Parent Component

```typescript
const chatInputRef = useRef<PromptInputRef>(null);

const handleSuggestionClick = (title: string, useMockService?: boolean) => {
  console.log('[Parent] Suggestion clicked:', { title, useMockService });
  
  // Set the input with the mock flag
  if (chatInputRef.current) {
    chatInputRef.current.setInputWithMockFlag(title, useMockService || false);
  }
};

// In your JSX:
<SuggestionTiles 
  tiles={suggestionTiles}
  onSuggestionClick={handleSuggestionClick}
  disabled={isLoading}
/>

<PromptInputWithActions
  ref={chatInputRef}
  onSubmit={handleSubmit}
  isLoading={isLoading}
/>
```

### 3. Update Your Submit Handler

```typescript
const handleSubmit = async (
  text: string, 
  attachments: MessageFile[], 
  useMockService?: boolean
) => {
  console.log('[Parent] Submitting message:', { text, useMockService });
  
  // ... your existing chat creation/message sending logic ...
  
  // When listening to the stream, pass the mock flag:
  await listenToChatStream(
    jwt,
    chatId,
    onMessageChunk,
    onComplete,
    onError,
    useMockService || false, // 👈 Pass the flag
    text // 👈 Pass the prompt for contextual mock responses
  );
};
```

## Widget Event Types

The mock service generates different widgets based on prompt keywords:

### Pie Chart
**Trigger keywords:** `portfolio`, `allocation`
```typescript
{
  type: 'widget_pie_chart',
  widget: {
    id: 'unique-id',
    title: 'Portfolio Allocation',
    data: {
      labels: ['Stocks', 'Bonds', 'Real Estate', 'Cash', 'Crypto'],
      values: [45, 25, 15, 10, 5],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899']
    },
    sourceUrl: '/api/portfolio/allocation'
  }
}
```

### Bar Chart
**Trigger keywords:** `performance`, `growth`
```typescript
{
  type: 'widget_bar_chart',
  widget: {
    id: 'unique-id',
    title: 'Monthly Performance',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Portfolio Value',
        values: [45000, 47500, 46800, 51000, 53200, 55800],
        color: '#3b82f6'
      }]
    },
    sourceUrl: '/api/portfolio/performance'
  }
}
```

### Table
**Trigger keywords:** `stocks`, `holdings`
```typescript
{
  type: 'widget_table',
  widget: {
    id: 'unique-id',
    title: 'Top Holdings',
    data: {
      headers: ['Symbol', 'Name', 'Shares', 'Value', 'Change'],
      rows: [
        ['AAPL', 'Apple Inc.', '50', '$8,750', '+2.3%'],
        ['MSFT', 'Microsoft Corp.', '30', '$11,250', '+1.8%'],
        // ... more rows
      ]
    },
    sourceUrl: '/api/portfolio/holdings'
  }
}
```

### Calculator
**Trigger keywords:** `calculator`, `mortgage`
```typescript
{
  type: 'widget_calculator',
  widget: {
    id: 'unique-id',
    title: 'Mortgage Calculator',
    config: {
      type: 'mortgage',
      fields: [
        { name: 'loanAmount', label: 'Loan Amount', type: 'currency', default: 300000 },
        { name: 'interestRate', label: 'Interest Rate (%)', type: 'percentage', default: 4.5 },
        { name: 'loanTerm', label: 'Loan Term (years)', type: 'number', default: 30 }
      ]
    }
    // No sourceUrl - calculator is frontend-only
  }
}
```

## Event Flow

The mock service follows the same SSE event structure as the real backend:

1. **message_start** - Signals the start of a new message
2. **message_delta** (multiple) - Streams text chunks word by word
3. **widget_*** - Emits widget data (pie_chart, bar_chart, table, calculator)
4. **message_delta** (multiple) - Continues streaming text after widgets
5. **message_complete** - Signals the end of the message

## Handling Widget Events

In your message chunk handler, check for widget event types:

```typescript
const onMessageChunk = (chunk: string, type: string) => {
  if (type === 'text_chunk') {
    // Append text to message
    setStreamingMessage(prev => prev + chunk);
  } 
  else if (type.startsWith('widget_')) {
    // Parse and render widget
    const widgetData = JSON.parse(chunk);
    setWidgets(prev => [...prev, { type, ...widgetData }]);
  }
};
```

## Adding New Widgets

To add a new widget type:

1. **Update the `WidgetType` union** in `mock-sse-service.ts`:
   ```typescript
   export type WidgetType = 
     | 'bar_chart' 
     | 'pie_chart' 
     | 'table' 
     | 'calculator'
     | 'your_new_widget'; // 👈 Add here
   ```

2. **Create a generator function**:
   ```typescript
   function generateYourNewWidget(): WidgetEvent {
     return {
       type: 'widget_your_new_widget',
       widget: {
         id: crypto.randomUUID(),
         title: 'Your Widget Title',
         data: { /* your data structure */ },
         sourceUrl: '/api/your/endpoint', // optional
       },
     };
   }
   ```

3. **Add trigger logic** in `generateMockSSEStream`:
   ```typescript
   if (prompt.toLowerCase().includes('your_keyword')) {
     yield generateYourNewWidget();
     await delay(300);
   }
   ```

## Testing

To test the mock service:

1. Start your development server
2. Click a suggestion tile with `useMockService: true`
3. Watch the console for `[MockSSE]` logs
4. Verify widgets render correctly
5. Test with different prompts containing various keywords

## Backend Integration Path

When ready to move to the real backend:

1. Backend should emit events in the same format:
   ```
   event: message_delta
   data: {"type": "message_delta", "delta": "text"}
   
   event: widget_bar_chart
   data: {"type": "widget_bar_chart", "widget": {...}}
   ```

2. Remove `useMockService` flags from tiles
3. Backend will use `sourceUrl` to fetch real data
4. Frontend widget renderers remain the same!

## Notes

- Mock service doesn't require authentication (JWT is ignored)
- Mock service doesn't create actual chat sessions
- All responses are deterministic based on prompt keywords
- Realistic delays simulate network latency for better UX testing
- The mock service is completely isolated from the real backend

