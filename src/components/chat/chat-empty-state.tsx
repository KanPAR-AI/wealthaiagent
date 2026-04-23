// src/components/chat/ChatEmptyState.tsx
import { JSX } from "react";
import { isMysticAI } from "@/lib/mysticai";

export function ChatEmptyState(): JSX.Element {
  if (isMysticAI) {
    return (
      <div className="text-center space-y-2">
        <h1 className="text-2xl" style={{ fontFamily: "'Cinzel', serif", color: '#f0e7ff' }}>
          What does the cosmos reveal?
        </h1>
        <p className="text-sm" style={{ color: '#a78bcc' }}>
          Muhurta · Kundli · Palm Reading · Compatibility
        </p>
      </div>
    );
  }

  return (
    <div className="text-start text-2xl text-foreground dark:text-zinc-400">
      <h1>How can I help you today?</h1>
    </div>
  );
}