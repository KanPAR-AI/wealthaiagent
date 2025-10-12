# Mock Response Customization Guide

## Where Mock Responses Are Located

All mock responses are generated in: **`wealthaiagent/src/services/mock-sse-service.ts`**

## Current Mock Response Flow

When you click **"Show my portfolio allocation"** tile:

```
1. Text streams word-by-word:
   "Based on your portfolio, here's a comprehensive analysis:"

2. Pie Chart Widget is emitted (logged to console)
   - Shows: Stocks 45%, Bonds 25%, Real Estate 15%, Cash 10%, Crypto 5%

3. More text streams:
   "Your portfolio shows strong diversification across multiple asset classes..."
   
4. Message completes
```

## Where to See Mock Responses

### ✅ In the UI (Text)
- Bot message bubble with streaming text
- Should appear immediately after clicking mock tile

### 🔍 In Console (Widgets)
- Open browser console (F12)
- Look for `[Pending Message] Widget event received: widget_pie_chart`
- Widget data is logged but **not rendered yet** (next step!)

### 🌐 In Network Tab
- Should see **ZERO** API calls to `/chats` or `/messages`
- Only initial page load requests

## Customizing Mock Responses

### 1. Change Text Content

Edit in `mock-sse-service.ts`:

```typescript
// Line ~71: Introduction text
const introText = "Your custom introduction here";

// Line ~109: Conclusion text  
const conclusionText = "\n\nYour custom conclusion here";
```

### 2. Change Streaming Speed

```typescript
await delay(50);  // Delay between words (milliseconds)
await delay(40);  // Delay for conclusion words
```

### 3. Add Keyword-Based Responses

Currently supported keywords:

```typescript
// Keywords -> Widget Type
"portfolio" || "allocation" -> Pie Chart
"performance" || "growth"   -> Bar Chart
"stocks" || "holdings"      -> Table
"calculator" || "mortgage"  -> Calculator
```

**Add new keyword triggers:**

```typescript
// After line 105, add:
if (prompt.toLowerCase().includes('risk') || prompt.toLowerCase().includes('volatility')) {
  yield generateLineChartWidget(); // You'd need to create this
  await delay(300);
}
```

### 4. Customize Widget Data

#### Pie Chart (Portfolio Allocation)

```typescript
function generatePieChartWidget(): WidgetEvent {
  return {
    type: 'widget_pie_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Portfolio Allocation', // ← Change title
      data: {
        labels: ['Stocks', 'Bonds', 'Real Estate', 'Cash', 'Crypto'], // ← Change categories
        values: [45, 25, 15, 10, 5], // ← Change percentages (must sum to 100)
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899'], // ← Change colors
      },
      sourceUrl: '/api/portfolio/allocation',
    },
  };
}
```

#### Bar Chart (Performance)

```typescript
function generateBarChartWidget(): WidgetEvent {
  return {
    type: 'widget_bar_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Monthly Performance', // ← Change title
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], // ← Change months
        datasets: [
          {
            label: 'Portfolio Value',
            values: [45000, 47500, 46800, 51000, 53200, 55800], // ← Change values
            color: '#3b82f6',
          },
        ],
      },
      sourceUrl: '/api/portfolio/performance',
    },
  };
}
```

#### Table (Holdings)

```typescript
function generateTableWidget(): WidgetEvent {
  return {
    type: 'widget_table',
    widget: {
      id: crypto.randomUUID(),
      title: 'Top Holdings', // ← Change title
      data: {
        headers: ['Symbol', 'Name', 'Shares', 'Value', 'Change'], // ← Change columns
        rows: [
          ['AAPL', 'Apple Inc.', '50', '$8,750', '+2.3%'], // ← Change data
          ['MSFT', 'Microsoft Corp.', '30', '$11,250', '+1.8%'],
          // Add more rows...
        ],
      },
      sourceUrl: '/api/portfolio/holdings',
    },
  };
}
```

## Creating New Mock Scenarios

### Example: Add a "Risk Analysis" Response

1. **Add new tile** in `chat-window.tsx`:
```typescript
{
  id: 7,
  title: "Analyze my portfolio risk",
  description: "Risk assessment",
  useMockService: true,
},
```

2. **Add response logic** in `mock-sse-service.ts`:
```typescript
// In generateMockSSEStream function, after line 105:
if (prompt.toLowerCase().includes('risk')) {
  const riskText = "\n\nRisk Analysis:\n- Volatility: Moderate\n- Sharpe Ratio: 1.2\n- Max Drawdown: -15%";
  for (const word of riskText.split(' ')) {
    yield {
      type: 'message_delta',
      delta: word + ' ',
    };
    await delay(50);
  }
  
  // Optionally add a widget
  yield generateRiskGaugeWidget(); // Create this function
  await delay(300);
}
```

