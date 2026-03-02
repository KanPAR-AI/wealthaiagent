// pages/Trade.tsx

import { useEffect, useState } from 'react';
import { useTradeStore } from '@/store/trade';
import { useChatStore } from '@/store/chat';
import { useAuth } from '@/hooks/use-auth';
import { createChatSession } from '@/services/chat-service';
import { Recommendation } from '@/types/trade';
import { MessageFile } from '@/types';
import { TopChipsBar } from '@/components/trade/TopChipsBar';
import { LeftRail } from '@/components/trade/LeftRail';
import { HeroCard } from '@/components/trade/HeroCard';
import { ChartCanvas } from '@/components/trade/ChartCanvas';
import { DetailDrawer } from '@/components/trade/DetailDrawer';
import { MarketStatus } from '@/components/trade/MarketStatus';
import { X } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizeable';
import { PromptInputWithActions } from '@/components/chat/chat-input';
import ChatWindow from '@/components/chat/chat-window';
import { useTheme } from "@/components/theme/theme-provider";

// Demo data generator with realistic stock data
function generateMockRecommendations(): Recommendation[] {
  const tickers = [
    { ticker: 'NVDA', company: 'NVIDIA Corporation', exchange: 'NASDAQ', basePrice: 475.50 },
    { ticker: 'AAPL', company: 'Apple Inc.', exchange: 'NASDAQ', basePrice: 178.20 },
    { ticker: 'MSFT', company: 'Microsoft Corporation', exchange: 'NASDAQ', basePrice: 378.85 },
    { ticker: 'GOOGL', company: 'Alphabet Inc.', exchange: 'NASDAQ', basePrice: 142.30 },
    { ticker: 'TSLA', company: 'Tesla, Inc.', exchange: 'NASDAQ', basePrice: 248.50 },
    { ticker: 'AMZN', company: 'Amazon.com Inc.', exchange: 'NASDAQ', basePrice: 151.80 },
    { ticker: 'META', company: 'Meta Platforms Inc.', exchange: 'NASDAQ', basePrice: 485.20 },
    { ticker: 'NFLX', company: 'Netflix, Inc.', exchange: 'NASDAQ', basePrice: 485.90 },
  ];

  const explanations = [
    'High volume breakout detected; strong price momentum with technical indicators showing bullish pattern; positive catalyst expected in near term',
    'Price action breaking above key resistance level; institutional buying pressure increasing; favorable earnings outlook',
    'Volume surge indicates strong interest; momentum indicators turning positive; potential upside breakout forming',
    'Technical setup showing bullish divergence; accumulation pattern emerging; positive sentiment shift',
    'Breakout above moving average convergence; strong relative strength; favorable risk/reward ratio',
    'Volume expansion with price appreciation; momentum building; positive fundamental developments',
    'Price consolidating before potential move higher; strong support level holding; positive catalyst on horizon',
    'Technical indicators aligning bullishly; increasing institutional interest; positive earnings revision',
  ];

  const signalVariations = [
    [
      { name: 'Volume Spike', weight: 42, desc: '18.5x average volume' },
      { name: 'Price Breakout', weight: 35, desc: 'Close above 50-day MA' },
      { name: 'Catalyst', weight: 23, desc: 'Earnings beat expected' },
    ],
    [
      { name: 'Momentum Shift', weight: 38, desc: 'RSI crossing bullish zone' },
      { name: 'Institutional Flow', weight: 32, desc: 'Large block trades detected' },
      { name: 'Technical Pattern', weight: 30, desc: 'Ascending triangle formation' },
    ],
    [
      { name: 'Volume Expansion', weight: 40, desc: '15.2x average volume' },
      { name: 'Price Action', weight: 33, desc: 'Higher highs pattern' },
      { name: 'Sentiment', weight: 27, desc: 'Analyst upgrades' },
    ],
    [
      { name: 'Breakout', weight: 45, desc: 'Breaking key resistance' },
      { name: 'Momentum', weight: 30, desc: 'Strong price acceleration' },
      { name: 'Fundamentals', weight: 25, desc: 'Revenue growth accelerating' },
    ],
  ];

  return tickers.map((t, idx) => {
    const basePrice = t.basePrice;
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const currentPrice = basePrice * (1 + variation);
    const priceChange = (Math.random() - 0.3) * 8; // Mostly positive, some negative
    
    // Generate realistic sparkline data with proper historical distribution
    const now = Date.now();
    const sparklinePoints: Array<{ t: number; v: number }> = [];
    
    // Generate data going back 1 year
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const trend = Math.random() > 0.3 ? 1 : -1; // 70% chance of upward trend
    
    // Start from a year ago with a base price
    let historicalPrice = basePrice * (1 - trend * 0.2); // Start lower/higher based on trend
    
    // Generate data points
    let currentTime = oneYearAgo;
    
    while (currentTime <= now) {
      const daysSinceStart = (currentTime - oneYearAgo) / (24 * 60 * 60 * 1000);
      const progress = daysSinceStart / 365;
      
      // Calculate price with trend, noise, and volatility
      const trendComponent = trend * progress * 0.25; // Overall trend over year
      const noise = (Math.random() - 0.5) * 0.02;
      const volatility = Math.sin(daysSinceStart * 0.05) * 0.03; // Weekly cycles
      const dailyVolatility = Math.sin(daysSinceStart * 0.5) * 0.01; // Daily cycles
      
      historicalPrice = basePrice * (1 + trendComponent + noise + volatility + dailyVolatility);
      
      // Determine data point frequency based on how recent it is
      const daysAgo = (now - currentTime) / (24 * 60 * 60 * 1000);
      let timeIncrement: number;
      
      if (daysAgo <= 1) {
        // Last 24 hours: 5-minute intervals (288 points)
        timeIncrement = 5 * 60 * 1000;
      } else if (daysAgo <= 5) {
        // Last 5 days: hourly intervals (120 points)
        timeIncrement = 60 * 60 * 1000;
      } else if (daysAgo <= 30) {
        // Last month: 6-hour intervals (120 points)
        timeIncrement = 6 * 60 * 60 * 1000;
      } else if (daysAgo <= 90) {
        // Last 3 months: daily intervals (90 points)
        timeIncrement = 24 * 60 * 60 * 1000;
      } else if (daysAgo <= 180) {
        // Last 6 months: every 2 days (90 points)
        timeIncrement = 2 * 24 * 60 * 60 * 1000;
      } else {
        // Older than 6 months: weekly intervals (52 points)
        timeIncrement = 7 * 24 * 60 * 60 * 1000;
      }
      
      sparklinePoints.push({
        t: currentTime,
        v: Math.max(historicalPrice * 0.5, Math.min(historicalPrice * 1.5, historicalPrice)), // Clamp to reasonable range
      });
      
      currentTime += timeIncrement;
    }
    
    // Ensure we have the current price point
    if (sparklinePoints.length === 0 || sparklinePoints[sparklinePoints.length - 1].t < now) {
      sparklinePoints.push({
        t: now,
        v: currentPrice,
      });
    } else {
      // Update the last point to current price
      sparklinePoints[sparklinePoints.length - 1] = {
        t: now,
        v: currentPrice,
      };
    }
    
    // Sort by timestamp to ensure chronological order
    sparklinePoints.sort((a, b) => a.t - b.t);

    const score = 80 + Math.random() * 20; // 80-100 range
    const confidence = 85 + Math.random() * 15; // 85-100 range

    // Calculate financial metrics
    const prevClose = currentPrice * (1 - priceChange / 100);
    const open = prevClose * (0.98 + Math.random() * 0.04); // Open within ±2% of prev close
    const dayHigh = Math.max(currentPrice, open) * (1 + Math.random() * 0.02);
    const dayLow = Math.min(currentPrice, open) * (1 - Math.random() * 0.02);
    
    // Year range: current price ± 20-50%
    const yearLow = currentPrice * (0.5 + Math.random() * 0.3);
    const yearHigh = currentPrice * (1.2 + Math.random() * 0.3);
    
    // Other metrics
    const peRatio = 15 + Math.random() * 30; // 15-45 range
    const volume = (5 + Math.random() * 20) * 1000000; // 5M-25M shares
    const marketCap = currentPrice * volume * (50 + Math.random() * 200); // Market cap in millions
    const dividendYield = 0.5 + Math.random() * 4; // 0.5-4.5%
    const eps = currentPrice / peRatio * (0.8 + Math.random() * 0.4); // EPS based on P/E

    return {
      ticker: t.ticker,
      companyName: t.company,
      exchange: t.exchange,
      rank: idx + 1,
      score: Math.round(score * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      price: Math.round(currentPrice * 100) / 100,
      priceChangePercent: Math.round(priceChange * 100) / 100,
      lastUpdated: new Date().toISOString(),
      sparkline: sparklinePoints,
      explainSummary: explanations[idx % explanations.length],
      signals: signalVariations[idx % signalVariations.length],
      recommendationEvents: [
        {
          timestamp: new Date(Date.now() - 3600000 * (1 + Math.random())).toISOString(),
          score: Math.round((score + Math.random() * 5) * 10) / 10,
          type: 'algorithm',
          note: 'Initial recommendation triggered',
        },
        ...(Math.random() > 0.5 ? [{
          timestamp: new Date(Date.now() - 7200000 * (1 + Math.random())).toISOString(),
          score: Math.round((score - 5 + Math.random() * 10) * 10) / 10,
          type: 'update',
          note: 'Score updated based on new data',
        }] : []),
      ],
      // Financial metrics
      prevClose: Math.round(prevClose * 100) / 100,
      open: Math.round(open * 100) / 100,
      dayRange: {
        low: Math.round(dayLow * 100) / 100,
        high: Math.round(dayHigh * 100) / 100,
      },
      yearRange: {
        low: Math.round(yearLow * 100) / 100,
        high: Math.round(yearHigh * 100) / 100,
      },
      peRatio: Math.round(peRatio * 100) / 100,
      volume: Math.round(volume),
      marketCap: Math.round(marketCap),
      dividendYield: Math.round(dividendYield * 100) / 100,
      eps: Math.round(eps * 100) / 100,
    };
  });
}

export default function Trade() {
  const {
    recommendations,
    selectedTicker,
    setRecommendations,
    selectTicker,
    updateRecommendation,
    setIsLive,
    setLastUpdated,
  } = useTradeStore();

  // State for chat integration
  const [hasActiveChat, setHasActiveChat] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const setPendingMessage = useChatStore(state => state.setPendingMessage);
  const { idToken: token, isAuthLoading: isLoadingToken } = useAuth();
  const { theme, setTheme } = useTheme();

  // Enforce dark mode on this page
  useEffect(() => {
    // Store the original theme before we change it
    // We get this from the hook's current state which reflects what's loaded
    const originalTheme = theme;
    
    // Set to dark without saving to localStorage
    if (originalTheme !== 'dark') {
      setTheme("dark", false);
    }

    // Cleanup: restore user's preferred theme
    return () => {
      if (originalTheme !== 'dark') {
        // Restore without saving (though if we didn't save dark, 
        // the localStorage should still match originalTheme, so safe either way)
        setTheme(originalTheme, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount/unmount

  // Initialize with basic recommendations (NVDA, AAPL, MSFT)
  // Price/sparkline data will be populated from REST/WebSocket
  useEffect(() => {
    if (recommendations.length === 0) {
      const initialRecommendations: Recommendation[] = [
        {
          ticker: 'NVDA',
          companyName: 'NVIDIA Corporation',
          exchange: 'NASDAQ',
          rank: 1,
          score: 85,
          confidence: 0.92,
          price: 0, // Will be populated from REST/WebSocket
          priceChangePercent: 0,
          lastUpdated: new Date().toISOString(),
          sparkline: [], // Will be populated from REST/WebSocket
          explainSummary: 'AI and data center growth driving strong fundamentals',
          signals: [
            { name: 'AI Growth', weight: 45, desc: 'Strong AI chip demand' },
            { name: 'Earnings', weight: 35, desc: 'Consistent beat expectations' },
            { name: 'Momentum', weight: 20, desc: 'Positive price trend' },
          ],
          recommendationEvents: [],
          prevClose: 0,
          open: 0,
          dayRange: { low: 0, high: 0 },
          yearRange: { low: 0, high: 0 },
          peRatio: 0,
          volume: 0,
          marketCap: 0,
          dividendYield: 0,
          eps: 0,
        },
        {
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          exchange: 'NASDAQ',
          rank: 2,
          score: 78,
          confidence: 0.88,
          price: 0,
          priceChangePercent: 0,
          lastUpdated: new Date().toISOString(),
          sparkline: [],
          explainSummary: 'Strong ecosystem and services revenue growth',
          signals: [
            { name: 'Services', weight: 40, desc: 'Growing services revenue' },
            { name: 'Innovation', weight: 35, desc: 'New product launches' },
            { name: 'Stability', weight: 25, desc: 'Consistent performance' },
          ],
          recommendationEvents: [],
          prevClose: 0,
          open: 0,
          dayRange: { low: 0, high: 0 },
          yearRange: { low: 0, high: 0 },
          peRatio: 0,
          volume: 0,
          marketCap: 0,
          dividendYield: 0,
          eps: 0,
        },
        {
          ticker: 'MSFT',
          companyName: 'Microsoft Corporation',
          exchange: 'NASDAQ',
          rank: 3,
          score: 82,
          confidence: 0.90,
          price: 0,
          priceChangePercent: 0,
          lastUpdated: new Date().toISOString(),
          sparkline: [],
          explainSummary: 'Cloud and AI leadership with strong enterprise adoption',
          signals: [
            { name: 'Azure', weight: 42, desc: 'Cloud growth accelerating' },
            { name: 'AI Integration', weight: 38, desc: 'AI features in products' },
            { name: 'Enterprise', weight: 20, desc: 'Strong enterprise base' },
          ],
          recommendationEvents: [],
          prevClose: 0,
          open: 0,
          dayRange: { low: 0, high: 0 },
          yearRange: { low: 0, high: 0 },
          peRatio: 0,
          volume: 0,
          marketCap: 0,
          dividendYield: 0,
          eps: 0,
        },
      ];
      
      setRecommendations(initialRecommendations);
      
      // Auto-select first ticker if none selected
      if (!selectedTicker) {
        selectTicker('NVDA');
      }
    }
  }, [recommendations.length, setRecommendations, selectedTicker, selectTicker]);

  // Real-time data updates are handled by:
  // 1. useStockData hook in ChartCanvas - fetches REST data and updates recommendations
  // 2. useMassiveWebSocket hook in ChartCanvas - receives WebSocket updates and updates recommendations
  // No mock WebSocket needed - all data comes from real sources (cache + REST + WebSocket)
  useEffect(() => {
    setIsLive(true);
    // Real WebSocket connection is managed in ChartCanvas component
  }, [setIsLive]);

  // Handle floating chat input submission
  const handleFloatingInputSubmit = async (text: string, attachments: MessageFile[], useMockService?: boolean) => {
    if (!text.trim() && attachments.length === 0) return;
    
    setIsCreatingChat(true);
    
    try {
      // Generate context prompt based on selected ticker
      const selected = recommendations.find(r => r.ticker === selectedTicker);
      const contextPrompt = selected
        ? `You are an expert stock analyst. The user is currently viewing the ${selected.ticker} (${selected.companyName}) stock page. Provide analysis and insights specific to ${selected.ticker} when relevant.`
        : undefined;
      
      // Prepend context to message text for sending
      const messageTextWithContext = contextPrompt 
        ? `${contextPrompt}\n\n${text.trim()}`
        : text.trim();
      
      // Create real chat session - no mock IDs
      if (!token || isLoadingToken) {
        console.warn('[Trade] Cannot create chat: token not available');
        setIsCreatingChat(false);
        return;
      }
      
      console.log('[Trade] Creating real chat session with context...');
      const newChatId = await createChatSession(token, 'Trade Chat', messageTextWithContext, attachments);
      console.log('[Trade] Chat created with ID:', newChatId);
      
      // Store the chat ID
      setChatId(newChatId);
      
      // Set pending message in chat store - ChatWindow will process it when it mounts
      // Store original text (without context) for display
      setPendingMessage(text, attachments, newChatId, useMockService || false);
      
      // Activate chat split view only if chat was successfully created
      setHasActiveChat(true);
    } catch (error) {
      console.error('[Trade] Failed to create chat session:', error);
      // Don't activate chat view if creation failed - show error instead
      // User can try again
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <div className="h-screen fixed inset-0 flex flex-col bg-[#0D0F12] text-white overflow-hidden">
      {/* Top Header */}
      <header className="h-16 flex-shrink-0 bg-[#121418] border-b border-white/4 flex items-center px-4 gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold text-white">Trade</h1>
        </div>
        
        <TopChipsBar />
        
        <div className="flex items-center gap-3 ml-auto">
          <MarketStatus />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Rail */}
        <LeftRail />

        {/* Center Canvas - takes remaining space, full width when no chat */}
        {hasActiveChat ? (
          // Split view with ResizablePanelGroup - only show when chat is active
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              {/* Left Panel: Trade Content */}
              <ResizablePanel defaultSize={65} minSize={40}>
                <div className="p-4 sm:p-6 gap-4 flex flex-col h-full overflow-y-auto min-h-0">
                  <HeroCard />
                  <ChartCanvas />
                  
                  {/* Summary Section */}
                  {(() => {
                    const selected = recommendations.find(r => r.ticker === selectedTicker);
                    if (!selected) return null;
                    
                    return (
                      <div className="bg-[#121418] rounded-lg border border-white/4 p-6">
                        <h3 className="text-sm font-semibold text-white/80 mb-3 uppercase tracking-wider">
                          Key Signals
                        </h3>
                        <ul className="space-y-2">
                          {selected.signals.map((signal, idx) => (
                            <li key={idx} className="text-sm text-white/70 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4EA8F5]" />
                              <strong>{signal.name}:</strong> {signal.desc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Panel: Chat Window - only visible when chat is active */}
              <ResizablePanel defaultSize={35} minSize={30} className="overflow-hidden">
                <div className="h-full bg-[#0D0F12] relative">
                  {/* Close button */}
                  <button
                    onClick={() => setHasActiveChat(false)}
                    className="absolute top-2 right-2 z-50 p-1.5 rounded-full bg-[#121418]/90 hover:bg-[#121418] border border-white/10 hover:border-white/20 transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 text-white/70 hover:text-white" />
                  </button>
                  {chatId && (() => {
                    // Generate context prompt based on selected ticker
                    const selected = recommendations.find(r => r.ticker === selectedTicker);
                    const contextPrompt = selected
                      ? `You are an expert stock analyst. The user is currently viewing the ${selected.ticker} (${selected.companyName}) stock page. Provide analysis and insights specific to ${selected.ticker} when relevant.`
                      : undefined;
                    
                    return (
                      <ChatWindow 
                        chatId={chatId} 
                        className="h-full"
                        contextPrompt={contextPrompt}
                      />
                    );
                  })()}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          // Default view: Trade content with floating chat input - takes full width, NO chat panel
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 gap-4 flex flex-col">
              <HeroCard />
              <ChartCanvas />
              
              {/* Summary Section */}
              {(() => {
                const selected = recommendations.find(r => r.ticker === selectedTicker);
                if (!selected) return null;
                
                return (
                  <div className="bg-[#121418] rounded-lg border border-white/4 p-6">
                    <h3 className="text-sm font-semibold text-white/80 mb-3 uppercase tracking-wider">
                      Key Signals
                    </h3>
                    <ul className="space-y-2">
                      {selected.signals.map((signal, idx) => (
                        <li key={idx} className="text-sm text-white/70 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4EA8F5]" />
                          <strong>{signal.name}:</strong> {signal.desc}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* Floating Chat Input */}
            <div className="flex-shrink-0 border-t border-white/5 bg-[#0D0F12] p-4">
              <div className="max-w-3xl mx-auto">
                <PromptInputWithActions
                  onSubmit={handleFloatingInputSubmit}
                  isLoading={isCreatingChat || isLoadingToken}
                  isInEmptyState={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer */}
      <DetailDrawer />
      
    </div>
  );
}

