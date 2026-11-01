import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// The app talks to nothing but its own files, so the browser can refuse everything else, including any
// script injected through imported data. React sets inline styles through the DOM, which style-src allows.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

// GitHub Pages can't set response headers, so the policy goes in the page as a meta tag.
// Build only: the dev server needs inline scripts and a websocket for hot reload.
const contentSecurityPolicy = (): Plugin => ({
  name: 'brewmate-content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend'
    }
  ]
});

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify({ version, commit: resolveCommit(), builtAt: new Date().toISOString() })
  },
  plugins: [
    react(),
    contentSecurityPolicy(),
    ...(isSsl ? [basicSsl()] : []),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'badge-72.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
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
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
