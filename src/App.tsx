// frontend/src/App.tsx
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SidebarProvider } from "./components/ui/sidebar";
import Chat from "./pages/Chat";
import New from "./pages/New";
import NotFound from "./pages/NotFound";

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
          <Route path="/" element={<New />} />
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