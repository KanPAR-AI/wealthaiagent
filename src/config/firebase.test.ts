// config/firebase.test.ts — test-only stand-in for config/firebase.ts,
// mapped via jest.config.js moduleNameMapper (mirrors config/environment.ts
// -> config/environment.test.ts). Avoids every test that transitively
// imports config/firebase (hooks/use-auth.ts, services/*-service.ts,
// lib/analytics.ts, ...) needing a real `import.meta.env`/Firebase App, and
// avoids each test file having to hand-order its own jest.mock() before
// the imports that pull this in (ts-jest doesn't auto-hoist jest.mock like
// babel-jest does).
//
// Individual tests that care about the token value can reassign
// `auth.currentUser` (or its `getIdToken` mock) directly — this is a plain
// mutable object, not a frozen fixture.
export const auth: { currentUser: { getIdToken: jest.Mock } | null } = {
  currentUser: {
    getIdToken: jest.fn().mockResolvedValue("test-id-token"),
  },
};

const app = {};
export default app;
