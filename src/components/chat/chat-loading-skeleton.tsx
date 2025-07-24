import { Skeleton } from "@/components/ui/skeleton"
import type { JSX } from "react"

// Helper component for a single chat bubble skeleton
function ChatBubbleSkeleton({ isUser }: { isUser: boolean }): JSX.Element {
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <Skeleton className="h-8 w-8 rounded-full bg-accent dark:bg-accent-foreground/10" />} {/* Bot Avatar */}
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full max-w-[70%]`}>
        {/* Message bubble skeleton */}
        <Skeleton className="h-10 w-full rounded-2xl bg-accent dark:bg-accent-foreground/10" />
        {/* Second line for longer messages */}
        <Skeleton className="h-10 w-3/4 mt-1 rounded-2xl bg-accent dark:bg-accent-foreground/10" />
        {/* Optional: File attachment skeleton */}
        {/* <Skeleton className="h-24 w-full mt-2 rounded-lg" /> */}
      </div>
      {isUser && <Skeleton className="h-8 w-8 rounded-full bg-accent dark:bg-accent-foreground/10" />} {/* User Avatar */}
    </div>
  )
}

export function ChatLoadingSkeleton(): JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Bot message skeleton */}
        <ChatBubbleSkeleton isUser={false} />
        {/* User message skeleton */}
        <ChatBubbleSkeleton isUser={true} />
        {/* Another bot message skeleton */}
        <ChatBubbleSkeleton isUser={false} />
      </div>
    </div>
  )
}
