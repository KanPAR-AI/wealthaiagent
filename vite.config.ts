// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/chataiagent/', // Ensures assets are pathed correctly for the subfolder
  server:{
    // allowedHosts: ["f2e7-171-79-102-21.ngrok-free.app"] // Remove or comment out for production builds
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})