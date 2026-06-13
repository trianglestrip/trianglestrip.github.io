import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import type { ResolveCache } from "../cache/resolve-cache.js";
import type { BrowseApi } from "../browse/index.js";
import type { ServerConfig } from "../config/load-config.js";
import { parseRoomId } from "../resolve/parse-room-id.js";
import type { ResolveService } from "../resolve/service.js";
import { buildTimeReport } from "../resolve/timing.js";
import { fetchFollowSnapshots } from "../follow/status.js";
import { loadFollowStore, normalizeStoredFollow, syncFollowStore } from "../follow/store.js";
import { fetchHuyaDanmakuSession } from "../danmaku/huya.js";
import { crossCategoryMapPayload } from "../browse/category-cross-map.js";
import { applyCorsHeaders } from "../middleware/cors.js";
import { sendJson } from "./json.js";

export interface AppContext {
  config: ServerConfig;
  cache: ResolveCache;
  resolveService: ResolveService;
  browseApi: BrowseApi;
  webRoot: string | null;
}

function queryBool(value: string | null, truthy = ["1", "true", "yes"]): boolean {
  return truthy.includes((value || "").toLowerCase());
}

function readQuery(req: IncomingMessage): URLSearchParams {
  const url = new URL(req.url || "/", "http://localhost");
  return url.searchParams;
}


