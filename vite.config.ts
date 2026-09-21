import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://joyston1805.github.io/3D-World/ (a GitHub Pages project
  // page), so all asset URLs need this subpath prefix.
  base: '/3D-World/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.SERVER_PORT ?? 8787}`,
    },
  },
})
