import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // Keep renderer and hook imports pinned to one module instance in dev.
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { force: true },
  server: { port: 5174, strictPort: true }
})
