import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Reuses the existing FastAPI backend (main.py): /api/mask and /api/fetch.
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/input': 'http://127.0.0.1:8000',
      '/output': 'http://127.0.0.1:8000',
      '/workspaces': 'http://127.0.0.1:8000',
    },
  },
})
