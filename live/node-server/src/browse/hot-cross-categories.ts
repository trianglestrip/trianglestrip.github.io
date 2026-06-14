import { CROSS_CATEGORIES } from "./cross-categories.data.js";
import type { CrossCategoryEntry } from "./category-cross-map.js";

/** 首页「全平台」热门游戏（跨平台映射 key，顺序即展示顺序） */
export const HOT_CROSS_CATEGORY_KEYS = [
  "lol",
  "g4133_9449_1011032",
  "wzry",
  "hpjy",
  "cs2",
  "dota2",
  "cf",
  "g1227_6219_1010016",
  "g1223_5489_1010039",
  "g3379_7349_1010043",
  "g3133_7209_1010018",
  "tft",
  "hs",
  "valorant",
  "dnf",
  "g3358_6909_1010011",
  "g356_3115_1010041",
  "g2075_6111_1010358",
  "g2556_7185_1010055",
  "g3671_7711_1010155",
] as const;

export interface HotCrossCategory {
  key: string;
  name: string;
  douyu?: string;
  huya?: string;
  douyin?: string;
}

export function findCrossCategoryByKey(key: string): CrossCategoryEntry | null {
  const text = String(key || "").trim();
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
