// src/components/chat/ChatLoadingSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import { JSX } from "react";

export function ChatLoadingSkeleton(): JSX.Element {
    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-4">
                <div className="flex items-center space-x-3 justify-start">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 w-3/4 rounded" />
                </div>
                <div className="flex items-center space-x-3 justify-end">
                    <Skeleton className="h-6 w-1/2 rounded" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <div className="flex items-center space-x-3 justify-start">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 w-2/3 rounded" />
                </div>
            </div>
        </div>
    );
}