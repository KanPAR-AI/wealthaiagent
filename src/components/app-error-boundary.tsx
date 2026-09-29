// Bug a0d78f0f: "blank screen on this ui" at /chataiagent/new.
//
// React 19 unmounts the WHOLE root when a render throws with no boundary
// above it — the user sees an empty white page, no message, nothing to click.
// The app had boundaries around one widget and one file preview and nothing
// at the top, so any uncaught render error anywhere (a widget with an
// unexpected shape was one documented case, bug 6d2f70b0) blanked the page.
// A page must never render blank: it says what failed and offers a way out.
//
// Two placements (see App.tsx / main.tsx): one inside the router, keyed by
// the pathname so navigating away recovers automatically and the message can
// name the route; one outside everything, for a crash in the providers or
// the router itself.
//
// A stale-chunk load failure after a deploy ("Failed to fetch dynamically
// imported module", "Loading chunk N failed") is not a bug in the page — the
// hashed file it wanted is gone. That case reloads once (a sessionStorage
// latch stops a loop) before showing the message.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { isStaleChunkError, reloadOnceForStaleChunk, setBoundaryErrorShowing } from "@/lib/stale-chunk";

interface Props {
  children: ReactNode;
  /** Shown in the message so the report says WHICH page failed. */
  route?: string;
  /** Changing this resets the boundary (App.tsx passes the pathname). */
  resetKey?: string;
  /** Where "Go to the start" navigates. Defaults to the app root. */
  homeHref?: string;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private reloadedHere = false;

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[AppErrorBoundary] render error on", this.props.route ?? "?", error, info?.componentStack);
    setBoundaryErrorShowing(true);
    if (isStaleChunkError(error) && !this.reloadedHere) {
      this.reloadedHere = true;
      reloadOnceForStaleChunk();
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      setBoundaryErrorShowing(false);
      this.setState({ error: null });
    }
  }

  componentWillUnmount() {
    if (this.state.error) setBoundaryErrorShowing(false);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const route = this.props.route;
    const stale = isStaleChunkError(error);
    return (
      <div
        role="alert"
        data-testid="app-error-boundary"
        className="flex min-h-[60vh] w-full items-center justify-center p-6 text-foreground"
      >
        <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-background p-5 shadow-sm">
          <h1 className="text-base font-semibold">
            {stale ? "This page needs a refresh" : "Something went wrong on this page"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stale
              ? "The app was updated while this tab was open, and a part of the old version could not be loaded."
              : `The page${route ? ` at ${route}` : ""} hit an error while drawing and could not be shown.`}
          </p>
          <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Reload
            </button>
            <a
              href={this.props.homeHref ?? "/"}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Go to the start
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
