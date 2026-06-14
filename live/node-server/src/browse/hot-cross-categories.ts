import { CROSS_CATEGORIES } from "./cross-categories.data.js";
import type { CrossCategoryEntry } from "./category-cross-map.js";
import { resolveCrossCategoryKey } from "./cross-key-aliases.js";

/** 首页「全平台」热门游戏（跨平台映射 key，顺序即展示顺序） */
export const HOT_CROSS_CATEGORY_KEYS = [
  "lol",
  "sjz",
  "jx3",
  "wzry",
  "hpjy",
  "cs2",
  "dota2",
  "cf",
  "yjwj",
  "ys",
  "bhxy",
  "aqtw",
  "tft",
  "hs",
  "valorant",
  "dnf",
  "dzpd",
  "dwrg",
  "hmwk",
  "jcc",
  "jql",
  "wudao",
  "huwai",
  "xingxiu",
  "yanzhi",
] as const;

export interface HotCrossCategory {
  key: string;
  name: string;
  douyu?: string;
  huya?: string;
  douyin?: string;
}

export function findCrossCategoryByKey(key: string): CrossCategoryEntry | null {
  const text = resolveCrossCategoryKey(key);
  if (!text) return null;
  return CROSS_CATEGORIES.find((entry) => entry.key === text) || null;
}

export function listHotCrossCategories(): HotCrossCategory[] {
  const items: HotCrossCategory[] = [];
  for (const key of HOT_CROSS_CATEGORY_KEYS) {
    const entry = findCrossCategoryByKey(key);
    if (!entry || entry.kind === "group") continue;
    items.push({
      key: entry.key,
      name: entry.name,
      douyu: entry.douyu,
      huya: entry.huya,
      douyin: entry.douyin,
    });
  }
  return items;
}
