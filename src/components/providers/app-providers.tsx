import { ThemeProvider } from "@/components/theme/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/clerk-react';

// Ensure environment variable is loaded (Vite specific)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key in .env file (VITE_CLERK_PUBLISHABLE_KEY)");
}

// This component bundles all your providers for a cleaner App.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <SidebarProvider>
            <Sonner /> {/* For toast notifications */}
            {children}
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}