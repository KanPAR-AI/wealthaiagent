// components/trade/TopChipsBar.tsx

import { useTradeStore } from '@/store/trade';
import { ScoreBadge } from './ScoreBadge';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export function TopChipsBar() {
  const { recommendations, selectedTicker, selectTicker } = useTradeStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected chip
  useEffect(() => {
    if (selectedTicker && scrollRef.current) {
      const chip = scrollRef.current.querySelector(`[data-ticker="${selectedTicker}"]`);
      if (chip) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedTicker]);

  return (
    <div className="flex-1 overflow-x-auto scrollbar-hide">
      <div
        ref={scrollRef}
        className="flex gap-2 px-4 py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {recommendations.map((rec) => (
          <button
            key={rec.ticker}
            data-ticker={rec.ticker}
            onClick={() => selectTicker(rec.ticker)}
            className={cn(
              "px-3 py-1.5 rounded backdrop-blur-md border transition-all duration-180",
              "flex items-center gap-2 whitespace-nowrap",
              "focus:outline-none focus:ring-2 focus:ring-[#4EA8F5]/50 focus:ring-offset-2 focus:ring-offset-[#0D0F12]",
              selectedTicker === rec.ticker
                ? "bg-white/10 border-white/20 shadow-[0_6px_20px_rgba(78,168,245,0.12)]"
                : "bg-white/5 border-white/6 hover:bg-white/8 hover:border-white/10"
            )}
            style={{
              transition: 'all 180ms cubic-bezier(0.18, 0.9, 0.32, 1.3)',
            }}
          >
            <span className="text-sm font-semibold text-white">{rec.ticker}</span>
            <span className="text-white/40">•</span>
            <span className="text-xs font-medium text-[#4EA8F5]">{rec.score.toFixed(1)}</span>
            {rec.confidence > 85 && (
              <>
                <span className="text-white/40">•</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#2ED573]" />
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

