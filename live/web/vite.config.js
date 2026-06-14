import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = resolve(import.meta.dirname);
const distWeb = resolve(root, "../dist/web");
const flvSrc = resolve(root, "node_modules/flv.js/dist/flv.min.js");
const publicDir = resolve(root, "public");
const flvDest = resolve(publicDir, "flv.min.js");

function readServerConfig() {
  const path = resolve(root, "../node-server/config.json");
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

/** 只清理 Vite 产物，保留 node.exe、server.mjs 等 */
function cleanViteOutput() {
  return {
    name: "clean-vite-output",
    buildStart() {
      if (!existsSync(distWeb)) {
        mkdirSync(distWeb, { recursive: true });
        return;
      }
      const assets = resolve(distWeb, "assets");
      if (existsSync(assets)) rmSync(assets, { recursive: true, force: true });
      const index = resolve(distWeb, "index.html");
      if (existsSync(index)) unlinkSync(index);
    },
  };
}

function writeDistConfig() {
  return {
    name: "write-dist-config",
    closeBundle() {
      if (process.env.npm_lifecycle_event !== "build:pages") {
        const cfg = {
          appTitle: "Lemon live",
          api: {
            baseUrl: "",
            devBaseUrl: "",
          },
        };
        writeFileSync(resolve(distWeb, "config.json"), `${JSON.stringify(cfg, null, 2)}\n`);
      }
      copyFileSync(resolve(root, "server.mjs"), resolve(distWeb, "server.mjs"));
    },
  };
}

export default defineConfig({
  plugins: [copyStaticAssets(), cleanViteOutput(), writeDistConfig(), vue()],
  base: "/",
  publicDir: "public",
  build: {
    outDir: distWeb,
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/vue-router")) return "vue-router";
          if (id.includes("node_modules/vue/") || id.includes("node_modules/@vue/")) return "vue";
        },
      },
    },
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !/\/play[-.]/.test(dep) && !dep.includes("PlayView"));
      },
    },
  },
  server: {
    port: 8080,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: devApiBase.replace(/\/$/, ""),
        changeOrigin: true,
      },
    },
  },
});
