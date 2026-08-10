// lib/analytics.test.ts — test-only stand-in for lib/analytics.ts, mapped
// via jest.config.js moduleNameMapper. The real file reads
// `import.meta.env.VITE_FIREBASE_MEASUREMENT_ID` directly (not through
// config/environment.ts) and initializes Firebase Analytics, neither of
// which works under ts-jest/jsdom. `track`/`identify` are recorded no-ops
// so telemetry call sites (e.g. lib/memory-telemetry.ts) stay testable
// without a real analytics backend.
export const track = jest.fn();
export const identify = jest.fn();
