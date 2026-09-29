// Bug a0d78f0f: "blank screen on this ui" (/chataiagent/new). A render error
// with no boundary above it unmounts the React root — nothing on screen. The
// boundary must show a message that names the failure and the route, offer
// a reload, recover on navigation, and reload once for a stale-chunk error.
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, Link } from "react-router-dom";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import {
  RELOAD_LATCH_KEY,
  isBoundaryErrorShowing,
  isStaleChunkError,
  reloadOnceForStaleChunk,
  setBoundaryErrorShowing,
} from "@/lib/stale-chunk";

// A function declaration that only throws is inferred `void`, which is not a
// JSX component type under tsc -b; `never` is.
function Thrower({ message = "widgets_json[0].rows is undefined" }: { message?: string }): never {
  throw new Error(message);
}

function Routed({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AppErrorBoundary route={pathname} resetKey={pathname} homeHref="/chataiagent/">
      {children}
    </AppErrorBoundary>
  );
}

const originalLocation = window.location;
let reloadMock: jest.Mock;

beforeEach(() => {
  reloadMock = jest.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: reloadMock, pathname: "/new" },
  });
  sessionStorage.clear();
  setBoundaryErrorShowing(false);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  jest.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <AppErrorBoundary route="/new">
        <p>chat home</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("chat home")).toBeInTheDocument();
    expect(screen.queryByTestId("app-error-boundary")).toBeNull();
  });

  it("a render error on /new shows a message naming the route and the error — never a blank page", () => {
    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route
            path="/new"
            element={
              <Routed>
                <Thrower />
              </Routed>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong on this page");
    expect(alert).toHaveTextContent("at /new");
    expect(alert).toHaveTextContent("widgets_json[0].rows is undefined");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start" })).toHaveAttribute("href", "/chataiagent/");
    expect(document.body.textContent?.trim()).not.toBe("");
  });

  it("Reload calls location.reload", () => {
    render(
      <AppErrorBoundary route="/new">
        <Thrower />
      </AppErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("recovers when the route changes", () => {
    function Broken() {
      return (
        <div>
          <Thrower />
        </div>
      );
    }
    function Fine() {
      return <p>settings page</p>;
    }
    function Nav() {
      return <Link to="/settings">go</Link>;
    }
    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Nav />
        <Routed>
          <Routes>
            <Route path="/new" element={<Broken />} />
            <Route path="/settings" element={<Fine />} />
          </Routes>
        </Routed>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // while the error page is up, the stale-chunk latch must not be released
    expect(isBoundaryErrorShowing()).toBe(true);
    fireEvent.click(screen.getByText("go"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("settings page")).toBeInTheDocument();
    expect(isBoundaryErrorShowing()).toBe(false);
  });

  it("a stale-chunk error reloads once, then shows the refresh message instead of looping", () => {
    render(
      <AppErrorBoundary route="/new">
        <Thrower message="Failed to fetch dynamically imported module: /chataiagent/assets/pie-chart-display-abc123.js" />
      </AppErrorBoundary>,
    );
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_LATCH_KEY)).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("This page needs a refresh");
    // a second boundary hitting the same class of error does not reload again
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("classifies chunk-load failures and nothing else", () => {
    expect(isStaleChunkError(new Error("Loading chunk 42 failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Failed to fetch dynamically imported module: x.js"))).toBe(true);
    expect(isStaleChunkError(new Error("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined (reading 'rows')"))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});
