import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

function run(script) {
  return spawn(node, [join(scriptsDir, script)], {
    stdio: "inherit",
    shell: false,
  });
}

console.log("启动 Live 后端与前端...\n");

const api = run("start-api.mjs");
const children = [api];

const webTimer = setTimeout(() => {
  children.push(run("start-web.mjs"));
}, 2000);

function shutdown() {
  clearTimeout(webTimer);
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

api.on("exit", (code) => {
  if (code && code !== 0) shutdown();
});
