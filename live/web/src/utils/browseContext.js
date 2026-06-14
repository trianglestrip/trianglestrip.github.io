import { loadJson, saveJson } from "./prefStore.js";

const STORE_KEY = "live.browse.context";

function readAll() {
  return loadJson(STORE_KEY, {}) || {};
}

/** 记录用户最近一次浏览上下文，供播放页返回与相关推荐使用 */
export function saveBrowseContext(site, context) {
  const key = String(site || "").trim();
  if (!key || !context) return;
  const all = readAll();
  all[key] = { ...context, at: Date.now() };
  saveJson(STORE_KEY, all);
}

export function loadBrowseContext(site) {
  const key = String(site || "").trim();
  if (!key) return null;
  return readAll()[key] || null;
}

/** 播放页左上角返回目标 */
export function browseBackTarget(site) {
  const ctx = loadBrowseContext(site);
  if (ctx?.type === "category" && ctx.cid != null && ctx.cid !== "") {
    const query = ctx.pid != null && String(ctx.pid) !== "" ? { pid: String(ctx.pid) } : undefined;
    return {
      name: "category-rooms",
      params: { site, cid: String(ctx.cid) },
      query,
    };
  }
  if (ctx?.type === "cross" && ctx.key) {
    return { name: "all-category-rooms", params: { key: String(ctx.key) } };
  }
  return { name: "site-home", params: { site } };
}
