// src/components/chat/AiLoadingIndicator.tsx
import { ChatBubbleAvatar } from '@/components/ui/chat-bubble'; // Adjust path
import { JSX } from 'react';

interface AiLoadingIndicatorProps {
    avatarSrc?: string;
    avatarFallback?: string;
}

export function AiLoadingIndicator({
    avatarSrc = "/logo.svg",
    avatarFallback = "AI"
}: AiLoadingIndicatorProps): JSX.Element {
    return (
        <div className="flex gap-3 justify-start mt-6">
            <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />
            <div className="px-4 py-2 rounded-2xl bg-muted dark:bg-zinc-700 animate-pulse text-sm text-muted-foreground dark:text-zinc-400">
                Thinking...
            </div>
        </div>
    );
}