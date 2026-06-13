import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(pkgRoot, "..", "dist");
const NODE_VER = "20.18.1";

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function findNodeExe(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findNodeExe(full);
      if (found) return found;
    } else if (entry.name === "node.exe") {
      return full;
    }
  }
  return null;
}

function ensureDistNodeExe() {
  const dest = path.join(distRoot, "node.exe");
  if (existsSync(dest)) return;

  const cacheDir = path.join(pkgRoot, ".cache", "node");
  ensureDir(cacheDir);
  const zipName = `node-v${NODE_VER}-win-x64.zip`;
  const zipPath = path.join(cacheDir, zipName);

  if (!existsSync(zipPath)) {
    console.log(`Downloading Node.js ${NODE_VER}...`);
    const url = `https://nodejs.org/dist/v${NODE_VER}/${zipName}`;
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`],
      { stdio: "inherit" },
    );
  }

  const extractDir = path.join(cacheDir, `extract-${NODE_VER}`);
  if (existsSync(extractDir)) rmSync(extractDir, { recursive: true, force: true });
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'`],
    { stdio: "inherit" },
  );

  const nodeExe = findNodeExe(extractDir);
  if (!nodeExe) throw new Error("node.exe not found in Node.js archive");

  ensureDir(distRoot);
  copyFileSync(nodeExe, dest);
  console.log("Copied node.exe -> dist/");
}

ensureDistNodeExe();
