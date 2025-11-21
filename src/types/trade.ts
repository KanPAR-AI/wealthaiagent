// types/trade.ts

export interface Signal {
  name: string;
  weight: number; // 0-100
  desc: string;
}

export interface RecommendationEvent {
  timestamp: string; // ISO 8601
  score: number;
  type: string;
  note?: string;
}

export interface SparklinePoint {
  t: number; // timestamp
  v: number; // value (price)
}

export interface Recommendation {
  ticker: string;
  companyName: string;
  exchange: string;
  rank: number;
  score: number;
  confidence: number;
  price: number;
  priceChangePercent: number;
  lastUpdated: string; // ISO 8601
  sparkline: SparklinePoint[];
  explainSummary: string;
  signals: Signal[];
  recommendationEvents: RecommendationEvent[];
  // Financial metrics
  prevClose: number;
  open: number;
  dayRange: { low: number; high: number };
  yearRange: { low: number; high: number };
  peRatio: number;
  volume: number;
  marketCap: number;
  dividendYield: number;
  eps: number;
}

export interface TradeState {
  recommendations: Recommendation[];
  selectedTicker: string | null;
  lastUpdated: string | null;
  isLive: boolean;
  leftRailExpanded: boolean;
  drawerOpen: boolean;
  pinnedTickers: Set<string>;
  
  // Actions
  setRecommendations: (recommendations: Recommendation[]) => void;
  updateRecommendation: (ticker: string, updates: Partial<Recommendation>) => void;
  selectTicker: (ticker: string | null) => void;
  setLastUpdated: (timestamp: string) => void;
  setIsLive: (isLive: boolean) => void;
  toggleLeftRail: () => void;
  setDrawerOpen: (open: boolean) => void;
  togglePinTicker: (ticker: string) => void;
}