async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) {
    return {};
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function finalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  payload.ok = true;
  return payload;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 解析/上游业务错误映射为 HTTP 状态码，避免不可用房间返回 500 */
function apiErrorStatus(message: string): number {
  if (message.includes("暂不支持平台") || message.includes("无效") || message.includes("缺少")) {
    return 400;
  }
  if (
    message.includes("房间未开播") ||
    message.includes("暂时无法") ||
    message.includes("获取失败") ||
    message.includes("未获取到") ||
    message.includes("not supported")
  ) {
    return 404;
  }
  return 500;
}

function sendApiError(res: ServerResponse, config: ServerConfig, err: unknown): void {
  const message = errorMessage(err);
  sendJson(res, config, { ok: false, error: message }, apiErrorStatus(message));
}

export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: AppContext,
): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/api/health" && req.method === "GET") {
    const staticCfg = ctx.config.static || {};
    sendJson(res, ctx.config, {
      ok: true,
      mode: ctx.webRoot ? "static+api" : "api-only",
      host: ctx.config.host,
      port: ctx.config.port,
      static_enabled: Boolean(staticCfg.enabled),
      static_root: ctx.webRoot,
      browse_api: true,
      resolve_cache: ctx.cache.stats(),
    });
    return true;
  }

  if (pathname === "/api/room" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const room = query.get("room") || query.get("id") || "9999";
    const mode = query.get("mode") || "lazy";
    const quality = query.get("quality") || null;
    const force = queryBool(query.get("force"));
    try {
      const roomId = parseRoomId(room, site);
      const payload = await ctx.resolveService.resolveRoom({
        site,
        roomId,
        mode,
        quality,
        force,
      });
      sendJson(res, ctx.config, finalizePayload(payload));
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/resolve" && req.method === "POST") {
    const query = readQuery(req);
    let data: Record<string, unknown>;
    try {
      data = await readJsonBody(req);
    } catch {
      sendJson(res, ctx.config, { ok: false, error: "无效 JSON" }, 400);
      return true;
    }
    const room = String(data.room ?? query.get("room") ?? "9999");
    const site = String(data.site ?? query.get("site") ?? "douyu");
    try {
      const roomId = parseRoomId(room, site);
      const mode = String(data.mode ?? query.get("mode") ?? "lazy");
      const quality = String(data.quality ?? query.get("quality") ?? "") || null;
      const force = queryBool(String(data.force ?? query.get("force") ?? "0"));
      const payload = await ctx.resolveService.resolveRoom({
        site,
        roomId,
        mode,
        quality,
        force,
      });
      sendJson(res, ctx.config, finalizePayload(payload));
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/categories" && req.method === "GET") {
    const site = readQuery(req).get("site") || "douyu";
    const cacheKey = `browse:categories:${site}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) {
      sendJson(res, ctx.config, { ok: true, site, categories: cached, cached: true });
      return true;
    }
    try {
      const categories = await ctx.browseApi.fetchCategories(site);
      ctx.cache.set(cacheKey, categories, { ttl: 300 });
      sendJson(res, ctx.config, { ok: true, site, categories });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/rooms" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const page = Number(query.get("page") || "1") || 1;
    const cid = query.get("cid") || query.get("id") || "";
    const pid = query.get("pid") || undefined;
    const recommend = queryBool(query.get("recommend"));
    const cacheKey = `browse:rooms:${site}:${recommend ? "rec" : cid}:${pid || ""}:${page}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached && typeof cached === "object") {
      sendJson(res, ctx.config, { ok: true, site, ...(cached as Record<string, unknown>), cached: true });
      return true;
    }
    try {
      let payload;
      if (recommend) {
        payload = await ctx.browseApi.fetchRecommendRooms(site, page);
      } else {
        if (!cid) {
          sendJson(res, ctx.config, { ok: false, error: "缺少 cid 参数" }, 400);
          return true;
        }
        payload = await ctx.browseApi.fetchCategoryRooms(site, cid, page, pid);
      }
      const result: Record<string, unknown> = {
        list: payload.list || [],
        hasMore: Boolean(payload.hasMore),
        page,
      };
      if (!recommend) {
        result.cid = cid;
        if (pid) {
          result.pid = pid;
        }
      }
      ctx.cache.set(cacheKey, result, { ttl: 60 });
      sendJson(res, ctx.config, { ok: true, site, ...result });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/category-cross-map" && req.method === "GET") {
    sendJson(res, ctx.config, { ok: true, ...crossCategoryMapPayload() });
    return true;
  }

  if (pathname === "/api/recommend-related" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const category = query.get("category") || "";
    const cid = query.get("cid") || "";
    const page = Number(query.get("page") || "1") || 1;
    const perSite = Number(query.get("perSite") || "10") || 10;
    const limit = Number(query.get("limit") || "20") || 20;
    const cacheKey = `browse:related:${site}:${category}:${cid}:${page}:${perSite}:${limit}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached && typeof cached === "object") {
      sendJson(res, ctx.config, { ok: true, ...(cached as Record<string, unknown>), cached: true });
      return true;
    }
    try {
      const payload = await ctx.browseApi.fetchRelatedRecommendRooms(
        site,
        category,
        cid,
        page,
        perSite,
        limit,
      );
      const result = {
        list: payload.list || [],
        categoryKey: payload.categoryKey,
        categoryName: payload.categoryName,
        page,
        perSite,
        limit,
      };
      ctx.cache.set(cacheKey, result, { ttl: 60 });
      sendJson(res, ctx.config, { ok: true, ...result });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/follows/status" && req.method === "POST") {
    let data: Record<string, unknown>;
    try {
      data = await readJsonBody(req);
    } catch {
      sendJson(res, ctx.config, { ok: false, error: "无效 JSON" }, 400);
      return true;
    }
    const rooms = data.rooms;
    if (!Array.isArray(rooms)) {
      sendJson(res, ctx.config, { ok: false, error: "缺少 rooms 数组" }, 400);
      return true;
    }
    try {
      const list = await fetchFollowSnapshots(rooms as Array<{ site?: string; id?: string; roomId?: string }>);
      sendJson(res, ctx.config, { ok: true, list });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/follows/store" && req.method === "GET") {
    const payload = loadFollowStore();
    sendJson(res, ctx.config, { ok: true, ...payload });
    return true;
  }

  if (pathname === "/api/follows/store" && req.method === "POST") {
    let data: Record<string, unknown>;
    try {
      data = await readJsonBody(req);
    } catch {
      sendJson(res, ctx.config, { ok: false, error: "无效 JSON" }, 400);
      return true;
    }
    const rawFollows = data.follows;
    if (!Array.isArray(rawFollows)) {
      sendJson(res, ctx.config, { ok: false, error: "缺少 follows 数组" }, 400);
      return true;
    }
    const incoming = rawFollows
      .map((item) => normalizeStoredFollow(item as Record<string, unknown>))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    try {
      const payload = syncFollowStore(incoming);
      sendJson(res, ctx.config, { ok: true, ...payload });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/huya/danmaku" && req.method === "GET") {
    const query = readQuery(req);
    const room = query.get("room") || query.get("id") || "";
    if (!room) {
      sendJson(res, ctx.config, { ok: false, error: "缺少 room 参数" }, 400);
      return true;
    }
    try {
      const session = await fetchHuyaDanmakuSession(room);
      sendJson(res, ctx.config, { ok: true, ...session });
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  if (pathname === "/api/time" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const room = query.get("room") || query.get("id") || "252140";
    const quality = query.get("quality") || null;
    const run = queryBool(query.get("run"));
    try {
      const roomId = parseRoomId(room, site);
      const payload = await buildTimeReport(ctx.resolveService, ctx.cache, site, roomId, {
        quality,
        run,
      });
      sendJson(res, ctx.config, payload);
    } catch (err) {
      sendApiError(res, ctx.config, err);
    }
    return true;
  }

  return false;
}

export function handleOptions(res: ServerResponse, config: ServerConfig): void {
  const headers: Record<string, string | number> = {};
  applyCorsHeaders(headers, config.cors);
  res.writeHead(204, headers);
  res.end();
}
