import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface CorsConfig {
  enabled?: boolean;
  allowOrigin?: string;
}

export interface StaticConfig {
  enabled?: boolean;
  distPath?: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  cors: CorsConfig;
  static: StaticConfig;
}

const DEFAULT_CONFIG: ServerConfig = {
  host: "127.0.0.1",
  port: 8765,
  cors: {
    enabled: true,
    allowOrigin: "*",
  },
  static: {
    enabled: false,
    distPath: "../dist/web",
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    if (value && typeof value === "object" && !Array.isArray(value) && existing && typeof existing === "object") {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function readJsonFile(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as Record<string, unknown>;
}

export function appRoot(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  if (existsSync(path.join(scriptDir, "config.json"))) {
    return scriptDir;
  }
  const parent = path.dirname(scriptDir);
  if (existsSync(path.join(parent, "config.json"))) {
    return parent;
  }
  return parent;
}

export function loadConfig(configPath?: string): ServerConfig {
  const root = appRoot();
  const pathToUse = configPath ? path.resolve(configPath) : path.join(root, "config.json");
  let cfg = structuredClone(DEFAULT_CONFIG) as ServerConfig & Record<string, unknown>;

  if (existsSync(pathToUse)) {
    cfg = deepMerge(cfg, readJsonFile(pathToUse));
  }

  const local = path.join(path.dirname(pathToUse), "config.local.json");
  if (existsSync(local)) {
    cfg = deepMerge(cfg, readJsonFile(local));
  }

  return cfg;
}

export function resolveStaticRoot(cfg: ServerConfig): string | null {
  const staticCfg = cfg.static || {};
  if (!staticCfg.enabled) {
    return null;
  }
  const raw = staticCfg.distPath || "../dist/web";
  const root = path.resolve(appRoot(), raw);
  const index = path.join(root, "index.html");
  return existsSync(index) ? root : null;
}
