import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    ssr: path.resolve(__dirname, 'worker/index.ts'),
    outDir: 'dist/server',
    emptyOutDir: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'index.js',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
