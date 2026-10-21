import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // List of built files, read by public/sw.js to cache every app for offline use
    manifest: 'asset-manifest.json',
  },
  test: {
    environment: 'jsdom',
  },
})
