// src/components/chat/ChatHeader.tsx
import Logo from '@/components/ui/logo'; // Adjust path
import { SidebarTrigger } from '@/components/ui/sidebar'; // Adjust path
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { JSX } from 'react';
import { ModeToggle } from '../theme/mode-toggle';
import { env } from '@/config/environment';

// Fallback auth components for when Clerk is not available
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
  // Check if we have a valid Clerk key
  const hasValidClerkKey = env.clerkPublishableKey && 
    env.clerkPublishableKey !== 'pk_test_fallback_key_for_development' &&
    env.clerkPublishableKey.startsWith('pk_');

  // Only use Clerk hooks if we have a valid key
  const clerkUser = hasValidClerkKey ? useUser() : null;

  return (
    <div className="flex h-12 flex-shrink-0 items-center bg-background dark:bg-zinc-800 px-4 justify-between sticky top-0 z-20 w-full">
      {<SidebarTrigger className="mr-2" />}
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <Logo />
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <ModeToggle></ModeToggle>

        {hasValidClerkKey ? (
          <>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn-primary-sm">Sign In</button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </>
        ) : (
          <FallbackAuthSection />
        )}
      </div>
    </div>
  );
}