import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = join(distRoot, "server");

function readServerPort() {
  try {
    const cfg = JSON.parse(readFileSync(join(serverDir, "config.json"), "utf8"));
    return Number(cfg.port) || 8765;
  } catch {
    return 8765;
  }
}

function findPython() {
  const candidates = [
    join(distRoot, "..", "server", ".venv", "Scripts", "python.exe"),
    join(serverDir, ".venv", "Scripts", "python.exe"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "python";
}

function killPort(port) {
  if (process.platform !== "win32") return;
  try {
    const output = execSync(`netstat -ano | findstr ":${port}.*LISTENING"`, { encoding: "utf8" });
    for (const line of output.split("\n")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid) && pid !== "0") {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* port free */
  }
}

const port = readServerPort();
killPort(port);

const python = findPython();
console.log(`启动 API 服务 http://127.0.0.1:${port}/`);

const child = spawn(python, ["serve.py"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