## Widget Types Available

### Currently Implemented:
1. ✅ **Pie Chart** - `widget_pie_chart`
2. ✅ **Bar Chart** - `widget_bar_chart`
3. ✅ **Table** - `widget_table`
4. ✅ **Calculator** - `widget_calculator`

### How to Add New Widget Types:

1. **Update type union** (line ~15):
```typescript
export type WidgetType = 
  | 'bar_chart' 
  | 'pie_chart' 
  | 'table' 
  | 'calculator'
  | 'line_chart'      // ← Add new type
  | 'gauge'           // ← Add new type
  | 'metric_card';    // ← Add new type
```

2. **Create generator function**:
```typescript
function generateLineChartWidget(): WidgetEvent {
  return {
    type: 'widget_line_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Portfolio Growth Over Time',
      data: {
        labels: ['2020', '2021', '2022', '2023', '2024'],
        datasets: [{
          label: 'Value',
          values: [10000, 15000, 14500, 18000, 22000],
          color: '#10b981',
        }],
      },
      sourceUrl: '/api/portfolio/growth',
    },
  };
}
```

3. **Add to response flow**:
```typescript
if (prompt.toLowerCase().includes('growth') || prompt.toLowerCase().includes('history')) {
  yield generateLineChartWidget();
  await delay(300);
}
```

## Testing Your Changes

### Quick Test:
1. Save changes to `mock-sse-service.ts`
2. Reload browser (dev server should hot-reload)
3. Click mock tile
4. Check console for your changes
5. Verify text appears in UI

### Debug Console Output:
```
[MockSSE] Starting mock SSE stream for prompt: Show my portfolio allocation
[MockSSE] Streaming text in 8 words
[MockSSE] Yielding word 1: "Based"
[MockSSE] Yielding word 2: "on "
...
[MockSSE] Emitting event: widget_pie_chart
[Pending Message] Widget event received: widget_pie_chart {...}
```

## Current Limitation: Widgets Not Rendered

**Status**: Widget data is generated and logged but not displayed in UI.

**Why**: Widget renderer components haven't been created yet.

**Next Steps**:
1. Create widget renderer components (PieChart, BarChart, etc.)
2. Update `chat-bubbles.tsx` to detect and render widgets
3. Parse widget data from streaming events
4. Display widgets in message bubbles

**For now**: You can see widget data in console and verify the structure is correct.

## Example: Complete Custom Mock Response

```typescript
// Add this to generateMockSSEStream after line 84:

if (prompt.toLowerCase().includes('retirement')) {
  const retirementAnalysis = `
Based on your current savings rate and investment returns, 
here's your retirement projection:

- Current Age: 35
- Retirement Age: 65
- Projected Nest Egg: $2.4M
- Monthly Income: $8,000

You're on track to meet your retirement goals! 🎯
  `.trim();
  
  for (const word of retirementAnalysis.split(' ')) {
    yield {
      type: 'message_delta',
      delta: word + ' ',
    };
    await delay(50);
  }
  
  // Add a projection chart
  yield {
    type: 'widget_line_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Retirement Savings Projection',
      data: {
        labels: ['2024', '2029', '2034', '2039', '2044', '2049', '2054'],
        datasets: [{
          label: 'Projected Value',
          values: [150000, 400000, 750000, 1200000, 1700000, 2100000, 2400000],
          color: '#3b82f6',
        }],
      },
    },
  };
  await delay(300);
}
```

## Tips

1. **Keep delays realistic**: 40-50ms per word feels natural
2. **Test with keywords**: Make sure your keyword triggers work
3. **Check console**: Always verify widget data structure
4. **Use line breaks**: `\n\n` for paragraph breaks in text
5. **Vary responses**: Add multiple responses for same keyword

## File Structure Reference

```
wealthaiagent/src/services/
├── mock-sse-service.ts       ← ALL mock logic here
│   ├── generateMockSSEStream  ← Main streaming function
│   ├── generatePieChartWidget ← Pie chart data
│   ├── generateBarChartWidget ← Bar chart data
│   ├── generateTableWidget    ← Table data
│   └── generateCalculatorWidget ← Calculator config
│
├── chat-service.ts           ← Routes to mock (don't edit)
│
└── (widget renderers - TODO)
    ├── PieChartWidget.tsx
    ├── BarChartWidget.tsx
    ├── TableWidget.tsx
    └── CalculatorWidget.tsx
```

## Next Steps

1. ✅ Mock service generates responses
2. ✅ Text streams to UI
3. ✅ Widgets logged to console
4. 🔲 Create widget renderer components (NEXT!)
5. 🔲 Display widgets in chat bubbles
6. 🔲 Add more mock scenarios
7. 🔲 Build out backend to match structure

