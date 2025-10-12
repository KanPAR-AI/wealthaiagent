# Widget Implementation Guide

## ✅ Components Built

We've successfully integrated shadcn/ui chart components (using [Recharts](https://recharts.org/)) to render beautiful, interactive widgets in chat messages.

### Files Created:

#### 1. **Chart Infrastructure** (based on [shadcn Chart docs](https://ui.shadcn.com/docs/components/chart))
- ✅ `src/components/ui/chart.tsx` - Chart container, tooltip, legend components
- ✅ `src/components/ui/card.tsx` - Card components for widget containers

#### 2. **Widget Renderers**
- ✅ `src/components/widgets/pie-chart-widget.tsx` - Donut chart with center label
- ✅ `src/components/widgets/bar-chart-widget.tsx` - Bar chart with grid
- ✅ `src/components/widgets/table-widget.tsx` - Data table with styled rows
- ✅ `src/components/widgets/widget-renderer.tsx` - Main widget router

#### 3. **Type Definitions**
- ✅ Updated `src/types/chat.ts` with `Widget` interface
- ✅ Added `widgets?: Widget[]` to `Message` interface

#### 4. **Integration**
- ✅ Updated `use-message-sending.ts` to capture and store widgets
- ✅ Updated `use-pending-message.ts` to capture and store widgets
- ✅ Updated `chat-bubbles.tsx` to render widgets with animations

## 🎨 Widget Types Available

### 1. Pie Chart (`widget_pie_chart`)
**Data Structure:**
```typescript
{
  id: string,
  type: 'widget_pie_chart',
  title: 'Portfolio Allocation',
  data: {
    labels: ['Stocks', 'Bonds', 'Real Estate', 'Cash', 'Crypto'],
    values: [45, 25, 15, 10, 5],
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899']
  }
}
```

**Features:**
- Donut chart with center label showing total
- Hover tooltips
- Color-coded segments
- Responsive sizing

### 2. Bar Chart (`widget_bar_chart`)
**Data Structure:**
```typescript
{
  id: string,
  type: 'widget_bar_chart',
  title: 'Monthly Performance',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Portfolio Value',
      values: [45000, 47500, 46800, 51000, 53200, 55800],
      color: '#3b82f6'
    }]
  }
}
```

**Features:**
- Vertical bar chart
- Cartesian grid
- X/Y axes with formatting
- Hover tooltips
- Supports multiple datasets

### 3. Table (`widget_table`)
**Data Structure:**
```typescript
{
  id: string,
  type: 'widget_table',
  title: 'Top Holdings',
  data: {
    headers: ['Symbol', 'Name', 'Shares', 'Value', 'Change'],
    rows: [
      ['AAPL', 'Apple Inc.', '50', '$8,750', '+2.3%'],
      ['MSFT', 'Microsoft Corp.', '30', '$11,250', '+1.8%'],
      // ...more rows
    ]
  }
}
```

**Features:**
- Styled table with borders
- Color-coded change values (green for +, red for -)
- Hover effects on rows
- Scrollable for long data

### 4. Calculator (`widget_calculator`)
**Status:** Placeholder (coming soon)

## 🔄 How It Works

### SSE Event Flow:

```
Mock Service generates events:
  ↓
1. message_start
  ↓
2. message_delta (text chunks)
  ↓
3. widget_pie_chart (widget data as JSON)
  ↓
4. message_delta (more text)
  ↓
5. message_complete
```

### Widget Processing Pipeline:

```
1. Mock service emits: onMessageChunk(JSON.stringify(widget), 'widget_pie_chart')
   ↓
2. Hook receives widget event
   ↓
3. Parse JSON: const widgetData = JSON.parse(chunk)
   ↓
4. Add to widgets array: widgets.push({ ...widgetData, type: 'widget_pie_chart' })
   ↓
5. Update message: updateMessage(id, { widgets: [...widgets] })
   ↓
6. Message re-renders
   ↓
7. ChatBubble detects message.widgets
   ↓
8. Renders WidgetRenderer for each widget
   ↓
9. WidgetRenderer routes to appropriate component (PieChartWidget, etc.)
   ↓
10. Widget appears in chat with animation! ✨
```

## 🧪 Testing

### Test the Widgets:

1. **Start your dev server**
2. **Click "Show my portfolio allocation"** tile
3. **Expected Result:**

```
Bot Message:
┌─────────────────────────────────────────┐
│ Based on your portfolio, here's a       │
│ comprehensive analysis:                 │
│                                         │
│ ┌───────────────────────────────┐      │
│ │  Portfolio Allocation         │      │
│ │  [Donut Chart appears here]   │      │
│ │  - Stocks: 45%                │      │
│ │  - Bonds: 25%                 │      │
│ │  - Real Estate: 15%           │      │
│ │  - Cash: 10%                  │      │
│ │  - Crypto: 5%                 │      │
│ └───────────────────────────────┘      │
│                                         │
│ Your portfolio shows strong             │
│ diversification...                      │
└─────────────────────────────────────────┘
```

### Console Output:

```
[MockSSE] Emitting event: widget_pie_chart
[Pending Message] Widget event received: widget_pie_chart
[Pending Message] Widget added. Total widgets: 1
[WidgetRenderer] Rendering widget: widget_pie_chart
```

