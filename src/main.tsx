import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initCapacitor } from './lib/capacitor'
import { ensureCoreInitialized } from './lib/core-adapter'

// Install the web PlatformAdapter into @wealthai/core before anything
// imports the shared services. (Shim modules also self-initialize, so
// test files that import them directly are covered too.)
ensureCoreInitialized();
initCapacitor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <App />
  </React.StrictMode>,
)