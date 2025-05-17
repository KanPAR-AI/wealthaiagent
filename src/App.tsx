// frontend/src/App.tsx
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import New from "./pages/New";
import Chat from "./pages/Chat";
import { ClerkProvider } from '@clerk/clerk-react';
import { SidebarProvider } from "./components/ui/sidebar";
import { ThemeProvider } from "@/components/theme/theme-provider";

// Ensure environment variable is loaded (Vite specific)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key in .env file (VITE_CLERK_PUBLISHABLE_KEY)");
}

const App = () => (
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <TooltipProvider>
      <SidebarProvider>
      <Sonner /> {/* For toast notifications */}
      {/* Update BrowserRouter with basename */}
      <BrowserRouter basename="/chataiagent">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/new" element={<New />} />
          {/* /chat route directs to New component to generate ID and redirect */}
          <Route path="/chat" element={<New />} />
          {/* Route for displaying a specific chat */}
          <Route path="/chat/:chatid" element={<Chat />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
    </TooltipProvider>
    </ThemeProvider>
  </ClerkProvider>
);

export default App;