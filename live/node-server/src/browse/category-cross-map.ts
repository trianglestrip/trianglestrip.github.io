/**
 * 跨平台直播分类映射（统一名 → 各平台 cid/gid）
 * 用于侧栏「推荐」按当前房间分类拉取相关直播。
 */
export interface CrossCategoryEntry {
  key: string;
  name: string;
  aliases: string[];
  douyu?: string;
  huya?: string;
}

export const CROSS_CATEGORIES: CrossCategoryEntry[] = [
  {
    key: "lol",
    name: "英雄联盟",
    aliases: ["英雄联盟", "lol", "league of legends", "英雄联盟赛事"],
    douyu: "1",
    huya: "1",
  },
  {
    key: "cs2",
    name: "CS2",
    aliases: ["cs2", "csgo", "反恐精英", "counter-strike", "cs:go"],
    douyu: "6",
    huya: "862",
  },
  {
    key: "wzry",
    name: "王者荣耀",
    aliases: ["王者荣耀", "王者"],
    douyu: "181",
    huya: "2336",
  },
  {
    key: "hpjy",
    name: "和平精英",
    aliases: ["和平精英", "绝地求生", "pubg", "吃鸡"],
    douyu: "270",
    huya: "3203",
  },
  {
    key: "valorant",
    name: "无畏契约",
    aliases: ["无畏契约", "valorant", "瓦罗兰特"],
    douyu: "5937",
    huya: "5937",
  },
  {
    key: "dota2",
    name: "DOTA2",
    aliases: ["dota2", "dota 2", "刀塔"],
    douyu: "7",
    huya: "7",
  },
  {
    key: "cf",
    name: "穿越火线",
    aliases: ["穿越火线", "cf"],
    douyu: "4",
    huya: "4",
  },
  {
    key: "dnf",
    name: "地下城与勇士",
    aliases: ["地下城与勇士", "dnf"],
    douyu: "2",
    huya: "2",
  },
  {
    key: "hs",
    name: "炉石传说",
    aliases: ["炉石传说", "炉石"],
    douyu: "393",
    huya: "393",
  },
  {
    key: "tft",
    name: "云顶之弈",
    aliases: ["云顶之弈", "lol云顶之弈", "tft"],
    douyu: "5485",
    huya: "5485",
  },
  {
    key: "xingxiu",
    name: "星秀",
    aliases: ["星秀", "颜值", "娱乐"],
    douyu: "1008",
    huya: "897",
  },
  {
    key: "host",
    name: "主机游戏",
    aliases: ["主机", "主机游戏", "单机", "switch", "ps5"],
    douyu: "1282",
    huya: "1964",
  },
];

function norm(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function cidForSite(entry: CrossCategoryEntry, site: string): string | undefined {
  if (site === "douyu") return entry.douyu;
  if (site === "huya") return entry.huya;
  return undefined;
}

export function findCrossCategory(
  site: string,
  categoryName?: string | null,
  cid?: string | null,
): CrossCategoryEntry | null {
  const cidText = String(cid || "").trim();
  if (cidText) {
    for (const entry of CROSS_CATEGORIES) {
      const mapped = cidForSite(entry, site);
      if (mapped && mapped === cidText) return entry;
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
