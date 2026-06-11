import { defineConfig } from 'vite';

export default defineConfig({
  base: '/carcassonne/',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**'],
  },
});
