// lib/realtime.ts

import { Recommendation } from '@/types/trade';

type RealtimeEventType = 
  | 'recommendations:update'
  | 'ticker:update'
  | 'recommendation:event';

type RealtimeEventHandler = (data: any) => void;

class MockWebSocketService {
  private listeners: Map<RealtimeEventType, Set<RealtimeEventHandler>> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isConnected = false;

  connect() {
    if (this.isConnected) return;
    
    this.isConnected = true;
    console.log('[MockWebSocket] Connected');

    // Simulate periodic updates
    this.intervalId = setInterval(() => {
      this.simulateUpdate();
    }, 5000); // Update every 5 seconds
  }

  disconnect() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isConnected = false;
    console.log('[MockWebSocket] Disconnected');
  }

  on(event: RealtimeEventType, handler: RealtimeEventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  private emit(event: RealtimeEventType, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  private simulateUpdate() {
    // Simulate subtle ticker updates (small variations)
    const tickers = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'META', 'NFLX'];
    const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
    
    // Generate subtle changes (±2% price, ±1 point score)
    const basePrice = 150 + Math.random() * 350;
    const priceChange = (Math.random() - 0.5) * 0.04; // ±2%
    
    this.emit('ticker:update', {
      ticker: randomTicker,
      score: 85 + Math.random() * 15,
      price: basePrice * (1 + priceChange),
      priceChangePercent: priceChange * 100,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Method to trigger a full recommendations update (for testing)
  triggerRecommendationsUpdate(recommendations: Recommendation[]) {
    this.emit('recommendations:update', {
      recommendations,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Method to trigger a recommendation event (for testing)
  triggerRecommendationEvent(ticker: string, score: number, note?: string) {
    this.emit('recommendation:event', {
      ticker,
      timestamp: new Date().toISOString(),
      score,
      type: 'algorithm',
      note,
    });
  }
}

export const mockWebSocketService = new MockWebSocketService();

