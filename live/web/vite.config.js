import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = resolve(import.meta.dirname);
const flvSrc = resolve(root, "node_modules/flv.js/dist/flv.min.js");
const publicDir = resolve(root, "public");
const flvDest = resolve(publicDir, "flv.min.js");

function copyStaticAssets() {
  return {
    name: "copy-static-assets",
    buildStart() {
      if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
      if (existsSync(flvSrc)) {
        copyFileSync(flvSrc, flvDest);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyStaticAssets(), vue()],
  base: "/",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
      },
    },
    headers: {
      "Permissions-Policy": "unload=(self)",
    },
  },
  preview: {
    headers: {
      "Permissions-Policy": "unload=(self)",
    },
  },
});
