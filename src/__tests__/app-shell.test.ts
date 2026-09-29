// Bug a0d78f0f — the shell guarantees that keep a page from ever being blank.
//
// These are STRUCTURAL pins over the source, not renders: mounting the whole
// <App/> under jest needs the full provider/Firebase stack, and the thing
// being pinned is wiring ("is the boundary around the routes?"), which a
// source read states exactly. Each assertion goes red when the corresponding
// line is removed (round-2 W1/W6/W7 mutations).
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("app shell: nothing may render blank", () => {
  it("W1: the routes render inside RouteErrorBoundary (App.tsx)", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('import { AppErrorBoundary } from "@/components/app-error-boundary"');
    const open = app.indexOf("<RouteErrorBoundary>");
    const routesOpen = app.indexOf("<Routes>");
    const routesClose = app.indexOf("</Routes>");
    const close = app.indexOf("</RouteErrorBoundary>");
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(routesOpen);
    expect(routesClose).toBeLessThan(close);
    // and RouteErrorBoundary is the real boundary, keyed by the route
    expect(app).toMatch(/<AppErrorBoundary route=\{pathname\} resetKey=\{pathname\}/);
  });

  it("W6: the outer boundary wraps <App /> in main.tsx", () => {
    const main = read("src/main.tsx");
    const open = main.indexOf("<AppErrorBoundary");
    const appEl = main.indexOf("<App />");
    const close = main.indexOf("</AppErrorBoundary>");
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(appEl);
    expect(appEl).toBeLessThan(close);
  });

  it("W7: a stale-chunk preload error reloads once, guarded, and the latch is released after a healthy mount", () => {
    const main = read("src/main.tsx");
    expect(main).toContain("window.addEventListener('vite:preloadError'");
    expect(main).toMatch(/isStaleChunkError\(err\) && reloadOnceForStaleChunk\(\)/);
    expect(main).toMatch(/setTimeout\(clearStaleChunkLatch, \d+\)/);
  });

  it("index.html speaks when the bundle never runs, and says 'still loading' rather than lying", () => {
    const html = read("index.html");
    expect(html).toContain("The app could not start");
    expect(html).toMatch(/Still loading/);
    const wait = Number(/\}, (\d+)\);\s*\n\s*\}\)\(\);/.exec(html)?.[1]);
    expect(wait).toBeGreaterThanOrEqual(20000);
  });

  it("the HTML pointer is never served stale: no SW network timeout, no-cache from nginx", () => {
    const vite = read("vite.config.ts");
    const htmlCache = vite.slice(vite.indexOf("cacheName: 'html-cache'") - 400, vite.indexOf("cacheName: 'html-cache'") + 200);
    expect(htmlCache).toContain("handler: 'NetworkFirst'");
    expect(htmlCache).not.toContain("networkTimeoutSeconds");
    const nginx = read("nginx.template");
    const idx = nginx.indexOf("location ~ /index\\.html$");
    expect(idx).toBeGreaterThan(-1);
    const block = nginx.slice(idx, nginx.indexOf("}", idx));
    expect(block).toContain('Cache-Control "no-cache, no-store, must-revalidate" always');
    // W12: nested add_header does not inherit; COOP takes effect only on the
    // document response and Google popup sign-in breaks silently without it.
    expect(block).toContain('Cross-Origin-Opener-Policy "same-origin-allow-popups" always');
  });

  it("a purged hashed asset is a clean 404, never the SPA's index.html", () => {
    const nginx = read("nginx.template");
    const idx = nginx.indexOf("location /chataiagent/assets/");
    expect(idx).toBeGreaterThan(-1);
    const block = nginx.slice(idx, nginx.indexOf("}", idx));
    expect(block).toContain("try_files $uri =404");
    expect(block).not.toContain("index.html");
  });

  it("the fallback heading matches its branch", () => {
    const html = read("index.html");
    expect(html).toContain("function show(title, reason)");
    expect(html).toContain("' + title + '</h1>");
    expect(html).toContain("show('The app could not start', 'A script this page needs failed to load.");
    expect(html).toContain("show('Still loading\\u2026', 'The app has not drawn anything after");
  });
});
