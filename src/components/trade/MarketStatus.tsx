// components/trade/MarketStatus.tsx

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function MarketStatus() {
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    nextOpenTime: string | null;
  }>({ isOpen: false, nextOpenTime: null });

  useEffect(() => {
    const updateMarketStatus = () => {
      const now = new Date();
      const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      
      const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
      const hours = etTime.getHours();
      const minutes = etTime.getMinutes();
      const currentTime = hours * 60 + minutes;
      
      const marketOpenTime = 9 * 60 + 30; // 9:30 AM ET
      const marketCloseTime = 16 * 60; // 4:00 PM ET
      
      // Check if it's a weekday (Monday-Friday)
      const isWeekday = day >= 1 && day <= 5;
      
      // Check if market is currently open
      const isOpen = isWeekday && currentTime >= marketOpenTime && currentTime < marketCloseTime;
      
      let nextOpenTime: string | null = null;
      
      if (!isOpen) {
        // Calculate next market open time
        const nextOpen = new Date(etTime);
        
        if (!isWeekday || currentTime >= marketCloseTime) {
          // Market is closed for today, find next weekday
          let daysToAdd = 1;
          if (day === 5) daysToAdd = 3; // Friday -> Monday
          else if (day === 6) daysToAdd = 2; // Saturday -> Monday
          else if (day === 0) daysToAdd = 1; // Sunday -> Monday
          
          nextOpen.setDate(nextOpen.getDate() + daysToAdd);
          nextOpen.setHours(9, 30, 0, 0);
        } else {
          // Market opens later today
          nextOpen.setHours(9, 30, 0, 0);
        }
        
        // Format next open time
        const options: Intl.DateTimeFormatOptions = {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
        };
        
        nextOpenTime = nextOpen.toLocaleString('en-US', options);
      }
      
      setMarketStatus({ isOpen, nextOpenTime });
    };
    
    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-white/70">
      <div className={cn(
        "w-2 h-2 rounded-full",
        marketStatus.isOpen ? "bg-[#2ED573]" : "bg-white/40"
      )} />
      <span className="font-medium">
        {marketStatus.isOpen ? 'Market Open' : 'Market Closed'}
      </span>
      {marketStatus.nextOpenTime && (
        <span className="text-white/50">
          Opens {marketStatus.nextOpenTime} ET
        </span>
      )}
    </div>
  );
}

