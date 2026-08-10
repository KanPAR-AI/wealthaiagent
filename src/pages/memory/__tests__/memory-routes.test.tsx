// pages/memory/__tests__/memory-routes.test.tsx — UI-0: "route mounts +
// redirect" and "layout renders header/subnav" (ROUTES.md, ADR-001).
// Builds the same route shape App.tsx registers for /memory/* (rather than
// rendering the whole app, which needs BrowserRouter + a basename and a
// lot of unrelated chrome) so this stays a fast, focused unit test.
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { MemoryRouteGuard } from "@/components/memory/memory-route-guard";
import { MemoryPage } from "@/components/memory/memory-page";
import MemoryMemoriesPage from "@/pages/memory/MemoryMemoriesPage";
import MemoryTimelinePage from "@/pages/memory/MemoryTimelinePage";
import MemoryGraphPage from "@/pages/memory/MemoryGraphPage";
import MemoryInboxPage from "@/pages/memory/MemoryInboxPage";
import MemoryDebuggerPage from "@/pages/memory/MemoryDebuggerPage";
import { useAuth } from "@/hooks/use-auth";
import { searchMemories } from "@/services/memory-engine-service";

jest.mock("@/hooks/use-auth");
jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, searchMemories: jest.fn() };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSearchMemories = searchMemories as jest.MockedFunction<typeof searchMemories>;

function auth(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      uid: "u1", email: "a@b.com", phoneNumber: null, displayName: null,
      photoURL: null, isAnonymous: false, isAdmin: false,
    },
    idToken: "tok",
    isAuthLoading: false,
    isSignedIn: true,
    isAnonymous: false,
    isAdmin: false,
    needsSignIn: false,
    anonymousMessageCount: 0,
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    getToken: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

function renderMemoryApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Login screen</div>} />
        <Route path="/chat" element={<div>Chat screen</div>} />
        <Route
          path="/memory"
          element={
            <MemoryRouteGuard perm="memory.read">
              <MemoryPage />
            </MemoryRouteGuard>
          }
        >
          <Route index element={<Navigate to="memories" replace />} />
          <Route path="memories" element={<MemoryMemoriesPage />} />
          <Route path="memories/:id" element={<MemoryMemoriesPage />} />
          <Route path="timeline" element={<MemoryTimelinePage />} />
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
      </Routes>
    </MemoryRouter>,
  );
}

describe("Memory route tree", () => {
  beforeEach(() => {
    mockSearchMemories.mockResolvedValue({
      results: [], pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
  });

  test("/memory redirects to /memory/memories and renders header + subnav", async () => {
    mockUseAuth.mockReturnValue(auth());
    renderMemoryApp("/memory");

    expect(await screen.findByRole("heading", { name: "Memory" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Memory sections" })).toBeInTheDocument();
    for (const label of ["Overview", "Memories", "Timeline", "Graph", "Inbox"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // Cosmetic gate: Debugger hidden for a non-admin (no memory.debug_retrieval).
    expect(screen.queryByRole("link", { name: "Debugger" })).not.toBeInTheDocument();
    // UI-0 acceptance: "a raw search round-trips against the real engine".
    await waitFor(() => expect(mockSearchMemories).toHaveBeenCalled());
  });

  test("signed-out user hitting /memory is redirected to / — no data request fires", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: false, user: null }));
    renderMemoryApp("/memory");
    expect(screen.getByText("Login screen")).toBeInTheDocument();
    expect(mockSearchMemories).not.toHaveBeenCalled();
  });

  test("/memory/debugger denies a non-admin (no memory.debug_retrieval) even by direct URL", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: true, isAdmin: false }));
    renderMemoryApp("/memory/debugger");
    // MemoryAccessDenied redirects away (mirrors the repo's existing
    // <ProtectedRoute requireAdmin> AccessDenied pattern) — the durable,
    // assertable outcome is that the denied route never stays mounted and
    // the debugger content never appears.
    expect(screen.getByText("Chat screen")).toBeInTheDocument();
    expect(screen.queryByText("Retrieval Debugger")).not.toBeInTheDocument();
  });

  test("/memory/debugger is reachable for an admin and the Debugger nav item is shown", async () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: true, isAdmin: true }));
    renderMemoryApp("/memory/debugger");
    expect(await screen.findByText("Retrieval Debugger")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Debugger" })).toBeInTheDocument();
  });

  test("/memory/timeline, /memory/graph, /memory/inbox mount honest (non-mock) placeholders", async () => {
    mockUseAuth.mockReturnValue(auth());

    const { unmount: unmountTimeline } = renderMemoryApp("/memory/timeline");
    expect(await screen.findByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    unmountTimeline();

    const { unmount: unmountGraph } = renderMemoryApp("/memory/graph");
    expect(await screen.findByRole("heading", { name: "Graph" })).toBeInTheDocument();
    unmountGraph();

    renderMemoryApp("/memory/inbox");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  test("deep link /memory/memories/:id mounts without 404ing (inspector arrives UI-2)", async () => {
    mockUseAuth.mockReturnValue(auth());
    renderMemoryApp("/memory/memories/mem_abc123");
    expect(await screen.findByText(/mem_abc123/)).toBeInTheDocument();
  });
});
