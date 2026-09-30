import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        activity: fileURLToPath(new URL('./index.html', import.meta.url)),
        gate: fileURLToPath(new URL('./gate.html', import.meta.url)),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
