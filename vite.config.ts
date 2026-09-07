/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// GitHub Pages 專案站台的 base 路徑。若 repo 名稱改變，或改用自訂網域，調整這裡。
const base = process.env.GITHUB_PAGES === "true" ? "/Fast_mapper/" : "/";

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "favicon.svg", "favicon-32.png"],
      manifest: {
        name: "Fast mapper",
        short_name: "Fast mapper",
        description: "通用的格線／底圖地圖繪製工具",
        lang: "zh-Hant",
        theme_color: "#3d322a",
        background_color: "#f3ece0",
        display: "standalone",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 所有靜態資產 precache；離線時 SPA 回退到 index.html
        globPatterns: ["**/*.{js,css,html,png,svg,json,woff2}"],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
