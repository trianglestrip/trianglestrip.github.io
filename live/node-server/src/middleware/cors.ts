import type { ServerConfig } from "../config/load-config.js";

export function applyCorsHeaders(headers: Record<string, string | number>, cors: ServerConfig["cors"]): void {
  if (cors?.enabled === false) {
    return;
  }
  headers["Access-Control-Allow-Origin"] = cors?.allowOrigin || "*";
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Allow-Private-Network"] = "true";
}
