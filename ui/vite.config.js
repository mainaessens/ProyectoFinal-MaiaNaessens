import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = `http://127.0.0.1:${process.env.FARO_PORT || 4310}`;

export default defineConfig({
  root: 'web',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/ws': { target: api, ws: true },
    },
  },
});
