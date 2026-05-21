// frontend/vite.config.ts
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

const isCapacitor = process.env.VITE_CAPACITOR === 'true';

/**
 * Vite serves the SPA at `base = '/chataiagent/'` (with the slash). A
 * request to bare `/chataiagent` hits Vite's helpful-but-fatal error
 * page ("did you mean to visit /chataiagent/ instead?"). This bites
 * mobile Google sign-in: `signInWithRedirect` → google.com → 302 back
 * to `localhost:5173/chataiagent` (some redirectors drop the trailing
 * slash) and the user lands on the error page with no JS shipped, no
 * router, nothing to recover with. Same for any deep link to
 * `/chataiagent?foo=bar` from outside the app.
 *
 * This plugin issues a 301 from the bare prefix to the slashed form
 * BEFORE Vite's own middleware sees the request. Web-only — Capacitor
 * builds use `base: '/'` and don't need it.
 */
const redirectBareBaseToSlash = (basePath: string): Plugin => ({
  name: 'redirect-bare-base-to-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      // Match either the bare prefix OR the bare prefix + query.
      if (url === basePath || url.startsWith(basePath + '?') || url.startsWith(basePath + '#')) {
        const tail = url.slice(basePath.length);
        res.writeHead(301, { Location: `${basePath}/${tail}` });
        res.end();
        return;
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(!isCapacitor ? [redirectBareBaseToSlash('/chataiagent')] : []),
    // Skip PWA plugin for native Capacitor builds — service workers don't apply
    ...(!isCapacitor ? [VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB — main bundle exceeds default 2 MB limit
        // Precache hashed assets but NOT index.html — index.html is the bootstrap
        // pointer to the latest hashed bundle; if it's precached, users keep loading
        // stale JS even after a deploy.
        globPatterns: ['**/*.{js,css,ico,png,svg,json}'],
        // Activate new SW immediately + take over open tabs without waiting
        // for them to close. Combined with the periodic update check in
        // PWAInstall.tsx, this gives users the latest UI within ~5 min.
        skipWaiting: true,
        clientsClaim: true,
        // Always fetch index.html from network so the entry point points
        // at the freshest hashed bundles. Falls back to cache if offline.
        navigateFallback: null,
        // Tell Workbox that requests Firebase makes for its auth handler
        // and the credential-bearing redirect back are never SW-business.
        // Without this, an iOS Safari/CriOS user doing `signInWithRedirect`
        // sees the OAuth handler return to the SPA with credential params
        // in the URL fragment, the SW serves a cached HTML response, the
        // SDK never sees the fragment, and `getRedirectResult()` returns
        // null → the user lands back anonymous. Confirmed in prod logs
        // (last_sign_in for the test user stayed at 2026-05-04 while the
        // session ended up as a fresh anonymous uid).
        navigateFallbackDenylist: [
          /__\/auth\//,                  // Firebase hosted auth handler
          /\/__\/firebase\//,
          /[?#&](state|id_token|access_token|code|apiKey|authType|providerId|oauth_token)=/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              if (request.mode !== 'navigate') return false;
              // Skip Firebase-auth-bearing navigations: their query/fragment
              // contains the OAuth credential and the SDK needs to read it
              // from the live URL, not a cached HTML body.
              const haystack = `${url.search}${url.hash}`;
              if (/[?#&](state|id_token|access_token|code|apiKey|authType|providerId|oauth_token)=/.test(haystack)) return false;
              if (url.pathname.includes('/__/auth/') || url.pathname.includes('/__/firebase/')) return false;
              return true;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'WealthWise AI - Financial Advisor',
        short_name: 'WealthWise AI',
        description: 'Your personal AI-powered financial advisor for smart investment decisions',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })] : []),
  ],
  // Capacitor serves from '/', web deploys to '/chataiagent/' subfolder
  base: isCapacitor ? '/' : '/chataiagent/',
  server:{
    allowedHosts: ["e597ac4441c7.ngrok-free.app"], // Remove or comment out for production builds
    // Firebase signInWithPopup needs to keep its window.opener handle when the
    // popup (aiagentapi.firebaseapp.com) returns. Chrome 119+ severs the
    // opener relationship unless the parent explicitly allows cross-origin
    // popups via COOP. Without this, the popup completes auth but never
    // posts the credential back — symptom: "Continue with Google" opens a
    // popup, user signs in, popup hangs / can't close, parent stays anonymous.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
