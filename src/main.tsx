import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initCapacitor } from './lib/capacitor'
import { ensureCoreInitialized } from './lib/core-adapter'
import { AppErrorBoundary } from './components/app-error-boundary'
import { clearStaleChunkLatch, isStaleChunkError, reloadOnceForStaleChunk } from './lib/stale-chunk'

// Install the web PlatformAdapter into @wealthai/core before anything
// imports the shared services. (Shim modules also self-initialize, so
// test files that import them directly are covered too.)
ensureCoreInitialized();
initCapacitor();

// Bug a0d78f0f: after a deploy, a tab holding the old index.html asks for a
// hashed chunk that no longer exists. Vite reports it here; reload once so
// the fresh index.html is fetched instead of leaving the page half-drawn.
// Only a stale-chunk shaped failure earns the reload, and only once - the
// latch inside reloadOnceForStaleChunk is the guard; when it cannot be
// written, nothing reloads and the boundary explains instead.
window.addEventListener('vite:preloadError', (event) => {
  const err = (event as unknown as { payload?: unknown }).payload;
  if (isStaleChunkError(err) && reloadOnceForStaleChunk()) event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <AppErrorBoundary route={window.location.pathname}>
        <App />
      </AppErrorBoundary>
  </React.StrictMode>,
)

// Release the one-reload latch only once the page is genuinely up: mounted
// for 5 s AND no error boundary is showing (clearStaleChunkLatch checks the
// boundary's flag). Then the NEXT deploy's stale chunk gets its reload too.
window.setTimeout(clearStaleChunkLatch, 5000)
