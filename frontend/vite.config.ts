import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Minificación y tree-shake por defecto; el lazy-load de rutas en App reduce JS inicial
    target: 'es2022',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 15173,
    proxy: {
      // En Docker: redirige al servicio backend (nombre del contenedor en la red Docker).
      // En local sin Docker: define VITE_API_URL en .env para evitar el proxy,
      // o cambia "backend" por "localhost" y el puerto que uses.
      '/api': { target: process.env.VITE_API_URL || 'http://backend:13001', changeOrigin: true },
      '/uploads': { target: process.env.VITE_API_URL || 'http://backend:13001', changeOrigin: true },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://backend:13001',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./test/config/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
    },
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
