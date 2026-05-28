import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/jobs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/system': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/internal': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
