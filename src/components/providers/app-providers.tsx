import { ThemeProvider } from "@/components/theme/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogProvider } from "../debug/log-provider";

// This component bundles all your providers for a cleaner App.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <SidebarProvider defaultOpen={false}>
            <Sonner /> {/* For toast notifications */}
            {children}
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </LogProvider>
  );
}