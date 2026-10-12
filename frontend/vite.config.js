import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Unit tests for the pure logic in src/ (api helpers, auth timing). Browser behaviour is
  // covered by the Playwright specs in e2e/, which run against the real stack.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  server: {
    // Mirrors nginx.conf's /api/ reverse proxy used in the Docker build, so
    // the frontend can call relative `/api/...` paths in both `npm run dev`
    // and the production container without any env-var-based base URL.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
