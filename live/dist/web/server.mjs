import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2]) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const rel = decodeURIComponent((urlPath || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
  let filePath = path.resolve(ROOT, rel);
  const prefix = ROOT + path.sep;
  if (filePath !== ROOT && !filePath.startsWith(prefix)) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, "index.html");
  }
  return filePath;
}

http
  .createServer((req, res) => {
    const filePath = resolveFile(req.url);
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`http://127.0.0.1:${PORT}/`);
  });
