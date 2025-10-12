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

  const lowerPrompt = prompt.toLowerCase();

  // Detect scenario and generate appropriate response
  if (lowerPrompt.includes('portfolio') && lowerPrompt.includes('allocation')) {
    // Scenario 1: Portfolio Allocation
    yield* streamText("Based on your portfolio, here's a comprehensive analysis:");
    await delay(200);
    yield generatePieChartWidget();
    await delay(300);
    yield* streamText("\n\nYour portfolio shows strong diversification across multiple asset classes. The allocation is well-balanced with 45% in equities for growth, 25% in bonds for stability, and diversified holdings in real estate, cash, and emerging assets.");
    await delay(100);
    yield* streamText("\n\n💡 **Key Insights:**\n- Your equity allocation aligns well with a moderate-aggressive risk profile\n- Consider rebalancing if any asset class drifts more than 5% from target\n- The 10% cash position provides good liquidity for opportunities");
  }
  else if (lowerPrompt.includes('performance') || lowerPrompt.includes('analyze')) {
    // Scenario 2: Performance Analysis
    yield* streamText("Let me analyze your portfolio performance over the last 6 months:");
    await delay(200);
    yield generateBarChartWidget();
    await delay(300);
    yield* streamText("\n\nYour portfolio has shown consistent growth with a 24% increase over the period. The upward trend is particularly strong in the last quarter.");
    await delay(100);
    yield* streamText("\n\n📊 **Performance Highlights:**\n- Average monthly return: 3.7%\n- Best month: June (+8.9%)\n- Lowest month: March (-2.1%)\n- Volatility: Moderate\n\nYour portfolio is outperforming the benchmark index by 4.2%!");
  }
  else if (lowerPrompt.includes('holdings') || lowerPrompt.includes('top')) {
    // Scenario 3: Top Holdings
    yield* streamText("Here are your current top 5 holdings:");
    await delay(200);
    yield generateTableWidget();
    await delay(300);
    yield* streamText("\n\nYour portfolio is well-diversified across tech, finance, and consumer sectors. The top 5 positions represent 43% of your total portfolio value.");
    await delay(100);
    yield* streamText("\n\n🎯 **Portfolio Notes:**\n- AAPL and MSFT provide strong tech exposure\n- Consider adding emerging market exposure\n- All positions showing positive returns\n- Average position size: $8,610");
  }
  else if (lowerPrompt.includes('sip') || lowerPrompt.includes('systematic')) {
    // Scenario 4: SIP Explanation with Growth Chart
    yield* streamText("Let me explain Systematic Investment Plans (SIP) with a real example:");
    await delay(200);
    yield generateSIPGrowthWidget();
    await delay(300);
    yield* streamText("\n\nSIP is a disciplined investment approach where you invest a fixed amount regularly (monthly/quarterly). The chart above shows how investing ₹10,000 monthly grows over 5 years.");
    await delay(100);
    yield* streamText("\n\n✨ **SIP Benefits:**\n- **Rupee Cost Averaging:** Buy more units when prices are low\n- **Discipline:** Automated investing builds wealth consistently\n- **Flexibility:** Start with as little as ₹500/month\n- **Compounding:** Returns generate returns over time\n\n💰 In this example, ₹6L invested becomes ₹7.8L+ (30% returns)!");
  }
  else if (lowerPrompt.includes('mutual fund') || lowerPrompt.includes('compare')) {
    // Scenario 5: Mutual Fund Comparison
    yield* streamText("Here's a comparison of different mutual fund categories based on 3-year performance:");
    await delay(200);
    yield generateMutualFundComparisonWidget();
    await delay(300);
    yield* streamText("\n\nEach fund category serves different investment goals and risk profiles.");
    await delay(100);
    yield* streamText("\n\n📈 **Category Guide:**\n- **Large Cap:** Stable, lower risk, 12-15% returns\n- **Mid Cap:** Moderate risk, 15-18% returns\n- **Small Cap:** Higher risk, 18-22% returns\n- **Debt Funds:** Low risk, 6-8% returns\n- **Hybrid:** Balanced, 10-14% returns\n\n💡 Diversify across categories based on your risk appetite and time horizon!");
  }
  else if (lowerPrompt.includes('compound') || lowerPrompt.includes('interest')) {
    // Scenario 6: Compound Interest Growth
    yield* streamText("Let me show you the power of compound interest with a ₹1,00,000 investment at 12% annual return:");
    await delay(200);
    yield generateCompoundInterestWidget();
    await delay(300);
    yield* streamText("\n\nCompound interest is often called the \"eighth wonder of the world.\" Your money doesn't just grow—it grows exponentially!");
    await delay(100);
    yield* streamText("\n\n🚀 **The Magic of Compounding:**\n- Year 1: ₹1,12,000 (+₹12,000)\n- Year 5: ₹1,76,234 (+₹76,234)\n- Year 10: ₹3,10,585 (+₹2,10,585)\n- Year 20: ₹9,64,629 (+₹8,64,629)\n\n⏰ Time is your biggest asset. The earlier you start, the more you benefit!");
  }
  else {
    // Default response
    yield* streamText("I can help you with portfolio analysis, investment strategies, and financial insights. What would you like to explore?");
  }

  // Message complete
  yield {
    type: 'message_complete',
    message: {
      content: 'Mock response complete',
      finish_reason: 'stop',
    },
  };
}

/**
 * Helper to stream text word by word
 */
async function* streamText(text: string): AsyncGenerator<MessageDeltaEvent> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const delta = i === words.length - 1 ? words[i] : words[i] + ' ';
    yield {
      type: 'message_delta',
      delta,
    };
    await delay(50);
  }
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
      data: undefined
    },
  };
}

function generateSIPGrowthWidget(): WidgetEvent {
  return {
    type: 'widget_line_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'SIP Investment Growth (₹10,000/month)',
      data: {
        labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
        datasets: [
          {
            label: 'Total Value',
            values: [125000, 265000, 425000, 610000, 820000],
            color: '#10b981',
          },
          {
            label: 'Amount Invested',
            values: [120000, 240000, 360000, 480000, 600000],
            color: '#6366f1',
          },
        ],
      },
      sourceUrl: '/api/sip/projection',
    },
  };
}

function generateMutualFundComparisonWidget(): WidgetEvent {
  return {
    type: 'widget_bar_chart',
    widget: {
      id: crypto.randomUUID(),
      title: '3-Year Returns by Fund Category',
      data: {
        labels: ['Large Cap', 'Mid Cap', 'Small Cap', 'Debt', 'Hybrid'],
        datasets: [
          {
            label: '3-Year Returns (%)',
            values: [14.2, 18.5, 22.1, 7.3, 12.8],
            color: '#3b82f6',
          },
        ],
      },
      sourceUrl: '/api/mutual-funds/comparison',
    },
  };
}

function generateCompoundInterestWidget(): WidgetEvent {
  return {
    type: 'widget_line_chart',
    widget: {
      id: crypto.randomUUID(),
      title: 'Power of Compounding (₹1L @ 12% p.a.)',
      data: {
        labels: ['Start', '5 Years', '10 Years', '15 Years', '20 Years'],
        datasets: [
          {
            label: 'Investment Value',
            values: [100000, 176234, 310585, 547357, 964629],
            color: '#f59e0b',
          },
        ],
      },
      sourceUrl: '/api/calculators/compound-interest',
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
        onMessageChunk(JSON.stringify((event as WidgetEvent).widget), event.type);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } catch (error: any) {
    console.error('[MockSSE] Error in mock stream:', error);
    onError(error);
  }
};

