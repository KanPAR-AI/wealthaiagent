// store/trade.ts

import { create } from 'zustand';
import { TradeState, Recommendation } from '@/types/trade';

export const useTradeStore = create<TradeState>((set, get) => ({
  recommendations: [],
  selectedTicker: null,
  lastUpdated: null,
  isLive: true,
  leftRailExpanded: true,
  drawerOpen: false,
  pinnedTickers: new Set<string>(),

  setRecommendations: (recommendations) => {
    set({ recommendations, lastUpdated: new Date().toISOString() });
    
    // If selected ticker is no longer in recommendations and not pinned, clear selection
    const { selectedTicker, pinnedTickers } = get();
    if (selectedTicker && !pinnedTickers.has(selectedTicker)) {
      const stillExists = recommendations.some(r => r.ticker === selectedTicker);
      if (!stillExists) {
        set({ selectedTicker: null });
      }
    }
  },

  updateRecommendation: (ticker, updates) => {
    const { recommendations } = get();
    const updated = recommendations.map(r => 
      r.ticker === ticker ? { ...r, ...updates } : r
    );
    set({ recommendations: updated });
  },

  selectTicker: (ticker) => {
    set({ selectedTicker: ticker });
  },

  setLastUpdated: (timestamp) => {
    set({ lastUpdated: timestamp });
  },

  setIsLive: (isLive) => {
    set({ isLive });
  },

  toggleLeftRail: () => {
    set((state) => ({ leftRailExpanded: !state.leftRailExpanded }));
  },

  setDrawerOpen: (open) => {
    set({ drawerOpen: open });
  },

  togglePinTicker: (ticker) => {
    set((state) => {
      const newPinned = new Set(state.pinnedTickers);
      if (newPinned.has(ticker)) {
        newPinned.delete(ticker);
      } else {
        newPinned.add(ticker);
      }
      return { pinnedTickers: newPinned };
    });
  },
}));

