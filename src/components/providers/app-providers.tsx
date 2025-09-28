import { ThemeProvider } from "@/components/theme/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/clerk-react';
import { env } from '@/config/environment';
import { LogProvider } from "../debug/log-provider";

// This component bundles all your providers for a cleaner App.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Check if we have a valid Clerk key
  const hasValidClerkKey = env.clerkPublishableKey && 
    env.clerkPublishableKey !== 'pk_test_fallback_key_for_development' &&
    env.clerkPublishableKey.startsWith('pk_');

  if (!hasValidClerkKey) {
    console.warn('Clerk publishable key is missing or invalid. App will run without authentication.');
    // Return providers without Clerk for development
    return (
      <LogProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <TooltipProvider>
            <SidebarProvider>
              <Sonner /> {/* For toast notifications */}
              {children}
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </LogProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey}>
      <LogProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <SidebarProvider>
            <Sonner /> {/* For toast notifications */}
            {children}
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </LogProvider>
    </ClerkProvider>
  );
}