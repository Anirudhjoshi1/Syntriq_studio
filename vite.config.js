import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Syntriq Studio",
        short_name: "Syntriq",
        description:
          "Your private, on-device study toolkit — convert, compress & organise files without anything leaving your device.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#f4f6fa",
        theme_color: "#f4f6fa",
        categories: ["productivity", "education", "utilities"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // precache the app shell + all build assets (lazy chunks, pdf worker, etc.)
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,wasm,mjs}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
