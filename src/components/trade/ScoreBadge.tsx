// components/trade/ScoreBadge.tsx

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = 'md', showLabel = false, className }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    hero: 'text-3xl font-bold',
  };

  return (
    <div className={cn("flex flex-col items-start", className)}>
      {showLabel && (
        <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Score</span>
      )}
      <span
        className={cn(
          "font-bold bg-gradient-to-r from-[#4EA8F5] to-[#2ED573] bg-clip-text text-transparent",
          sizeClasses[size]
        )}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

