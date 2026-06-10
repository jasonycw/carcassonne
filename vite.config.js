import { defineConfig } from 'vite';

export default defineConfig({
  base: '/carcassonne/',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
