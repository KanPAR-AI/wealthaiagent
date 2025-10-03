// src/components/chat/ChatEmptyState.tsx
import { JSX } from "react";



export function ChatEmptyState(): JSX.Element {
  return (
    <div className="text-start text-2xl text-foreground dark:text-zinc-400">
          <h1>How can I help you today?</h1>
 
    </div>
  );
}