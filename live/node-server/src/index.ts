import { createServer } from "node:http";
import { URL } from "node:url";
import { ResolveCache } from "./cache/resolve-cache.js";
import { browseApi } from "./browse/index.js";
import { loadConfig, resolveStaticRoot, type ServerConfig } from "./config/load-config.js";
import { handleApi, handleOptions, type AppContext } from "./http/handler.js";
import { applyCorsHeaders } from "./middleware/cors.js";
import { createResolveService } from "./resolve/service.js";
import { sendApiOnly, serveStatic, webHeaders } from "./static/serve-static.js";
import { createJsonSender } from "./http/json.js";

function parseArgs(argv: string[]): { config?: string; port?: number } {
  const out: { config?: string; port?: number } = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--config" && argv[i + 1]) {
      out.config = argv[++i];
    } else if (argv[i] === "--port" && argv[i + 1]) {
      out.port = Number(argv[++i]);
    }
  }
  return out;
}

export function startServer(cfg: ServerConfig, webRoot: string | null): void {
  const cache = new ResolveCache();
  const resolveService = createResolveService(cache);
  const ctx: AppContext = {
    config: cfg,
    cache,
    resolveService,
    browseApi,
    webRoot,
  };

  const sendJson = createJsonSender(cfg);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "OPTIONS") {
      handleOptions(res, cfg);
      return;
    }
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, ctx);
      if (!handled) {
        sendJson(res, { ok: false, error: "Not found" }, 404);
      }
      return;
    }

    if (!webRoot) {
      sendApiOnly(res, sendJson);
      return;
    }

    const extra: Record<string, string> = { ...webHeaders(webRoot) };
    const corsHeaders: Record<string, string | number> = {};
    applyCorsHeaders(corsHeaders, cfg.cors);
    for (const [k, v] of Object.entries(corsHeaders)) {
      extra[k] = String(v);
    }
    serveStatic(webRoot, url.pathname, res, extra);
  });

  const host = cfg.host || "127.0.0.1";
  const port = cfg.port || 8765;

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(`错误: 无法绑定 ${host}:${port}（${err.message}）`);
    console.error("      可能已有旧服务在运行。Windows 可先执行:");
    console.error(`      netstat -ano | findstr :${port}`);
    console.error("      taskkill /PID <pid> /F");
    console.error("      或直接运行: .\\start.bat");
    process.exit(1);
  });

  server.listen(port, host, () => {
    if (webRoot) {
      console.log(`静态托管: ${webRoot}`);
    } else if (cfg.static?.enabled) {
      console.log("警告: static.enabled=true 但未找到 dist/index.html，仅提供 API");
    } else {
      console.log("模式: 仅 API（前后端解耦，前端请单独部署）");
    }
    console.log(`API: http://${host}:${port}/api/health`);
    console.log("     GET /api/room?site=douyu|huya|douyin&room=<id>&mode=lazy|full");
    console.log("     GET /api/categories?site=douyu|huya");
    console.log("     GET /api/rooms?site=douyu|huya&cid=<id>&page=1");
    console.log("     GET /api/rooms?site=douyu|huya&recommend=1&page=1");
    console.log("     GET /api/time?site=douyu|huya&room=<id>&run=0|1");
    console.log("     GET/POST /api/follows/store  已禁用服务端共享（关注仅存浏览器）");
    console.log("配置: config.json（可选 config.local.json 覆盖）");
    console.log("按 Ctrl+C 停止");
  });
}

function main(): void {
  const args = parseArgs(process.argv);
  const cfg = loadConfig(args.config);
  if (args.port != null) {
    cfg.port = args.port;
  }
  const webRoot = resolveStaticRoot(cfg);
  startServer(cfg, webRoot);
}

main();
