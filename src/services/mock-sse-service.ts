// services/mock-sse-service.ts
// Mock SSE service for testing widget functionality without backend

export type WidgetType = 
  | 'bar_chart' 
  | 'pie_chart' 
  | 'table' 
  | 'calculator'
  | 'line_chart'
  | 'metric_card';

export interface WidgetEvent {
  type: `widget_${WidgetType}`;
  widget: {
    id: string;
    title?: string;
    data: any;
    sourceUrl?: string;
    config?: any;
  };
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: string;
}

export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    sender: 'assistant';
    timestamp: string;
  };
}

export interface MessageCompleteEvent {
  type: 'message_complete';
  message: {
    content: string;
    finish_reason: 'stop';
  };
}

export type MockSSEEvent = 
  | MessageStartEvent 
  | MessageDeltaEvent 
  | WidgetEvent 
  | MessageCompleteEvent;

/**
 * Simulates an SSE stream by yielding events with realistic delays
 */
async function* generateMockSSEStream(prompt: string): AsyncGenerator<MockSSEEvent> {
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // 1. Message start
  yield {
    type: 'message_start',
    message: {
      id: messageId,
      sender: 'assistant',
      timestamp,
    },
  };

  await delay(100);

  // 2. Stream introduction text
  const introText = "Let me analyze that for you. Here's what I found:";
  const words = introText.split(' ');
  console.log('[MockSSE] Streaming text in', words.length, 'words');
  for (let i = 0; i < words.length; i++) {
    const delta = i === words.length - 1 ? words[i] : words[i] + ' ';
    console.log('[MockSSE] Yielding word', i + 1, ':', JSON.stringify(delta));
    yield {
      type: 'message_delta',
      delta,
    };
    await delay(50);
  }

  await delay(200);

  // 3. Send widget based on prompt keywords
  if (prompt.toLowerCase().includes('portfolio') || prompt.toLowerCase().includes('allocation')) {
    yield generatePieChartWidget();
    await delay(300);
  }

  if (prompt.toLowerCase().includes('performance') || prompt.toLowerCase().includes('growth')) {
    yield generateBarChartWidget();
    await delay(300);
  }

  if (prompt.toLowerCase().includes('stocks') || prompt.toLowerCase().includes('holdings')) {
    yield generateTableWidget();
    await delay(300);
  }

  if (prompt.toLowerCase().includes('calculator') || prompt.toLowerCase().includes('mortgage')) {
    yield generateCalculatorWidget();
    await delay(300);
  }

  // 4. Stream conclusion text
  await delay(100);
  const conclusionText = "\n\nWould you like me to explain any of these metrics in more detail?";
  const conclusionWords = conclusionText.split(' ');
  console.log('[MockSSE] Streaming conclusion in', conclusionWords.length, 'words');
  for (let i = 0; i < conclusionWords.length; i++) {
    const delta = i === conclusionWords.length - 1 ? conclusionWords[i] : conclusionWords[i] + ' ';
    console.log('[MockSSE] Yielding conclusion word', i + 1, ':', JSON.stringify(delta));
    yield {
      type: 'message_delta',
      delta,
    };
    await delay(40);
  }

  // 5. Message complete
  yield {
    type: 'message_complete',
    message: {
      content: introText + conclusionText,
      finish_reason: 'stop',
    },
  };
}

/**
 * Helper to create delays in the stream
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock widget generators
 */
function generatePieChartWidget(): WidgetEvent {
  return {
    type: 'widget_pie_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Portfolio Allocation',
      data: {
        labels: ['Stocks', 'Bonds', 'Real Estate', 'Cash', 'Crypto'],
        values: [45, 25, 15, 10, 5],
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899'],
      },
      sourceUrl: '/api/portfolio/allocation', // Mock URL
    },
  };
}

function generateBarChartWidget(): WidgetEvent {
  return {
    type: 'widget_bar_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Monthly Performance',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Portfolio Value',
            values: [45000, 47500, 46800, 51000, 53200, 55800],
            color: '#3b82f6',
          },
        ],
      },
      sourceUrl: '/api/portfolio/performance',
    },
  };
}

function generateTableWidget(): WidgetEvent {
  return {
    type: 'widget_table',
    widget: {
      id: crypto.randomUUID(),
      title: 'Top Holdings',
      data: {
        headers: ['Symbol', 'Name', 'Shares', 'Value', 'Change'],
        rows: [
          ['AAPL', 'Apple Inc.', '50', '$8,750', '+2.3%'],
          ['MSFT', 'Microsoft Corp.', '30', '$11,250', '+1.8%'],
          ['GOOGL', 'Alphabet Inc.', '15', '$7,425', '-0.5%'],
          ['TSLA', 'Tesla Inc.', '25', '$6,125', '+4.2%'],
          ['AMZN', 'Amazon.com Inc.', '40', '$9,600', '+1.1%'],
        ],
      },
      sourceUrl: '/api/portfolio/holdings',
    },
  };
}

function generateCalculatorWidget(): WidgetEvent {
  return {
    type: 'widget_calculator',
    widget: {
      id: crypto.randomUUID(),
      title: 'Mortgage Calculator',
      config: {
        type: 'mortgage',
        fields: [
          { name: 'loanAmount', label: 'Loan Amount', type: 'currency', default: 300000 },
          { name: 'interestRate', label: 'Interest Rate (%)', type: 'percentage', default: 4.5 },
          { name: 'loanTerm', label: 'Loan Term (years)', type: 'number', default: 30 },
        ],
      },
      // Calculator is frontend-only, no sourceUrl needed
    },
  };
}

/**
 * Main mock SSE listener function
 * Mimics the real listenToChatStream API but returns mock data
 */
export const listenToMockChatStream = async (
  prompt: string,
  onMessageChunk: (
    chunk: string,
    type: "text_chunk" | "graph_data" | "table_data" | string
  ) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) => {
  try {
    console.log('[MockSSE] Starting mock SSE stream for prompt:', prompt);

    // Generate the mock stream
    for await (const event of generateMockSSEStream(prompt)) {
      console.log('[MockSSE] Emitting event:', event.type);

      if (event.type === 'message_delta') {
        onMessageChunk(event.delta, 'text_chunk');
        // Yield to browser to update UI
        await new Promise(resolve => setTimeout(resolve, 0));
      } else if (event.type === 'message_complete') {
        console.log('[MockSSE] Stream complete');
        onComplete();
        return;
      } else if (event.type.startsWith('widget_')) {
        // Pass the entire widget event as a JSON string
        onMessageChunk(JSON.stringify(event.widget), event.type);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } catch (error: any) {
    console.error('[MockSSE] Error in mock stream:', error);
    onError(error);
  }
};

