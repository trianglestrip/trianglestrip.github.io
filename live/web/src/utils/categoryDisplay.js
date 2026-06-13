import { apiUrl } from "../config/app.js";

/** 与 node-server category-cross-map.ts 同步；canonical name 以斗鱼侧统一名为准 */
const FALLBACK_CATEGORIES = [
  { key: "lol", name: "英雄联盟", aliases: ["英雄联盟", "lol", "league of legends", "英雄联盟赛事"], douyu: "1", huya: "1" },
  { key: "cs2", name: "CS2", aliases: ["cs2", "csgo", "反恐精英", "counter-strike", "cs:go"], douyu: "6", huya: "862" },
  { key: "wzry", name: "王者荣耀", aliases: ["王者荣耀", "王者"], douyu: "181", huya: "2336" },
  { key: "hpjy", name: "和平精英", aliases: ["和平精英", "绝地求生", "pubg", "吃鸡"], douyu: "270", huya: "3203" },
  { key: "valorant", name: "无畏契约", aliases: ["无畏契约", "valorant", "瓦罗兰特"], douyu: "5937", huya: "5937" },
  { key: "dota2", name: "DOTA2", aliases: ["dota2", "dota 2", "刀塔"], douyu: "7", huya: "7" },
  { key: "cf", name: "穿越火线", aliases: ["穿越火线", "cf"], douyu: "4", huya: "4" },
  { key: "dnf", name: "地下城与勇士", aliases: ["地下城与勇士", "dnf"], douyu: "2", huya: "2" },
  { key: "hs", name: "炉石传说", aliases: ["炉石传说", "炉石"], douyu: "393", huya: "393" },
  { key: "tft", name: "云顶之弈", aliases: ["云顶之弈", "lol云顶之弈", "tft"], douyu: "5485", huya: "5485" },
  { key: "xingxiu", name: "星秀", aliases: ["星秀", "颜值", "娱乐"], douyu: "1008", huya: "897" },
  { key: "host", name: "主机游戏", aliases: ["主机", "主机游戏", "单机", "switch", "ps5"], douyu: "1282", huya: "1964" },
];

let categories = FALLBACK_CATEGORIES;
let loadPromise = null;

function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function cidForSite(entry, site) {
  if (site === "douyu") return entry.douyu;
  if (site === "huya") return entry.huya;
  return undefined;
}

export function findCrossCategory(site, categoryName, cid) {
  const siteId = String(site || "").trim();
  const cidText = String(cid || "").trim();
  if (cidText && siteId) {
    for (const entry of categories) {
      const mapped = cidForSite(entry, siteId);
      if (mapped && mapped === cidText) return entry;
    }
  }

  const name = norm(categoryName);
  if (!name) return null;

  for (const entry of categories) {
    if (norm(entry.name) === name) return entry;
    for (const alias of entry.aliases || []) {
      const a = norm(alias);
      if (a && (name === a || name.includes(a) || a.includes(name))) return entry;
    }
  }
  return null;
}

/** 统一展示名：命中跨平台映射用 canonical name，否则用平台原名 */
export function displayCategoryName(site, categoryName, cid) {
  const raw = String(categoryName || "").trim();
  if (!raw) return "";
  const entry = findCrossCategory(site, raw, cid);
  return entry?.name || raw;
}

export async function loadCategoryCrossMap() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(apiUrl("/api/category-cross-map"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.categories) && data.categories.length) {
        categories = data.categories;
      }
    } catch {
      /* 使用 FALLBACK */
    }
  })();
  return loadPromise;
}
