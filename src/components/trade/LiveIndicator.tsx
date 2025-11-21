// components/trade/LiveIndicator.tsx

import { useTradeStore } from '@/store/trade';
import { cn } from '@/lib/utils';

export function LiveIndicator() {
  const { isLive, lastUpdated } = useTradeStore();
  
  const getTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h ago`;
  };

  return (
    <div className="flex items-center gap-2 text-xs text-white/60">
      <div className={cn(
        "w-2 h-2 rounded-full",
        isLive ? "bg-[#2ED573] animate-pulse" : "bg-amber-500"
      )} />
      <span>{isLive ? 'Live' : 'Paused'}</span>
      {lastUpdated && (
        <span className="text-white/40">Updated: {getTimeAgo(lastUpdated)}</span>
      )}
    </div>
  );
}

