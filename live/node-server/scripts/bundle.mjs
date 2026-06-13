import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(scriptsDir, "..");
const distServer = path.join(pkgRoot, "..", "dist", "server");
const entry = path.join(pkgRoot, "dist", "index.js");
const outfile = path.join(distServer, "live-api.mjs");

mkdirSync(distServer, { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  minify: true,
  legalComments: "none",
  banner: {
    js: "import { createRequire } from 'module';const require=createRequire(import.meta.url);",
  },
});

copyFileSync(path.join(pkgRoot, "config.json"), path.join(distServer, "config.json"));
console.log(`Bundled -> ${outfile}`);
