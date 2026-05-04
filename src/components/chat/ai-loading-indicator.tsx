// AiLoadingIndicator
//
// Cinematic placeholder shown while the assistant is thinking — replaces the
// previous tiny "Thinking..." pill, which gave no signal during the 25-50s
// internal-reasoning windows of Gemini 3.1 Pro on slow flows (vision, holistic
// kundli, planner). Now shows a slim purple progress bar + cycling stage
// labels appropriate to the active agent (MysticAI vs default).

import { ChatBubbleAvatar } from '@/components/ui/chat-bubble';
import { useIsMysticAI } from '@/lib/mysticai';
import { useEffect, useState, type JSX } from 'react';

interface AiLoadingIndicatorProps {
  avatarSrc?: string;
  avatarFallback?: string;
}

const MYSTIC_LABELS = [
  'Aligning planets…',
  'Consulting classical texts…',
  'Casting your chart…',
  'Reading the lines…',
  'Cross-referencing dashas…',
];

const DEFAULT_LABELS = [
  'Reading your message…',
  'Searching knowledge…',
  'Drafting response…',
];

export function AiLoadingIndicator({
  avatarSrc = './logo.svg',
  avatarFallback = 'AI',
}: AiLoadingIndicatorProps): JSX.Element {
  const isMystic = useIsMysticAI();
  const labels = isMystic ? MYSTIC_LABELS : DEFAULT_LABELS;
  const [labelIdx, setLabelIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setLabelIdx((i) => (i + 1) % labels.length);
    }, 3500);
    return () => clearInterval(id);
  }, [labels.length]);

  return (
    <div className="flex gap-3 justify-start mt-6">
      <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />
      <div
        className={`min-w-0 max-w-md flex-1 rounded-2xl px-4 py-3 ${
          isMystic
            ? 'bg-gradient-to-r from-[#1a0f2e] to-[#1f1338] border border-purple-500/20'
            : 'bg-muted dark:bg-zinc-700'
        }`}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              isMystic ? 'bg-fuchsia-300' : 'bg-zinc-400'
            } animate-pulse`}
          />
          <span
            className={`text-xs tracking-wide font-medium transition-opacity duration-300 ${
              isMystic ? 'text-purple-100/90' : 'text-muted-foreground dark:text-zinc-300'
            }`}
            key={labelIdx}
          >
            {labels[labelIdx]}
          </span>
        </div>
        <div
          className={`relative h-1.5 rounded-full overflow-hidden ${
            isMystic ? 'bg-purple-950/60' : 'bg-zinc-300/50 dark:bg-zinc-600/50'
          }`}
        >
          <div
            className={`absolute inset-y-0 w-1/3 rounded-full ai-loading-shimmer ${
              isMystic
                ? 'bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400'
                : 'bg-gradient-to-r from-blue-400 to-indigo-400'
            }`}
          />
        </div>
        <div
          className={`mt-1.5 text-[10px] tracking-wider uppercase ${
            isMystic ? 'text-purple-300/60' : 'text-muted-foreground/70'
          }`}
        >
          {isMystic ? 'Vedic computation · usually 30–60s' : 'usually a few seconds'}
        </div>
      </div>
      <style>{`
        @keyframes ai-loading-shimmer-anim {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
        .ai-loading-shimmer { animation: ai-loading-shimmer-anim 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
