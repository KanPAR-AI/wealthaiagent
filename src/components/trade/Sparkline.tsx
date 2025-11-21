// components/trade/Sparkline.tsx

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { SparklinePoint } from '@/types/trade';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: SparklinePoint[];
  className?: string;
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ 
  data, 
  className,
  color = '#4EA8F5',
  width = 60,
  height = 20
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className={cn("flex items-center justify-center", className)}
        style={{ width, height }}
      >
        <span className="text-[10px] text-white/20">—</span>
      </div>
    );
  }

  // Convert to Recharts format
  const chartData = data.map((point, idx) => ({
    value: point.v,
    index: idx,
  }));

  return (
    <div className={cn("overflow-hidden", className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

