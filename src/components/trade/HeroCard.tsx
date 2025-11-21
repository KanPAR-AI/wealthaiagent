// components/trade/HeroCard.tsx

import { useTradeStore } from '@/store/trade';
import { cn } from '@/lib/utils';
import { Pin, PinOff, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatVolumeWithCommas(value: number): string {
  return value.toLocaleString('en-IN');
}

export function HeroCard() {
  const {
    recommendations,
    selectedTicker,
    pinnedTickers,
    togglePinTicker,
    drawerOpen,
    setDrawerOpen,
  } = useTradeStore();

  const selected = recommendations.find(r => r.ticker === selectedTicker);

  if (!selected) {
    return (
      <div className="p-4 sm:p-6 bg-[#121418] rounded-lg border border-white/4">
        <div className="text-center text-white/40">
          Select a ticker to view details
        </div>
      </div>
    );
  }

  const isPinned = pinnedTickers.has(selected.ticker);
  const priceChange = selected.price - selected.prevClose;
  const priceChangeAbs = Math.abs(priceChange);
  
  // Calculate volume multiplier (assuming average volume is around 1M for most stocks)
  const avgVolume = 1000000;
  const volumeMultiplier = (selected.volume / avgVolume).toFixed(1);
  
  // Determine category grade based on score
  const getCategoryGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    return 'D';
  };

  return (
    <div className="p-4 sm:p-6 bg-[#121418] rounded-lg border border-white/4">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
        <div className="flex-1 w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{selected.companyName}</h1>
            <button
              onClick={() => togglePinTicker(selected.ticker)}
              className={cn(
                "p-1.5 rounded transition-colors",
                isPinned
                  ? "bg-[#4EA8F5]/20 text-[#4EA8F5]"
                  : "hover:bg-white/5 text-white/40"
              )}
              aria-label={isPinned ? 'Unpin ticker' : 'Pin ticker'}
            >
              {isPinned ? (
                <Pin className="w-4 h-4" fill="currentColor" />
              ) : (
                <PinOff className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="text-sm font-semibold text-white">{selected.ticker}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#4EA8F5]/20 text-[#4EA8F5] uppercase">
              {selected.exchange}
            </span>
          </div>
          
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-1.5 sm:mb-2">
            <div className="text-3xl sm:text-4xl font-bold text-white">${selected.price.toFixed(2)}</div>
            <div className={cn(
              "flex items-center gap-1 text-base sm:text-lg font-semibold",
              priceChange >= 0 ? "text-[#2ED573]" : "text-[#FF6B6B]"
            )}>
              <span>{priceChange >= 0 ? '+' : ''}${priceChangeAbs.toFixed(2)}</span>
              <span className="text-xs sm:text-sm">
                {priceChange >= 0 ? '↗' : '↘'} {selected.priceChangePercent >= 0 ? '+' : ''}{selected.priceChangePercent.toFixed(2)}% 1D
              </span>
            </div>
          </div>
          <div className="text-xs text-white/50 mb-3 sm:mb-4">
            At close: {new Date(selected.lastUpdated).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short'
            })}
          </div>
          
          <Button
            onClick={() => setDrawerOpen(true)}
            variant="outline"
            size="sm"
            className={cn(
              "bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs sm:text-sm",
              drawerOpen && "opacity-50"
            )}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            View Explanation
          </Button>
        </div>
        
        {/* Right Side - Scores and Metrics */}
        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 sm:gap-4 w-full sm:w-auto sm:min-w-[200px]">
          {/* Score */}
          <div className="text-left sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold text-[#2ED573] mb-0.5 sm:mb-1">
              {selected.score.toFixed(1)}
            </div>
            <div className="text-xs text-white/60">
              Confidence: {selected.confidence.toFixed(1)}%
            </div>
          </div>
          
          {/* Category Badge */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#2ED573] flex items-center justify-center">
            <span className="text-white font-bold text-xs sm:text-sm">
              {getCategoryGrade(selected.score)}
            </span>
          </div>
          
          {/* Volume */}
          <div className="text-left sm:text-right">
            <div className="text-xs sm:text-sm font-medium text-white">
              {formatVolumeWithCommas(selected.volume)}
            </div>
            <div className="text-xs text-white/60">
              {volumeMultiplier}x avg
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

