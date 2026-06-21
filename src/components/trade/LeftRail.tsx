// components/trade/LeftRail.tsx

import { useTradeStore } from '@/store/trade';
import { Sparkline } from './Sparkline';
import { ScoreBadge } from './ScoreBadge';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function LeftRail() {
  const {
    recommendations,
    selectedTicker,
    leftRailExpanded,
    pinnedTickers,
    selectTicker,
    toggleLeftRail,
    togglePinTicker,
  } = useTradeStore();

  const sortedRecs = [...recommendations].sort((a, b) => a.rank - b.rank);

  if (!leftRailExpanded) {
    return (
      <div className="w-16 bg-[#121418] border-r border-white/4 flex flex-col items-center py-4">
        <button
          onClick={toggleLeftRail}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Expand recommendations"
        >
          <ChevronRight className="w-4 h-4 text-white/60" />
        </button>
        <div className="flex-1 flex flex-col gap-2 mt-4 w-full px-2">
          {sortedRecs.slice(0, 8).map((rec) => (
            <TooltipProvider key={rec.ticker}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => selectTicker(rec.ticker)}
                    className={cn(
                      "w-full p-2 rounded-lg transition-all",
                      selectedTicker === rec.ticker
                        ? "bg-white/10 ring-2 ring-[#25D366]/50"
                        : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-white">{rec.ticker}</span>
                      <span className="text-[10px] text-[#25D366]">{rec.score.toFixed(0)}</span>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-white/10 backdrop-blur-md border-white/10">
                    <div className="text-xs">
                    <div className="font-semibold text-white">{rec.ticker}</div>
                    <div className="text-white">{rec.companyName}</div>
                    <div className="text-[#25D366] mt-1">Score: {rec.score.toFixed(1)}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] bg-[#121418] border-r border-white/4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-white/4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          Recommendations
        </h2>
        <button
          onClick={toggleLeftRail}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Collapse recommendations"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedRecs.map((rec) => {
          const isPinned = pinnedTickers.has(rec.ticker);
          const isSelected = selectedTicker === rec.ticker;
          
          return (
            <TooltipProvider key={rec.ticker}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => selectTicker(rec.ticker)}
                    className={cn(
                      "w-full p-3 border-b border-white/4 transition-all text-left",
                      "hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50",
                      isSelected && "bg-white/8 ring-2 ring-[#25D366]/30"
                    )}
                    style={{
                      transition: 'all 180ms cubic-bezier(0.18, 0.9, 0.32, 1.3)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 text-xs font-bold text-white/40 pt-0.5">
                        #{rec.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{rec.ticker}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 uppercase">
                            {rec.exchange}
                          </span>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-[#25D366]" fill="currentColor" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <ScoreBadge score={rec.score} size="sm" />
                          <span className={cn(
                            "text-xs font-medium",
                            rec.priceChangePercent >= 0 ? "text-[#2ED573]" : "text-[#FF6B6B]"
                          )}>
                            {rec.priceChangePercent >= 0 ? '+' : ''}{rec.priceChangePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Sparkline data={rec.sparkline} width={80} height={24} />
                          <div className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 backdrop-blur-sm">
                            {rec.confidence.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-white/10 backdrop-blur-md border-white/10 p-3 max-w-xs"
                >
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-white">{rec.ticker}</div>
                    <div className="text-white">{rec.companyName}</div>
                    <div className="text-white mt-2">{rec.explainSummary}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {sortedRecs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-white text-sm">
          No recommendations
        </div>
      )}
    </div>
  );
}

