import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Deposit Defender',
        short_name: 'DepoDefen',
        description: 'Student Housing Deposit Protection',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    allowedHosts: ['.trycloudflare.com'],
    hmr: {
	protocol: 'wss',
	clientPort: 443,
    },
    proxy: {
      '/api/analyze': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      '/api/ollama': {
        target: 'http://host.containers.internal:11434',
        changeOrigin: true,
        headers: {
          'Host': 'host.containers.internal:11434',
          'Origin': 'http://host.containers.internal:11434',
          'Referer': 'http://host.containers.internal:11434/'
        },
        rewrite: (path) => path.replace(/^\/api\/ollama/, '')
      }
    },
    watch: {
      ignored: ['**/venv/**', '**/node_modules/**']
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/gstack/**']
  }
});
