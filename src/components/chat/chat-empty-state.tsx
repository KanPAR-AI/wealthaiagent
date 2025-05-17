// src/components/chat/ChatEmptyState.tsx

import { JSX } from "react";

interface ChatEmptyStateProps {
  isFirstMessage: boolean;
  isSignedIn: boolean;
  userName?: string | null;
}

export function ChatEmptyState({ isFirstMessage, isSignedIn, userName }: ChatEmptyStateProps): JSX.Element {
  return (
    <div className="p-6 text-center text-muted-foreground dark:text-zinc-400">
      {isFirstMessage ? (
        <>
          <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-zinc-200">
            Hello, {isSignedIn ? userName : 'User'}!
          </h2>
          <p>How can I help you today?</p>
        </>
      ) : (
        <p>No messages in this chat yet. Send a message to start!</p>
      )}
    </div>
  );
}