// src/components/chat/ChatHeader.tsx
import Logo from '@/components/ui/logo'; // Adjust path
import { SidebarTrigger } from '@/components/ui/sidebar'; // Adjust path
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { JSX } from 'react';
import { ModeToggle } from '../theme/mode-toggle';



export function ChatHeader(): JSX.Element {
  return (
    <div className="flex h-12 flex-shrink-0 items-center bg-background dark:bg-zinc-800 px-4 justify-between sticky top-0 z-20 w-full">
      {<SidebarTrigger className="mr-2" />}
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <Logo />
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
      <ModeToggle></ModeToggle>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn-primary-sm">Sign In</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </div>
  );
}