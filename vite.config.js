import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,  // suppress warning only — no manual splitting
  }
})
