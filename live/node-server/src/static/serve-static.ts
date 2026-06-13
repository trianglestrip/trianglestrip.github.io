import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

export function serveStatic(
  webRoot: string,
  reqPath: string,
  res: ServerResponse,
  extraHeaders: Record<string, string>,
): boolean {
  const rel = reqPath.replace(/^\/+/, "") || "index.html";
  const root = path.resolve(webRoot);
  let target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep) && target !== root) {
    res.writeHead(403);
    res.end();
    return true;
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    const fallback = path.join(root, "index.html");
    if (existsSync(fallback) && !rel.startsWith("api/")) {
      target = fallback;
    } else {
      res.writeHead(404);
      res.end("Not found");
      return true;
    }
  }
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    ...extraHeaders,
  });
  createReadStream(target).pipe(res);
  return true;
}

export function sendApiOnly(
  res: ServerResponse,
  send: (res: ServerResponse, payload: unknown, status?: number) => void,
): void {
  send(
    res,
    {
      ok: false,
      error: "本服务仅提供 API。请单独部署前端，或在 server/config.json 中开启 static.enabled。",
    },
    404,
  );
}

export function webHeaders(webRoot: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (webRoot) {
    headers["X-Live-Web-Root"] = webRoot;
  }
  return headers;
}

export function guessApiOnly(_req: IncomingMessage): boolean {
  return true;
}
