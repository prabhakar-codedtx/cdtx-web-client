import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Makes the storefront installable — on a phone/tablet's "Add to Home
    // Screen" and, just as importantly, on an Android TV browser, so the same
    // web build can be sideloaded onto a TV without a native app release.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: '/',
        name: 'Cdtx',
        short_name: 'Cdtx',
        description: 'Cdtx OTT storefront',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // "any" rather than "landscape": the same build installs on a phone
        // (portrait) and a TV (landscape) — locking one orientation would be
        // wrong for the other.
        orientation: 'any',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Storefront layout responses change on every publish, so they get a
        // short-lived NetworkFirst cache (usable the instant a TV app is
        // reopened offline, but never trusted for long) rather than the
        // CacheFirst that's right for images.
        runtimeCaching: [
          {
            urlPattern: /\/v1\/(storefront|launch|collections)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'delivery-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/picsum\.photos\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-art',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3100,
    host: true,
    open: !process.env.DOCKER,
    // Same reasoning as the admin console's proxy: keeps the browser's calls
    // same-origin so this works inside a sandboxed preview pane, not just a
    // normal browser tab.
    proxy: {
      '/v1': { target: process.env.VITE_PROXY_TARGET || 'https://3-109-241-147.sslip.io', changeOrigin: true, secure: true },
      '/image': { target: process.env.VITE_PROXY_TARGET || 'https://3-109-241-147.sslip.io', changeOrigin: true, secure: true },
    },
  },
});
