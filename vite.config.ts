import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("node_modules/react-router") || id.includes("node_modules/@remix-run")) return "router-vendor";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) {
            if (id.includes("/@firebase/firestore") || id.includes("/firebase/firestore")) return "firebase-firestore";
            if (id.includes("/@firebase/auth") || id.includes("/firebase/auth")) return "firebase-auth";
            if (id.includes("/@firebase/functions") || id.includes("/firebase/functions")) return "firebase-functions";
            if (id.includes("/@firebase/storage") || id.includes("/firebase/storage")) return "firebase-storage";
            return "firebase-core";
          }
          if (id.includes("node_modules/lucide-react/")) return "icons-vendor";
          if (id.includes("node_modules/qrcode/")) return "qrcode-vendor";
          if (id.includes("node_modules/zod/")) return "zod-vendor";
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "firebase-storage-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
