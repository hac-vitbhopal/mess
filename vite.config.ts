import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        workbox: {
          clientsClaim: true,          // Takes control of open client tabs immediately upon new build
          skipWaiting: true,           // Forces waiting service worker to activate instantly
          cleanupOutdatedCaches: true, // Purges stale cache bundles automatically
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              // Securely cache Firestore API data for offline menu availability
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "vitmess-firestore-offline-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours offline retention
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: "VITMESS Campus Dining Companion",
          short_name: "VITMESS",
          description: "High-performance campus dining SaaS with zero-read offline caching",
          theme_color: "#007F86",
          background_color: "#E9F7F4",
          display: "standalone",
          icons: [
            {
              src: "/mess_logo.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    build: {
      sourcemap: false, // 🔒 Locks down production source code against browser DevTools inspection
      rollupOptions: {
        output: {
          // 🛡️ Security Hardening: Obfuscate chunk filenames with cryptographic hashes
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: "assets/[hash].[ext]",
        },
      },
    },
    ssr: {
      external: ["firebase-admin", "@google-cloud/firestore"],
    },
  },
});