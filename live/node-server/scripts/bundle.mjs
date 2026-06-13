import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "..", "dist", "index.js");
const outfile = path.join(root, "..", "live-api.mjs");

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  banner: {
    js: "import { createRequire } from 'module';const require=createRequire(import.meta.url);",
  },
});

console.log(`Bundled -> ${outfile}`);
