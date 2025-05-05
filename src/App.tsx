import { Toaster as Sonner } from "@/components/ui/sonner"; // Assuming Shadcn Sonner
import { TooltipProvider } from "@/components/ui/tooltip"; // Assuming Shadcn Tooltip
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import New from "./pages/New";
import Chat from "./pages/Chat";
import { ClerkProvider } from '@clerk/clerk-react';
import { SidebarProvider } from "./components/ui/sidebar";

// Ensure environment variable is loaded (Vite specific)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key in .env file (VITE_CLERK_PUBLISHABLE_KEY)");
}

const App = () => (
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <TooltipProvider>
      <SidebarProvider>
      <Sonner /> {/* For toast notifications */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/new" element={<New />} />
          {/* /chat route directs to New component to generate ID and redirect */}
          <Route path="/chat" element={<New />} />
          {/* Route for displaying a specific chat */}
          <Route path="/chat/:chatid" element={<Chat />} />

          {/* Catch-all route for 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
    </TooltipProvider>
  </ClerkProvider>
);

export default App;