/**
 * Two entries, one output directory, no remote anything.
 *
 *   panel.html → the side panel document (React 19, the workspace's version)
 *   src/sw.ts  → `sw.js`, the MV3 service worker — the only thing with network
 *
 * `dist/` is loadable as-is through chrome://extensions → Load unpacked. The
 * manifest is WRITTEN from `src/lib/manifest.ts` rather than checked in, so
 * `manifest.test.ts` asserts the same object Chrome loads (docs/73
 * ASTRAL-322) and the dev/production host difference cannot drift.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { buildManifest, type BuildMode } from './src/lib/manifest';

function manifestPlugin(mode: BuildMode): Plugin {
  return {
    name: 'astromatch-manifest',
    writeBundle(options) {
      const dir = options.dir ?? join(__dirname, 'dist');
      writeFileSync(
        join(dir, 'manifest.json'),
        `${JSON.stringify(buildManifest(mode), null, 2)}\n`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildMode: BuildMode = mode === 'development' ? 'development' : 'production';
  return {
    root: __dirname,
    plugins: [react(), manifestPlugin(buildMode)],
    define: {
      // The one build-time switch: which backend this build talks to. Read
      // in exactly one place (`src/lib/runtime.ts`).
      __ASTROMATCH_MODE__: JSON.stringify(buildMode),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Readable output. An extension is reviewed by a human who opens the
      // files, and a minified bundle is the thing a reviewer asks about.
      minify: false,
      sourcemap: buildMode === 'development',
      rollupOptions: {
        input: {
          panel: join(__dirname, 'panel.html'),
          sw: join(__dirname, 'src', 'sw.ts'),
        },
        output: {
          // `sw.js` at the root, because that is what the manifest names.
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
