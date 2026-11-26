import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'chrome120',
  },
  server: {
    port: 5183,
    strictPort: false,
  },
});
