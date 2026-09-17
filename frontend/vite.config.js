import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
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
