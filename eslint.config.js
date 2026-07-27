import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        structuredClone: 'readonly'
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
    },
  },
  // React Native (apps/mobile): `require()` is the idiomatic way to reference
  // a static asset — Metro resolves it at bundle time and it is what the Expo
  // docs use. The base config's no-require-imports rule was failing `npm run
  // lint` (exit 1) on 7 legitimate asset references, which meant the frontend
  // CI job had been red and ignored. Scope the rule off where it doesn't apply
  // rather than leaving the gate broken.
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Admin surface: unused vars are an ERROR, not a warning.
  //
  // Why here specifically: an unused import is the fingerprint of a silently
  // removed feature. Commit 38e1eba deleted the "✨ suggest mapping" button
  // from the Tool Integrator but left `suggestIntegration` imported and
  // `setHint` orphaned. Lint warned; warnings don't fail CI; the feature was
  // gone for a week before anyone noticed. Admin panels are where buttons and
  // affordances live, so this is where the ratchet earns its keep.
  //
  // The rest of src/ stays on 'warn' until its existing backlog is cleared —
  // see `npx eslint src` for the list. Extend this `files` glob as areas are
  // cleaned; do not widen it to all of src/ until that backlog is zero.
  {
    files: ['src/components/admin/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
    },
  },
)
