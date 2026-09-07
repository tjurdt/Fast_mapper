/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

// GitHub Pages 專案站台的 base 路徑。若 repo 名稱改變，或改用自訂網域，調整這裡。
const base = process.env.GITHUB_PAGES === "true" ? "/Fast_mapper/" : "/";

export default defineConfig({
  base,
  plugins: [preact()],
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
