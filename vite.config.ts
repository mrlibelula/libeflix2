import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.tsx'],
      ssr: 'resources/js/ssr.tsx',
      refresh: true,
      // Explicit Herd host so Vite serves HTTPS + WSS on libeflix2.test:5173
      // (avoids HMR WebSocket failures that drop the dev server mid-session).
      detectTls: 'libeflix2.test',
    }),
    react(),
    tailwindcss(),
  ],
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      'ziggy-js': resolve(__dirname, 'vendor/tightenco/ziggy'),
      // '@': resolve(__dirname, 'resources/js'),
    },
  },
  server: {
    watch: {
      // Ignore noisy paths that can thrash the watcher and destabilize HMR on Windows.
      ignored: ['**/storage/framework/sessions/**', '**/storage/logs/**', '**/public/hot'],
    },
  },
});
