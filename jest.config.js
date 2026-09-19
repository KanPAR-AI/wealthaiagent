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
    '^@wealthai/astral$': '<rootDir>/packages/astral/src/index.ts',
    // docs/73 ASTRAL-321: the DOM binding moved out of src/components/astral
    '^@wealthai/astral-dom$': '<rootDir>/packages/astral-dom/src/index.ts',
    '^@wealthai/chat-native$': '<rootDir>/packages/chat-native/src/index.ts',
    // Captured-payload fixtures are a subpath export so they stay OUT of the
    // app bundle; tests import them explicitly.
    '^@wealthai/astral/fixtures$': '<rootDir>/packages/astral/src/fixtures/payloads.ts',
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
    // ONE pattern, deliberately: a file is ignored if it matches ANY entry in
    // this array, so a second "allow these" pattern cannot widen the first —
    // it only re-states the exclusion. (Measured: adding the markdown tree as
    // a second entry left `react-markdown` untransformed and the suite still
    // failed to parse.)
    //
    // Two families of ESM-only packages need babel:
    //
    //   msw's tree — `until-async`, `outvariant`, `rettime` and friends.
    //     `rettime` is pulled in by msw's core in newer 2.12.x builds; CI
    //     installs a newer msw within the ^2.7.0 range, so it must be
    //     transformed or the whole suite fails to parse.
    //
    //   the `react-markdown` / `remark-gfm` tree — unified, micromark, mdast,
    //     hast, unist, vfile: 84 packages, all `"type": "module"` with no CJS
    //     build. Grouped by family so the line stays readable. Only the suites
    //     that actually import them pay the transform. Added for docs/73 B4
    //     (`packages/astral-dom/narration.tsx`), the first component in this
    //     repo to render markdown under test.
    'node_modules/(?!(nanoid|msw|@mswjs|until-async|outvariant|strict-event-emitter|is-node-process|headers-polyfill|@open-draft|@bundled-es-modules|rettime|micromark.*|mdast-util-.*|unist-util-.*|hast-util-.*|remark-.*|vfile.*|character-entit.*|character-reference-.*|@ungap\/structured-clone|bail|ccount|comma-separated-tokens|decode-named-character-reference|devlop|estree-util-is-identifier-name|html-url-attributes|is-alphabetical|is-alphanumerical|is-decimal|is-hexadecimal|is-plain-obj|longest-streak|markdown-table|parse-entities|property-information|react-markdown|space-separated-tokens|stringify-entities|trim-lines|trough|unified|zwitch|escape-string-regexp)/)'
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