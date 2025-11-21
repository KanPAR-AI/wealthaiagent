// components/trade/StockMetrics.tsx

import { useTradeStore } from '@/store/trade';
import { cn } from '@/lib/utils';

function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1000000000000) {
    return `$${(value / 1000000000000).toFixed(decimals)}T`;
  } else if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(decimals)}B`;
  } else if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(decimals)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(decimals)}K`;
  }
  return `$${value.toFixed(decimals)}`;
}

function formatVolume(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

export function StockMetrics() {
  const { recommendations, selectedTicker } = useTradeStore();
  const selected = recommendations.find(r => r.ticker === selectedTicker);

  if (!selected) {
    return null;
  }

  return (
    <div className="bg-[#121418] rounded-lg border border-white/4 p-6">
      <div className="grid grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-white/50 mb-1">Prev Close</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.prevClose)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">Open</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.open)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">Day Range</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.dayRange.low)}-{formatNumber(selected.dayRange.high)}
            </div>
          </div>
        </div>

        {/* Middle Column */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-white/50 mb-1">52W Range</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.yearRange.low)}-{formatNumber(selected.yearRange.high)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">P/E Ratio</div>
            <div className="text-sm font-medium text-white">
              {selected.peRatio.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">Volume</div>
            <div className="text-sm font-medium text-white">
              {formatVolume(selected.volume)}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-white/50 mb-1">Market Cap</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.marketCap, 2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">Dividend Yield</div>
            <div className="text-sm font-medium text-white">
              {selected.dividendYield.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">EPS</div>
            <div className="text-sm font-medium text-white">
              {formatNumber(selected.eps)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

