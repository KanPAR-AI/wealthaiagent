// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/chataiagent/', // <--- Add this line
  server:{
    // Remove or update allowedHosts as ngrok is typically for local development
    // For Cloud Run, this is not needed.
    // allowedHosts:["f2e7-171-79-102-21.ngrok-free.app"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})