### Verify in Browser:

- ✅ Text streams word-by-word
- ✅ Pie chart appears after text
- ✅ Chart is interactive (hover to see values)
- ✅ Colors match the data
- ✅ No API calls in Network tab (mock service)

## 🎨 Customizing Widgets

### Change Pie Chart Colors:

Edit `mock-sse-service.ts`:
```typescript
function generatePieChartWidget(): WidgetEvent {
  return {
    type: 'widget_pie_chart',
    widget: {
      data: {
        labels: ['Your', 'Custom', 'Labels'],
        values: [40, 35, 25],
        colors: ['#your-color-1', '#your-color-2', '#your-color-3'],
      },
    },
  };
}
```

### Add More Data to Bar Chart:

```typescript
function generateBarChartWidget(): WidgetEvent {
  return {
    type: 'widget_bar_chart',
    widget: {
      data: {
        labels: ['Jan', 'Feb', 'Mar', ... ,'Dec'], // Add more months
        datasets: [
          {
            label: 'Portfolio Value',
            values: [45000, 47500, ... , 75000], // Add more values
            color: '#3b82f6',
          },
          // Add another dataset for comparison:
          {
            label: 'Benchmark',
            values: [40000, 42000, ... , 70000],
            color: '#10b981',
          }
        ],
      },
    },
  };
}
```

### Customize Table Styling:

Edit `table-widget.tsx`:
```typescript
// Change header background
className="border-b bg-blue-500 text-white"

// Add alternating row colors
className={cn(
  "border-b hover:bg-muted/50",
  rowIndex % 2 === 0 && "bg-muted/20"
)}
```

## 📊 shadcn Chart Features Used

Based on the [shadcn Chart documentation](https://ui.shadcn.com/docs/components/chart):

### 1. **ChartContainer**
- Responsive wrapper for all charts
- Handles theming automatically
- CSS variable-based colors

### 2. **ChartTooltip**
- Interactive hover tooltips
- Auto-formatted values (e.g., `45000` → `45k`)
- Customizable indicators (dot, line, dashed)

### 3. **ChartConfig**
- Type-safe configuration
- Label and color definitions
- Theme support (light/dark mode)

### 4. **Recharts Integration**
- Built on top of Recharts v2.15.3
- Access to all Recharts components
- Composable and flexible

## 🚀 Adding New Widget Types

### Example: Line Chart

1. **Create the widget component:**

```typescript
// src/components/widgets/line-chart-widget.tsx
"use client"

import { Line, LineChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export function LineChartWidget({ title, data }) {
  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--chart-1))",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px]">
          <LineChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="var(--color-value)" 
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

2. **Add to widget renderer:**

```typescript
// widget-renderer.tsx
case 'widget_line_chart':
  return <LineChartWidget {...widget} />
```

3. **Generate mock data:**

```typescript
// mock-sse-service.ts
function generateLineChartWidget(): WidgetEvent {
  return {
    type: 'widget_line_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Portfolio Growth',
      data: {
        chartData: [
          { name: '2020', value: 10000 },
          { name: '2021', value: 15000 },
          { name: '2022', value: 14500 },
          { name: '2023', value: 18000 },
          { name: '2024', value: 22000 },
        ],
      },
    },
  };
}
```

## 🎯 Next Steps

1. **Test all widgets** - Click mock tiles and verify rendering
2. **Add more widget types** - Line charts, area charts, gauges, etc.
3. **Implement calculator widget** - Use shadcn Form components
4. **Add data table features** - Sorting, filtering from [shadcn Data Table](https://ui.shadcn.com/docs/components/data-table)
5. **Backend integration** - Replicate event structure in FastAPI
6. **Add widget interactions** - Click to expand, export data, etc.
7. **Error boundaries** - Graceful fallback if widget fails to render

## 📚 Resources

- [shadcn/ui Chart Documentation](https://ui.shadcn.com/docs/components/chart)
- [shadcn/ui Data Table Documentation](https://ui.shadcn.com/docs/components/data-table)
- [Recharts Documentation](https://recharts.org/)
- [Framer Motion](https://www.framer.com/motion/) (for animations)

## 🐛 Troubleshooting

### Widget not appearing:
1. Check console for `[WidgetRenderer]` logs
2. Verify widget data structure matches expected format
3. Check that `message.widgets` array exists

### Chart looks broken:
1. Verify data arrays (labels and values) have same length
2. Check color strings are valid CSS colors
3. Ensure ChartConfig matches your data keys

### Styles not applying:
1. Check if card.tsx is properly imported
2. Verify Tailwind CSS is configured
3. Check for CSS conflicts with existing styles

## ✨ Summary

✅ **shadcn/ui charts integrated** using Recharts  
✅ **3 widget types working**: Pie chart, Bar chart, Table  
✅ **Mock service generates widgets** based on keywords  
✅ **Widgets render in chat messages** with animations  
✅ **Type-safe** with TypeScript interfaces  
✅ **Responsive** and **theme-aware** (light/dark mode)  
✅ **Zero API calls** for mock service  
✅ **Ready for backend integration** - same event structure  

Your chat now has beautiful, interactive widgets! 🎉

