// Bug a0d78f0f: "blank screen on this ui" at /chataiagent/new.
//
// The page /new is ChatHeader + ChatWindow inside AppLayout. Nothing in the
// report says WHICH child threw — there was no console text — so this test
// pins the invariant that made the report possible: a child of the /new
// page failing in render (here the chat window, after its home-tiles fetch
// comes back malformed) must leave a readable message on screen, not an
// empty page.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import New from "../New";

jest.mock("@/components/chat/chat-header", () => ({
  ChatHeader: () => <div data-testid="chat-header">header</div>,
}));

// The chat window fetches home tiles; simulate the fetch "succeeding" with a
// shape the renderer does not expect and blowing up in render.
jest.mock("@/components/chat/chat-window", () => ({
  __esModule: true,
  default: () => {
    const tiles = { tiles: null } as { tiles: { title: string }[] | null };
    return <ul>{tiles.tiles!.map((t) => <li key={t.title}>{t.title}</li>)}</ul>;
  },
}));

function Routed({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AppErrorBoundary route={pathname} resetKey={pathname}>
      {children}
    </AppErrorBoundary>
  );
}

describe("/new with a failing child", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("says what failed instead of rendering a blank page", () => {
    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route
            path="/new"
            element={
              <Routed>
                <New />
              </Routed>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong on this page");
    expect(alert).toHaveTextContent("at /new");
    expect(alert).toHaveTextContent(/Cannot read properties of null/);
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
