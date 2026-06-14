/**
 * 跨平台直播分类映射（统一名 → 各平台 cid/gid）
 * 用于侧栏「推荐」按当前房间分类拉取相关直播。
 */
export interface DouyinPartitionRef {
  cid: string;
  pid?: string;
}

export interface CrossCategorySiteRef {
  cid: string;
  pid?: string;
  groupId?: string;
}

export interface CrossCategoryEntry {
  key: string;
  name: string;
  aliases: string[];
  /** game=具体游戏；group=网游/手游/单机/娱乐等大类 */
  kind?: "game" | "group";
  /** 通用 per-site 映射（Wave 2 sync 写入；旧字段仍作 fallback） */
  sites?: Partial<Record<string, CrossCategorySiteRef>>;
  douyu?: string;
  huya?: string;
  douyin?: string;
  /** 抖音 partition_type，默认 1 */
  douyinPid?: string;
  /** 斗鱼 cate1，与 douyu(cate2) 区分避免 id 冲突 */
  douyuGroup?: string;
  /** 虎牙分类页 Tab id（bussType：1 网游 / 2 单机 / 3 手游 / 8 娱乐） */
  huyaTabId?: string;
  /** 虎牙大类聚合 gid（如 100023 网游竞技） */
  huyaGroup?: string;
  /** 抖音顶层分区组 id（如 1 射击、2 竞技 → 网游） */
  douyinGroupIds?: string[];
  /** 抖音大类：多个子分区取样 */
  douyinPartitions?: DouyinPartitionRef[];
}

export { CROSS_CATEGORIES } from "./cross-categories.data.js";

import { CROSS_CATEGORIES } from "./cross-categories.data.js";

function norm(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isGroupEntry(entry: CrossCategoryEntry): boolean {
  return entry.kind === "group";
}

function siteRefFor(entry: CrossCategoryEntry, site: string): CrossCategorySiteRef | undefined {
  return entry.sites?.[site];
}

function gameCidForSite(entry: CrossCategoryEntry, site: string): string | undefined {
  const ref = siteRefFor(entry, site);
  if (ref?.cid) return ref.cid;
  if (site === "douyu") return entry.douyu;
  if (site === "huya") return entry.huya;
  if (site === "douyin") return entry.douyin;
  return undefined;
}

function groupCidForSite(entry: CrossCategoryEntry, site: string): string | undefined {
  const ref = siteRefFor(entry, site);
  if (ref?.groupId) return ref.groupId;
  if (site === "douyu") return entry.douyuGroup;
  if (site === "huya") return entry.huyaGroup;
  return undefined;
}

export function crossGameCidForSite(entry: CrossCategoryEntry, site: string): string | undefined {
  return gameCidForSite(entry, site);
}

export function crossGroupCidForSite(entry: CrossCategoryEntry, site: string): string | undefined {
  return groupCidForSite(entry, site);
}

export function douyinPidForEntry(entry: CrossCategoryEntry): string {
  const pid = entry.sites?.douyin?.pid ?? entry.douyinPid;
  return String(pid || "1");
}

export function findCrossCategory(
  site: string,
  categoryName?: string | null,
  cid?: string | null,
): CrossCategoryEntry | null {
  const cidText = String(cid || "").trim();
  if (cidText) {
    for (const entry of CROSS_CATEGORIES) {
      if (isGroupEntry(entry)) continue;
      const mapped = gameCidForSite(entry, site);
      if (mapped && mapped === cidText) return entry;
    }
    for (const entry of CROSS_CATEGORIES) {
      if (!isGroupEntry(entry)) continue;
      const groupCid = groupCidForSite(entry, site);
      if (groupCid && groupCid === cidText) return entry;
      if (site === "huya" && entry.huyaTabId && entry.huyaTabId === cidText) return entry;
      if (site === "douyin") {
        if (entry.douyinGroupIds?.some((id) => id === cidText)) return entry;
        const hit = entry.douyinPartitions?.some((part) => part.cid === cidText);
        if (hit) return entry;
      }
    }
  }

  const name = norm(categoryName || "");
  if (!name) return null;

  for (const entry of CROSS_CATEGORIES) {
    if (norm(entry.name) === name) return entry;
    for (const alias of entry.aliases) {
      const a = norm(alias);
      if (a && (name === a || name.includes(a) || a.includes(name))) return entry;
    }
  }
  return null;
}

export function crossCategoryMapPayload(): { categories: CrossCategoryEntry[] } {
  return { categories: CROSS_CATEGORIES };
}

export function isGroupCategoryEntry(entry: CrossCategoryEntry | null | undefined): boolean {
  return Boolean(entry && isGroupEntry(entry));
}
