/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-simple.ts'],
  moduleNameMapper: {
    '^@/config/environment$': '<rootDir>/src/config/environment.test.ts',
    // Real config/firebase.ts calls initializeApp()/getAuth() at module load
    // and reads import.meta.env — neither works under ts-jest/jsdom. Every
    // test that transitively imports it (hooks/use-auth.ts,
    // services/memory-engine-service.ts, lib/analytics.ts, ...) gets this
    // lightweight stand-in instead (mirrors the environment.ts mapping).
    '^@/config/firebase$': '<rootDir>/src/config/firebase.test.ts',
    // Same reason as config/firebase — reads import.meta.env directly and
    // initializes Firebase Analytics at import time.
    '^@/lib/analytics$': '<rootDir>/src/lib/analytics.test.ts',
    // Workspace package: jest's node resolution doesn't follow the
    // package.json "exports"-to-TS-source arrangement, so map directly.
    '^@wealthai/core$': '<rootDir>/packages/core/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '^nanoid$': '<rootDir>/src/test/__mocks__/nanoid.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        moduleResolution: 'node',
        target: 'es2017',
        lib: ['es2017', 'dom'],
        outDir: './dist',
        skipLibCheck: true,
        isolatedModules: true
      }
    }],
    // msw's dependency `until-async` ships ESM-only (package.json
    // "type":"module", no CJS build at all) — Jest's CJS require() can't
    // parse its `export` syntax without a transform. babel-jest ships as
    // configured via babel-jest + @babel/preset-env (added as devDeps); converts
    // ESM->CJS for the handful of msw-tree packages that need it.
    '^.+\\.(js|mjs)$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|msw|@mswjs|until-async|outvariant|strict-event-emitter|is-node-process|headers-polyfill|@open-draft|@bundled-es-modules)/)'
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/config/environment.ts',
    '!src/config/firebase.ts',
    '!src/lib/analytics.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
}; 