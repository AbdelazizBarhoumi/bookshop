import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// electron plugins
import electron from 'vite-plugin-electron/simple';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),
    // main & preload process build (simple API)
    electron({
      main: {
        entry: 'src/electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: true,
          },
        },
      },
      preload: {
        input: 'src/electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            // do not empty when building preload so main.js isn't removed
            emptyOutDir: false,
          },
        },
      },
    }),
    // renderer helper to enable `electron` imports in renderer code
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
});
