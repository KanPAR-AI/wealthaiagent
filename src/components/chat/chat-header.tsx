// src/components/chat/ChatHeader.tsx
import Logo from '@/components/ui/logo'; // Adjust path
import { SidebarTrigger } from '@/components/ui/sidebar'; // Adjust path
import { Edit } from 'lucide-react';
import { JSX } from 'react';
import { Link } from 'react-router-dom';
import { ModeToggle } from '../theme/mode-toggle';
import { Button } from '../ui/button';

export function ChatHeader(): JSX.Element {
  return (
    <div className="flex h-12 flex-shrink-0 items-center bg-background dark:bg-zinc-800 px-4 justify-between sticky top-0 z-20 w-full">
      <SidebarTrigger className="mr-2" />
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <Logo />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">

        <ModeToggle />
        <Link
          to="/new"
          title="New Chat"
          aria-label="New Chat"
        >
          <Button variant="outline" size="icon">
            <Edit className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">New Chat</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}