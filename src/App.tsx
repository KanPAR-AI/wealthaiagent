import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "./components/providers/app-providers";
import AppLayout from "@/components/layout/app-layout";
import Chat from "./pages/Chat";
import New from "./pages/New";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";
import Trade from "./pages/Trade";
import Debug from "./pages/Debug";
import MealPlan from "./pages/MealPlan";
import PWAInstall from "./components/PWAInstall";
import LoginPage from "./pages/Login";
import Admin from "./pages/Admin";
import TestChat from "./pages/TestChat";
import Settings from "./pages/Settings";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { isNativePlatform } from "@/lib/capacitor";
import { isMysticAI, applyMysticTheme } from "@/lib/mysticai";

// MysticAI (astro.yourfinadvisor.com) serves from root; main app from /chataiagent
const basename = isNativePlatform ? '/' : isMysticAI ? '/' : '/chataiagent';

// Apply MysticAI theme overrides if on astro domain
applyMysticTheme();

const App = () => (
  <AppProviders>
    <BrowserRouter basename={basename}>
      <Routes>
        {/* Login page as the first screen */}
        <Route path="/" element={<LoginPage />} />

        {/* All routes inside AppLayout will have the persistent sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/new" element={<New />} />
          <Route path="/chat" element={<New />} />
          <Route path="/chat/:chatid" element={<Chat />} />
          <Route path="/mealplan/:chatid" element={<MealPlan />} />
          <Route path="/settings" element={<ProtectedRoute requireAuth><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="/trade" element={<Trade />} />
        <Route path="/debug/:chatid" element={<Debug />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
        <Route path="/admin/test/:agentId" element={<ProtectedRoute requireAdmin><TestChat /></ProtectedRoute>} />

        {/* Routes outside the layout, like a 404 page, won't have the sidebar */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isNativePlatform && <PWAInstall />}
    </BrowserRouter>
  </AppProviders>
);

export default App;
