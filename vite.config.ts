import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

const isSsl = process.env.VITE_SSL === 'true';

// Build identity shown in the menu, so testers can tell which version they're running
const resolveCommit = (): string => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
};

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify({ commit: resolveCommit(), builtAt: new Date().toISOString() })
  },
  plugins: [
    react(),
    ...(isSsl ? [basicSsl()] : []),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'brewing-icon.svg'],
      manifest: {
        name: 'BrewMate HUD Session Timer',
        short_name: 'BrewMate',
        description: 'Interactive Brew Day Assistant & HUD Session Timer for Android',
        theme_color: '#0a0d14',
        background_color: '#0a0d14',
        display: 'standalone',
        orientation: 'any',
        // Relative so they resolve under the GitHub Pages sub-path (base: './')
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173
  }
});
