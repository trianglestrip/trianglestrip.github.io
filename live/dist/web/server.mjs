import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2]) || 8080;
const BIND = process.env.LIVE_BIND || "127.0.0.1";

/** 空或 "/" 表示站点根路径；设为 "/live" 可兼容 GitHub Pages 子目录托管 */
const BASE = (() => {
  const raw = process.env.LIVE_BASE;
  if (raw === "" || raw === "/") return "";
  const trimmed = String(raw ?? "").trim().replace(/\/+$/, "");
  return trimmed;
})();

const API_ORIGIN = (() => {
  if (process.env.LIVE_API) {
    return String(process.env.LIVE_API).trim().replace(/\/+$/, "");
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
    const base = String(cfg?.api?.baseUrl || "").trim().replace(/\/+$/, "");
    if (base) return base;
  } catch {
    /* ignore */
  }
  return "http://127.0.0.1:8765";
})();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function stripBase(urlPath) {
  const p = decodeURIComponent((urlPath || "/").split("?")[0]);
  if (!BASE) return p;
  if (p === BASE || p.startsWith(`${BASE}/`)) {
    const rest = p.slice(BASE.length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return p;
}

function resolveFile(urlPath) {
  const rel = stripBase(urlPath).replace(/^\/+/, "") || "index.html";
  let filePath = path.resolve(ROOT, rel);
  const prefix = ROOT + path.sep;
  if (filePath !== ROOT && !filePath.startsWith(prefix)) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(rel).toLowerCase();
    if (ext && MIME[ext]) return null;
    filePath = path.join(ROOT, "index.html");
  }
  return filePath;
}

function responseHeaders(filePath, ext) {
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
  const assetsDir = `${path.sep}assets${path.sep}`;
  if (ext === ".html" || filePath.endsWith(`${path.sep}index.html`)) {
    headers["Cache-Control"] = "no-cache, must-revalidate";
  } else if (filePath.includes(assetsDir)) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }
  return headers;
}

function proxyApi(req, res) {
  const target = new URL(req.url || "/", API_ORIGIN);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  const upstream = http.request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`API proxy error: ${err.message}`);
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const apiPath = stripBase(req.url);
    if (apiPath.startsWith("/api/")) {
      proxyApi(req, res);
      return;
    }

    const filePath = resolveFile(req.url);
    if (!filePath) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, responseHeaders(filePath, ext));
      res.end(data);
    });
  })
  .listen(PORT, BIND, () => {
    const suffix = BASE ? `${BASE}/` : "/";
    console.log(`http://${BIND}:${PORT}${suffix}`);
    console.log(`API proxy -> ${API_ORIGIN}`);
  });
