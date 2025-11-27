// components/trade/ChartCanvas.tsx

import { useState, useRef, useEffect } from 'react';
import { useTradeStore } from '@/store/trade';
import { cn } from '@/lib/utils';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { useMassiveWebSocket } from '@/hooks/use-massive-websocket';
import { MassiveAggregateMessage, MassiveMessage } from '@/services/massive-websocket';
import { useStockData } from '@/hooks/use-stock-data';
import { env } from '@/config/environment';

// Custom Event Dot Component with hover tooltip
const EventDot = ({ x, y, marker, onHoverChange }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const eventDate = new Date(marker.timestamp);
  const tooltipX = x;
  const tooltipY = y - 100; // Position tooltip above the dot

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onHoverChange) {
      onHoverChange(marker.timestamp, true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHoverChange) {
      onHoverChange(marker.timestamp, false);
    }
  };

  return (
    <g style={{ transform: 'none' }}>
      {/* Pulsing ring effect - larger outer ring */}
      <circle
        cx={x}
        cy={y}
        r={8}
        fill="none"
        stroke="#4EA8F5"
        strokeWidth={1.5}
        opacity={0.3}
        className="pulse-ring"
        style={{ transform: 'none', transition: 'none' }}
      />
      {/* Small center dot - precise point on chart line */}
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="#4EA8F5"
        stroke="#ffffff"
        strokeWidth={1.5}
        className="cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ 
          filter: 'drop-shadow(0 0 4px rgba(78, 168, 245, 0.8))',
          transform: 'none',
          transition: 'none',
          pointerEvents: 'all'
        }}
      />
      {/* Tooltip */}
      {isHovered && (
        <g>
          {/* Tooltip background */}
          <foreignObject
            x={tooltipX - 120}
            y={tooltipY}
            width="240"
            height="140"
            className="pointer-events-none"
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-lg">
              <div className="text-xs space-y-1.5">
                <div className="font-semibold text-white">
                  {eventDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {marker.note && (
                  <div className="text-white/80">{marker.note}</div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Score:</span>
                  <span className="text-[#4EA8F5] font-semibold">{marker.score.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Price:</span>
                  <span className="text-white font-semibold">${marker.eventPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Return since:</span>
                  <span className={cn(
                    "font-semibold",
                    marker.returnPercent >= 0 ? "text-[#2ED573]" : "text-[#FF6B6B]"
                  )}>
                    {marker.returnPercent >= 0 ? '+' : ''}{marker.returnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
};

interface ChartCanvasProps {
  className?: string;
}

export function ChartCanvas({ className }: ChartCanvasProps) {
  const { recommendations, selectedTicker, updateRecommendation } = useTradeStore();
  const [timeRange, setTimeRange] = useState<'3H' | '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('5D');
  const [hoveredEventDot, setHoveredEventDot] = useState<string | null>(null);

  const selected = recommendations.find(r => r.ticker === selectedTicker);

  // Fetch real stock data using the new service (with REST fallback and caching)
  const {
    quote: realQuote,
    sparkline: realSparkline,
    isLoading: isLoadingRealData,
    source: dataSource,
    isCached: isDataCached,
    refresh: refreshStockData,
  } = useStockData({
    symbol: selectedTicker,
    preferWebSocket: false, // Start with REST since WebSocket is having issues
    useCache: true,
    sparklineTimeframe: '1min',
    sparklineDays: 7,
    autoRefresh: true,
    refreshInterval: 60000, // Refresh every minute
  });

  // Update recommendation with real data when it arrives
  useEffect(() => {
    if (selectedTicker && realQuote && realSparkline.length > 0) {
      console.log(`[ChartCanvas] Updating ${selectedTicker} with real data:`, {
        price: realQuote.price,
        sparklinePoints: realSparkline.length,
        source: dataSource,
      });
      
      // Merge real data with existing recommendation
      updateRecommendation(selectedTicker, {
        price: realQuote.price,
        priceChangePercent: realQuote.changePercent,
        sparkline: realSparkline,
        lastUpdated: new Date().toISOString(),
        // Update other fields from quote if available
        prevClose: realQuote.previousClose || selected?.prevClose,
        open: realQuote.open || selected?.open,
        dayRange: {
          low: realQuote.low || selected?.dayRange.low || 0,
          high: realQuote.high || selected?.dayRange.high || 0,
        },
        volume: realQuote.volume || selected?.volume || 0,
      });
    } else if (selectedTicker && isLoadingRealData) {
      console.log(`[ChartCanvas] Loading real data for ${selectedTicker}...`);
    } else if (selectedTicker && !realQuote) {
      console.log(`[ChartCanvas] No real data yet for ${selectedTicker}, using mock data`);
    }
  }, [selectedTicker, realQuote, realSparkline, dataSource, isLoadingRealData, selected, updateRecommendation]);

  // WebSocket integration for real-time data
  const handleWebSocketMessage = (message: MassiveMessage) => {
    // Get fresh state from store to avoid stale closures
    // Using getState() is safe here since this callback may be called outside React's render cycle
    const storeState = useTradeStore.getState();
    const currentTicker = storeState.selectedTicker;
    const currentRecommendations = storeState.recommendations;
    
    if (!currentTicker) return;

    // Handle array of messages
    if (Array.isArray(message)) {
      message.forEach(msg => handleWebSocketMessage(msg));
      return;
    }

    // Handle aggregate minute (AM) messages
    if (message.ev === 'AM' && message.sym === currentTicker.toUpperCase()) {
      const amMessage = message as MassiveAggregateMessage;
      
      // Create a new sparkline point from the aggregate data
      // Use the end timestamp and close price
      const newPoint = {
        t: amMessage.e, // End timestamp
        v: amMessage.c, // Close price
      };

      // Update the recommendation with new sparkline data
      const currentRecommendation = currentRecommendations.find(r => r.ticker === currentTicker);
      if (currentRecommendation) {
        const existingSparkline = currentRecommendation.sparkline || [];
        
        // Check if we already have a point for this timestamp (within 1 minute tolerance)
        const existingIndex = existingSparkline.findIndex(
          point => Math.abs(point.t - newPoint.t) < 60000 // 1 minute in ms
        );

        let updatedSparkline: typeof existingSparkline;
        
        if (existingIndex >= 0) {
          // Update existing point
          updatedSparkline = [...existingSparkline];
          updatedSparkline[existingIndex] = newPoint;
        } else {
          // Add new point and sort by timestamp
          updatedSparkline = [...existingSparkline, newPoint].sort((a, b) => a.t - b.t);
        }

        // Also update the current price if this is the latest data point
        const latestTimestamp = Math.max(...updatedSparkline.map(p => p.t));
        if (newPoint.t >= latestTimestamp) {
          storeState.updateRecommendation(currentTicker, {
            sparkline: updatedSparkline,
            price: amMessage.c,
            priceChangePercent: currentRecommendation.prevClose 
              ? ((amMessage.c - currentRecommendation.prevClose) / currentRecommendation.prevClose) * 100
              : 0,
            lastUpdated: new Date().toISOString(),
          });
        } else {
          storeState.updateRecommendation(currentTicker, {
            sparkline: updatedSparkline,
          });
        }
      }
    }
  };

  // Try delayed endpoint if real-time fails (especially when market is closed)
  // Start with delayed endpoint if it's likely a market holiday/weekend
  const shouldStartWithDelayed = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const month = now.getMonth(); // 0 = January
    const date = now.getDate();
    
    // Weekend
    if (day === 0 || day === 6) return true;
    
    // Check for Thanksgiving (4th Thursday of November) - simplified check
    if (month === 10) { // November
      const year = now.getFullYear();
      const nov1 = new Date(year, 10, 1);
      const dayOfWeek = nov1.getDay();
      let firstThursday = 1;
      if (dayOfWeek <= 4) {
        firstThursday = 4 - dayOfWeek + 1;
      } else {
        firstThursday = 4 - dayOfWeek + 8;
      }
      const thanksgiving = firstThursday + 21;
      if (date === thanksgiving) return true;
    }
    
    return false;
  };

  const [useRealtime, setUseRealtime] = useState(!shouldStartWithDelayed());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasTriedDelayed, setHasTriedDelayed] = useState(shouldStartWithDelayed());

  const { status: wsStatus, isConnected } = useMassiveWebSocket({
    apiKey: env.massiveApiKey || '',
    symbol: selectedTicker,
    useRealtime: useRealtime,
    autoConnect: !!env.massiveApiKey && !!selectedTicker,
    onMessage: handleWebSocketMessage,
    onStatusChange: (status) => {
      console.log('[ChartCanvas] WebSocket status:', status);
      if (status === 'error') {
        setConnectionError('Connection failed');
      } else {
        setConnectionError(null);
      }
    },
    onError: (error) => {
      console.error('[ChartCanvas] WebSocket error:', error);
      setConnectionError(error.message);
      
      // If real-time fails and we haven't tried delayed yet, switch to delayed
      // Especially if error mentions market closed or connection failure
      if (useRealtime && !hasTriedDelayed && 
          (error.message.includes('connection') || error.message.includes('Market is closed'))) {
        console.log('[ChartCanvas] Real-time connection failed, trying delayed endpoint...');
        setHasTriedDelayed(true);
        setTimeout(() => {
          setUseRealtime(false);
        }, 2000);
      }
    },
  });
  
  // Calculate time range filter
  const getTimeRangeFilter = (range: string) => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '3H': 3 * 60 * 60 * 1000,       // 3 hours
      '1D': 24 * 60 * 60 * 1000,      // 1 day
      '5D': 5 * 24 * 60 * 60 * 1000,  // 5 days
      '1M': 30 * 24 * 60 * 60 * 1000, // 1 month
      '3M': 90 * 24 * 60 * 60 * 1000, // 3 months
      '6M': 180 * 24 * 60 * 60 * 1000, // 6 months
      '1Y': 365 * 24 * 60 * 60 * 1000, // 1 year
      'ALL': Infinity,                 // All data
    };
    return ranges[range] || ranges['5D'];
  };

  const timeRangeMs = getTimeRangeFilter(timeRange);
  const cutoffTime = timeRangeMs === Infinity ? 0 : Date.now() - timeRangeMs;
  
  // Convert sparkline data to Recharts format and filter by time range
  const filteredPoints = selected?.sparkline
    .filter((point) => point.t >= cutoffTime)
    .sort((a, b) => a.t - b.t) || [];

  // Remove outliers at the end that cause big jumps
  // Check if the last point has an abnormal jump compared to the trend
  const cleanedPoints = (() => {
    if (filteredPoints.length < 3) return filteredPoints;
    
    const points = [...filteredPoints];
    const lastPoint = points[points.length - 1];
    const secondLastPoint = points[points.length - 2];
    const thirdLastPoint = points[points.length - 3];
    
    // Calculate the trend from previous points
    const previousTrend = secondLastPoint.v - thirdLastPoint.v;
    const expectedLastValue = secondLastPoint.v + previousTrend;
    
    // Calculate the actual jump
    const actualJump = lastPoint.v - secondLastPoint.v;
    const expectedJump = expectedLastValue - secondLastPoint.v;
    
    // If the jump is more than 3x the expected trend, it's likely an outlier
    const jumpRatio = Math.abs(actualJump) / (Math.abs(expectedJump) || Math.abs(previousTrend) || 0.01);
    
    // If jump is more than 5% of the price and 3x the trend, remove or smooth it
    const pricePercentChange = Math.abs(actualJump) / secondLastPoint.v;
    
    if (jumpRatio > 3 && pricePercentChange > 0.05) {
      // Remove the outlier point
      return points.slice(0, -1);
    }
    
    // If there's still a significant jump but not as extreme, smooth it
    if (jumpRatio > 2 && pricePercentChange > 0.02) {
      // Interpolate between second last and last point to smooth the transition
      const smoothedValue = secondLastPoint.v + (expectedLastValue - secondLastPoint.v) * 0.5;
      return [
        ...points.slice(0, -1),
        { ...lastPoint, v: smoothedValue }
      ];
    }
    
    return points;
  })();

  const chartData = cleanedPoints.map((point, idx) => {
    const date = new Date(point.t);
    let timeLabel: string;
    
    // Format time label based on range - simplified for readability
    if (timeRange === '3H') {
      // Show hour and minute (e.g., "2:30 PM", "10:15 AM")
      const hour = date.getHours();
      const minute = date.getMinutes();
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      timeLabel = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    } else if (timeRange === '1D') {
      // Show hour only (e.g., "2 PM", "10 AM")
      const hour = date.getHours();
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      timeLabel = `${displayHour} ${period}`;
    } else if (timeRange === '5D') {
      // Show day and hour (e.g., "Nov 21, 2PM")
      timeLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
                 ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
    } else if (timeRange === '1M') {
      // Show day only (e.g., "Nov 21")
      timeLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeRange === '3M' || timeRange === '6M') {
      // Show month and day (e.g., "Nov 21")
      timeLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // Show month and year (e.g., "Nov '24")
      timeLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    
    return {
      time: timeLabel,
      value: Math.round(point.v * 100) / 100,
      timestamp: point.t,
      index: idx,
      fullDate: date,
    };
  });
  
  // Calculate X-axis interval based on time range to avoid crowding
  const dataLength = chartData.length;
  let xAxisInterval: number | 'preserveStartEnd';
  
  if (dataLength === 0) {
    xAxisInterval = 0;
  } else if (timeRange === '3H') {
    // For 3H, show ~6 labels (every 30 minutes)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 6));
  } else if (timeRange === '1D') {
    // For 1D, show ~6 labels (every 4 hours)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 6));
  } else if (timeRange === '5D') {
    // For 5D, show ~8 labels (every 12-15 hours)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 8));
  } else if (timeRange === '1M') {
    // For 1M, show ~10 labels (every 3 days)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 10));
  } else if (timeRange === '3M') {
    // For 3M, show ~10 labels (every week)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 10));
  } else if (timeRange === '6M') {
    // For 6M, show ~12 labels (every 2 weeks)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 12));
  } else if (timeRange === '1Y') {
    // For 1Y, show ~12 labels (every month)
    xAxisInterval = Math.max(0, Math.floor(dataLength / 12));
  } else {
    // For ALL, show ~8 labels
    xAxisInterval = Math.max(0, Math.floor(dataLength / 8));
  }

  if (!selected) {
    return (
      <div className={cn("bg-[#121418] rounded-lg border border-white/4 p-4 sm:p-6", className)}>
        <div className="flex items-center justify-center" style={{ height: 'clamp(300px, 40vh, 400px)' }}>
          <div className="text-white/40 text-sm sm:text-base">Select a ticker to view chart</div>
        </div>
      </div>
    );
  }

  // Calculate previous close (first point of the day or previous day's last point)
  const calculatePrevClose = () => {
    if (!selected?.sparkline || selected.sparkline.length === 0) return null;
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Find the last point before today (previous day's close)
    const prevDayPoints = selected.sparkline
      .filter(p => p.t < oneDayAgo)
      .sort((a, b) => b.t - a.t); // Sort descending to get most recent first
    
    if (prevDayPoints.length > 0) {
      return prevDayPoints[0].v;
    }
    
    // Fallback: use first point of current data if no previous day data
    if (chartData.length > 0) {
      return chartData[0].value;
    }
    
    return null;
  };

  const prevClose = calculatePrevClose() || selected.prevClose;
  
  // Determine overall trend (compare first and last values)
  const isUpwardTrend = chartData.length > 0 
    ? chartData[chartData.length - 1].value >= (chartData[0]?.value || 0)
    : true;
  
  const chartColor = isUpwardTrend ? '#2ED573' : '#FF6B6B'; // Green for up, red for down
  const gradientId = isUpwardTrend ? 'colorValueUp' : 'colorValueDown';

  // Get recommendation event markers with return calculation
  // Filter events to only those within the visible time range
  const visibleMarkers = (chartData.length > 0 && selected.recommendationEvents?.length > 0)
    ? selected.recommendationEvents
        .filter((event) => {
          const eventTime = new Date(event.timestamp).getTime();
          // Check if event is within the visible chart data time range
          const eventInRange = chartData.some(d => 
            Math.abs(d.timestamp - eventTime) < (24 * 60 * 60 * 1000) // Within 1 day
          );
          return eventInRange;
        })
        .map((event) => {
          const eventTime = new Date(event.timestamp).getTime();
          const closestPoint = chartData.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.timestamp - eventTime);
            const currDiff = Math.abs(curr.timestamp - eventTime);
            return currDiff < prevDiff ? curr : prev;
          });
          
          // Calculate return since event
          const eventPrice = closestPoint.value;
          const currentPrice = selected.price;
          const returnPercent = eventPrice > 0 
            ? ((currentPrice - eventPrice) / eventPrice) * 100 
            : 0;
          
          return {
            ...closestPoint,
            score: event.score,
            note: event.note,
            type: event.type,
            timestamp: event.timestamp,
            eventPrice,
            returnPercent,
          };
        })
    : [];
  
  console.log('Visible markers:', visibleMarkers.length, visibleMarkers);

  // Format functions for metrics
  const formatNumber = (value: number, decimals: number = 2): string => {
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
  };

  const formatVolume = (value: number): string => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  return (
    <div className={cn("relative bg-[#121418] rounded-lg border border-white/4 p-4 sm:p-6", className)}>
      {/* WebSocket Connection Status Indicator */}
      {env.massiveApiKey && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected
                  ? "bg-[#2ED573] animate-pulse"
                  : wsStatus === 'connecting' || wsStatus === 'authenticating'
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              )}
            />
            <span className="text-[10px] text-white/50">
              {isConnected
                ? 'Live'
                : wsStatus === 'connecting'
                ? 'Connecting...'
                : wsStatus === 'authenticating'
                ? 'Authenticating...'
                : wsStatus === 'error'
                ? 'Connection Error'
                : 'Offline'}
            </span>
            {!useRealtime && (
              <span className="text-[10px] text-yellow-500/70">(Delayed)</span>
            )}
            {dataSource && (
              <span className="text-[10px] text-white/40">
                ({dataSource === 'rest' ? 'REST' : dataSource === 'cache' ? 'Cached' : 'WebSocket'})
                {isDataCached && ' • Cached'}
              </span>
            )}
          </div>
          {isLoadingRealData && (
            <div className="text-[10px] text-yellow-500/70">
              Loading real-time data...
            </div>
          )}
          {connectionError && wsStatus === 'error' && (
            <div className="text-[10px] text-red-400/70 max-w-xs">
              {connectionError.includes('Firefox') || navigator.userAgent.toLowerCase().includes('firefox') ? (
                <span>Firefox: Check about:config for network.http.spdy.websockets</span>
              ) : connectionError.includes('Market is closed') ? (
                <span>Market closed - using REST API</span>
              ) : (
                <span>{connectionError}</span>
              )}
            </div>
          )}
        </div>
      )}
      {/* Time Range Buttons */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
        {(['3H', '1D', '5D', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              "px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded transition-colors",
              timeRange === range
                ? "bg-[#4EA8F5]/20 text-[#4EA8F5] border border-[#4EA8F5]/30"
                : "bg-white/5 text-white/60 hover:bg-white/8 border border-white/6"
            )}
          >
            {range}
          </button>
        ))}
      </div>
      
      {/* Chart */}
      <div className="w-full" style={{ height: 'clamp(300px, 40vh, 400px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="colorValueUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ED573" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2ED573" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorValueDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255, 255, 255, 0.4)"
              style={{ fontSize: '11px' }}
              interval={xAxisInterval}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="rgba(255, 255, 255, 0.4)"
              style={{ fontSize: '11px' }}
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: chartColor, marginBottom: '4px' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
              labelFormatter={(label) => {
                const point = chartData.find(d => d.time === label);
                if (point?.fullDate) {
                  return point.fullDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }
                return label;
              }}
              // Hide chart tooltip when hovering over event dots
              active={hoveredEventDot === null ? undefined : false}
            />
            {prevClose && (
              <ReferenceLine
                y={prevClose}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeDasharray="3 3"
                label={{ value: `Prev. close $${prevClose.toFixed(2)}`, position: 'right', fill: 'rgba(255, 255, 255, 0.5)', style: { fontSize: '11px' } }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
            {/* Render event dots - use index from chartData */}
            {visibleMarkers.length > 0 && visibleMarkers.map((marker, idx) => {
              // Find the exact index in chartData by matching timestamp (more reliable than time string)
              const eventTimestamp = new Date(marker.timestamp).getTime();
              const dataIndex = chartData.findIndex(d => 
                Math.abs(d.timestamp - eventTimestamp) < 1000 // Within 1 second
              );
              
              // If not found by timestamp, try by time string
              const altIndex = dataIndex === -1 ? chartData.findIndex(d => d.time === marker.time) : dataIndex;
              
              console.log(`Marker ${idx}:`, {
                markerTime: marker.time,
                markerTimestamp: marker.timestamp,
                markerValue: marker.value,
                dataIndex: altIndex,
                chartDataLength: chartData.length,
                foundInChart: altIndex !== -1,
                chartDataSample: chartData.slice(0, 3).map(d => ({ time: d.time, timestamp: d.timestamp }))
              });
              
              // Only render if we found a matching data point
              if (altIndex === -1) {
                console.warn(`Marker ${idx} not found in chartData. Time: ${marker.time}, Timestamp: ${marker.timestamp}`);
                return null;
              }
              
              return (
                <ReferenceDot
                  key={`event-${idx}-${marker.timestamp}`}
                  x={altIndex}
                  y={marker.value}
                  shape={(props: any) => {
                    if (!props || !props.cx || !props.cy) {
                      // Return a simple circle as fallback
                      return <circle cx={0} cy={0} r={6} fill="#4EA8F5" />;
                    }
                    return (
                      <EventDot
                        x={props.cx}
                        y={props.cy}
                        marker={marker}
                        onHoverChange={(timestamp: string, isHovered: boolean) => {
                          setHoveredEventDot(isHovered ? timestamp : null);
                        }}
                      />
                    );
                  }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stock Metrics */}
      <div className="border-t border-white/4 ">
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
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
    </div>
  );
}
