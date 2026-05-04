// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

const isCapacitor = process.env.VITE_CAPACITOR === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
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
