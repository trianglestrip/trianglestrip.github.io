import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";

const distRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(distRoot, "web");
const DEFAULT_PORT = 8080;

function readWebPort() {
  const fromEnv = Number(process.env.LIVE_WEB_PORT);
  if (fromEnv > 0) return fromEnv;
  try {
    const cfg = JSON.parse(readFileSync(join(webDir, "config.json"), "utf8"));
    return Number(cfg.port) || DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

const port = readWebPort();

const server = http.createServer((request, response) =>
  handler(request, response, {
    public: webDir,
    rewrites: [{ source: "**", destination: "/index.html" }],
  }),
);

server.listen(port, "127.0.0.1", () => {
  console.log(`启动前端静态服务 http://127.0.0.1:${port}/`);
});
