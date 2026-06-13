import type { ServerResponse } from "node:http";
import type { ServerConfig } from "../config/load-config.js";
import { applyCorsHeaders } from "../middleware/cors.js";
import { sanitizeUnicode } from "../middleware/sanitize-json.js";

export function sendJson(res: ServerResponse, config: ServerConfig, payload: unknown, status = 200): void {
  const data = JSON.stringify(sanitizeUnicode(payload));
  const headers: Record<string, string | number> = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  };
  applyCorsHeaders(headers, config.cors);
  res.writeHead(status, headers);
  res.end(data);
}

export function createJsonSender(config: ServerConfig) {
  return (res: ServerResponse, payload: unknown, status = 200) => sendJson(res, config, payload, status);
}
