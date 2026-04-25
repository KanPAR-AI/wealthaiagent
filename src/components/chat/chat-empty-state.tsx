// src/components/chat/ChatEmptyState.tsx
import { JSX } from "react";
import { useIsMysticAI } from "@/lib/mysticai";

export function ChatEmptyState(): JSX.Element {
  const isMystic = useIsMysticAI();
  if (isMystic) {
    return (
      <div className="relative text-center space-y-5 select-none">
        {/* Orbital rings behind the heading */}
        <div
          className="mystic-orbit-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 340,
            height: 340,
            animation: 'mystic-orbit-spin 40s linear infinite',
          }}
        />
        <div
          className="mystic-orbit-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 220,
            height: 220,
            borderStyle: 'dashed',
            borderColor: 'rgba(255, 202, 40, 0.22)',
            animation: 'mystic-orbit-spin-reverse 28s linear infinite',
          }}
        />

        <div className="relative z-10 space-y-4 px-6 py-6">
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl mystic-glow" role="img" aria-label="crystal ball">🔮</span>
            <h1 className="mystic-heading text-3xl md:text-4xl font-semibold">
              What does the cosmos reveal?
            </h1>
            <span className="text-3xl mystic-glow" role="img" aria-label="sparkles" style={{ animationDelay: '0.8s' }}>✨</span>
          </div>

          <p
            className="text-sm md:text-base tracking-wide"
            style={{ color: '#c5b0e8', fontFamily: "'Cinzel', serif" }}
          >
            Muhurta · Kundli · Palm Reading · Compatibility
          </p>
        </div>

        <style>{`
          @keyframes mystic-orbit-spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes mystic-orbit-spin-reverse {
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }
          /* Position the dot on each ring */
          .mystic-orbit-ring:nth-child(1)::after { top: -5px; left: 50%; transform: translateX(-50%); }
          .mystic-orbit-ring:nth-child(2)::after {
            top: 50%; right: -5px; transform: translateY(-50%);
            background: radial-gradient(circle, #b794ff, transparent 70%);
            box-shadow: 0 0 14px 3px rgba(183, 148, 255, 0.55);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="text-start text-2xl text-foreground dark:text-zinc-400">
      <h1>How can I help you today?</h1>
    </div>
  );
}
