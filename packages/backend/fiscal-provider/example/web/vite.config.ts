import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Docker Desktop (mac) não propaga eventos de fs em bind mounts — polling garante o HMR
    watch: { usePolling: true },
    // HMR explícito: dentro do container o Vite não sabe a porta externa mapeada.
    // clientPort força o navegador a conectar o WebSocket em localhost:5173 (porta publicada),
    // senão o auto-reload não chega na aba e a tela fica com bundle antigo.
    hmr: { host: 'localhost', clientPort: 5173, protocol: 'ws' },
    proxy: {
      '/api': {
        // Local: localhost:3334. No container dev: http://api:3333 via VITE_API_TARGET
        target: process.env.VITE_API_TARGET || 'http://localhost:3334',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
