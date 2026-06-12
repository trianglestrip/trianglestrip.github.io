import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = resolve(import.meta.dirname);
const flvSrc = resolve(root, "node_modules/flv.js/dist/flv.min.js");
const publicDir = resolve(root, "public");
const flvDest = resolve(publicDir, "flv.min.js");

function readServerConfig() {
  const path = resolve(root, "../server/config.json");
  if (!existsSync(path)) return { port: 8765 };
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { port: 8765 };
  }
}

function readWebConfig() {
  const path = resolve(publicDir, "config.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

const serverCfg = readServerConfig();
const webCfg = readWebConfig();
const apiPort = serverCfg.port ?? 8765;
const devApiBase = webCfg.api?.devBaseUrl || `http://127.0.0.1:${apiPort}`;

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
        target: devApiBase.replace(/\/$/, ""),
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
