// src/components/chat/ChatEmptyState.tsx
import { AuroraText } from "../ui/aurora-text";
import { JSX } from "react";

interface ChatEmptyStateProps {
  isFirstMessage: boolean;
  isSignedIn: boolean;
  userName?: string | null;
}

export function ChatEmptyState({ isSignedIn, userName }: ChatEmptyStateProps): JSX.Element {
  return (
    <div className="text-start text-muted-foreground dark:text-zinc-400">

          <h2 className="text-xl sm:text-2xl font-bold mt-16 text-foreground dark:text-zinc-200">
            Hello, How can I help you today?
          </h2>
     
    </div>
  );
}