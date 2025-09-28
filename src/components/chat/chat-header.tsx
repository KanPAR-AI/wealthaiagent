// src/components/chat/ChatHeader.tsx
import Logo from '@/components/ui/logo'; // Adjust path
import { SidebarTrigger } from '@/components/ui/sidebar'; // Adjust path
import { JSX } from 'react';
import { ModeToggle } from '../theme/mode-toggle';

// Simple auth display component
function FallbackAuthSection() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Demo Mode</span>
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
        <span className="text-xs font-medium">D</span>
      </div>
    </div>
  );
}

export function ChatHeader(): JSX.Element {
  return (
    <div className="flex h-12 flex-shrink-0 items-center bg-background dark:bg-zinc-800 px-4 justify-between sticky top-0 z-20 w-full">
      {<SidebarTrigger className="mr-2" />}
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <Logo />
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <ModeToggle></ModeToggle>
        <FallbackAuthSection />
      </div>
    </div>
  );
}