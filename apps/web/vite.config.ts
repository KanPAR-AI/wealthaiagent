// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/chataiagent/', // Ensures assets are pathed correctly for the subfolder
  server:{
    allowedHosts: ["bc7d-2401-4900-1c3d-4d6a-bd5b-de75-4037-927a.ngrok-free.app"] // Remove or comment out for production builds
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})