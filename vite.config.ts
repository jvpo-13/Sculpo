import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' permite publicar em qualquer subcaminho do GitHub Pages.
// Este arquivo não usa APIs do Node de propósito: o tsconfig só tem lib DOM.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
