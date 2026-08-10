import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProviders } from "./components/providers/app-providers";
import AppLayout from "@/components/layout/app-layout";
import Chat from "./pages/Chat";
import New from "./pages/New";
import AgentLanding from "./pages/AgentLanding";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";
import Trade from "./pages/Trade";
import Debug from "./pages/Debug";
import MealPlan from "./pages/MealPlan";
import OrderBook from "./pages/OrderBook";
import PWAInstall from "./components/PWAInstall";
import LoginPage from "./pages/Login";
import Admin from "./pages/Admin";
import AdminBugReports from "./pages/AdminBugReports";
import TestChat from "./pages/TestChat";
import Settings from "./pages/Settings";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { isNativePlatform } from "@/lib/capacitor";
import { isMysticAI, applyMysticTheme, revertMysticTheme } from "@/lib/mysticai";
import { MemoryRouteGuard } from "@/components/memory/memory-route-guard";
import { MemoryPage } from "@/components/memory/memory-page";
import MemoryMemoriesPage from "@/pages/memory/MemoryMemoriesPage";
import MemoryTimelinePage from "@/pages/memory/MemoryTimelinePage";
import MemoryGraphPage from "@/pages/memory/MemoryGraphPage";
import MemoryInboxPage from "@/pages/memory/MemoryInboxPage";
import MemoryDebuggerPage from "@/pages/memory/MemoryDebuggerPage";
import MemoryOverviewPage from "@/pages/memory/MemoryOverviewPage";
import MemoryRunPage from "@/pages/memory/MemoryRunPage";

// Keep /chataiagent basename always — nginx handles root-to-chataiagent redirect
// for astro.yourfinadvisor.com. MysticAI mode only changes theme + agent, not routing.
const basename = isNativePlatform ? '/' : '/chataiagent';

// Apply MysticAI theme overrides only on the astro domain / ?mystic=1 —
// the agent dropdown handles runtime activation explicitly.
if (isMysticAI) applyMysticTheme();

// Routes where the cosmic mystic theme must be torn down — these render
// outside AppLayout, so app-layout's selectedAgent useEffect can't revert.
// Without this, navigating from a MysticAI chat to /admin leaves the
// `mystic` CSS class on <html>, breaking the admin portal layout.
const NON_MYSTIC_ROUTE_PREFIXES = ["/admin", "/debug", "/trade", "/logs", "/memory"];

function MysticRouteGuard() {
  const { pathname } = useLocation();
  useEffect(() => {
    const isNonMysticRoute = NON_MYSTIC_ROUTE_PREFIXES.some((p) =>
      pathname === p || pathname.startsWith(p + "/"),
    );
    // Only force-revert on admin/debug/etc. Don't touch chat routes — the
    // agent selector + AppLayout effect handle those reactively.
    if (isNonMysticRoute && !isMysticAI) {
      revertMysticTheme();
    }
  }, [pathname]);
  return null;
}

const App = () => (
  <AppProviders>
    <BrowserRouter basename={basename}>
      <MysticRouteGuard />
      <Routes>
        {/* Login page as the first screen */}
        <Route path="/" element={<LoginPage />} />

        {/* Custom per-agent landing pages: /a/<slug> preselects the
            agent then redirects to /new. Slugs include both pretty
            aliases ("mystic", "diet") and raw agent ids. Lives
            outside AppLayout because it never renders any UI — it's
            just a side-effect-and-redirect bounce. */}
        <Route path="/a/:slug" element={<AgentLanding />} />

        {/* All routes inside AppLayout will have the persistent sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/new" element={<New />} />
          <Route path="/chat" element={<New />} />
          <Route path="/chat/:chatid" element={<Chat />} />
          <Route path="/mealplan/:chatid" element={<MealPlan />} />
          <Route path="/settings" element={<ProtectedRoute requireAuth><Settings /></ProtectedRoute>} />
          <Route path="/orderbook" element={<ProtectedRoute requireAuth><OrderBook /></ProtectedRoute>} />
        </Route>
        <Route path="/trade" element={<Trade />} />
        <Route path="/debug/:chatid" element={<Debug />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
        <Route path="/admin/bugs" element={<ProtectedRoute requireAdmin><AdminBugReports /></ProtectedRoute>} />
        <Route path="/admin/test/:agentId" element={<ProtectedRoute requireAdmin><TestChat /></ProtectedRoute>} />

        {/* Memory OS UI — new top-level /memory/* tree (ADR-001), NOT
            nested under /admin and NOT inside the chat <AppLayout> (which
            renders the chat sidebar chrome). Entry gate is memory.read, not
            admin-only — see MemoryRouteGuard. docs/memory-ui/ROUTES.md. */}
        <Route
          path="/memory"
          element={
            <MemoryRouteGuard perm="memory.read">
              <MemoryPage />
            </MemoryRouteGuard>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<MemoryOverviewPage />} />
          <Route path="memories" element={<MemoryMemoriesPage />} />
          <Route path="memories/:id" element={<MemoryMemoriesPage />} />
          <Route path="timeline" element={<MemoryTimelinePage />} />
          <Route path="run/:runId" element={<MemoryRunPage />} />
          <Route path="graph" element={<MemoryGraphPage />} />
          <Route path="inbox" element={<MemoryInboxPage />} />
          <Route
            path="debugger"
            element={
              <MemoryRouteGuard perm="memory.debug_retrieval">
                <MemoryDebuggerPage />
              </MemoryRouteGuard>
            }
          />
        </Route>

        {/* Routes outside the layout, like a 404 page, won't have the sidebar */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isNativePlatform && <PWAInstall />}
    </BrowserRouter>
  </AppProviders>
);

export default App;
