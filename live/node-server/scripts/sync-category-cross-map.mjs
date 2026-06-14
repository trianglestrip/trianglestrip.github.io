/**
 * 从斗鱼 / 虎牙 / 抖音分类 API 同步跨平台映射
 * 用法: npx tsx scripts/sync-category-cross-map.mjs
 * 映射说明文档: docs/cross-category-map.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBilibiliCategories } from "../src/browse/bilibili.ts";
import { fetchDouyuCategories } from "../src/browse/douyu.ts";
import { fetchHuyaCategories } from "../src/browse/huya.ts";
import { fetchDouyinGameCategories } from "../src/browse/douyin.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_TS = path.join(__dirname, "../src/browse/cross-categories.data.ts");
const OUT_FALLBACK_JS = path.join(__dirname, "../../web/src/utils/categoryDisplay.js");

/** 名称不一致或需额外别名的手工条目（优先于自动匹配） */
const MANUAL = [
  {
    key: "lol",
    name: "英雄联盟",
    aliases: ["英雄联盟", "lol", "league of legends", "英雄联盟赛事"],
    douyu: "1",
    huya: "1",
    douyin: "1010014",
    douyinPid: "1",
  },
  {
    key: "cs2",
    name: "CS2",
    aliases: ["cs2", "csgo", "反恐精英", "counter-strike", "cs:go"],
    douyu: "6",
    huya: "862",
    douyin: "1010003",
    douyinPid: "1",
  },
  {
    key: "wzry",
    name: "王者荣耀",
    aliases: ["王者荣耀", "王者"],
    douyu: "181",
    huya: "2336",
    douyin: "1010045",
    douyinPid: "1",
  },
  {
    key: "hpjy",
    name: "和平精英",
    aliases: ["和平精英", "绝地求生", "pubg", "吃鸡"],
    douyu: "270",
    huya: "3203",
    douyin: "1010032",
    douyinPid: "1",
  },
  {
    key: "valorant",
    name: "无畏契约",
    aliases: ["无畏契约", "valorant", "瓦罗兰特"],
    douyu: "5937",
    huya: "5937",
    douyin: "1010017",
    douyinPid: "1",
  },
  {
    key: "dota2",
    name: "DOTA2",
    aliases: ["dota2", "dota 2", "刀塔"],
    douyu: "7",
    huya: "7",
    douyin: "1010093",
    douyinPid: "1",
  },
  {
    key: "cf",
    name: "穿越火线",
    aliases: ["穿越火线", "cf"],
    douyu: "4",
    huya: "4",
    douyin: "1010037",
    douyinPid: "1",
  },
  {
    key: "dnf",
    name: "DNF",
    aliases: ["DNF", "dnf", "地下城与勇士"],
    sites: { bilibili: { cid: "78", pid: "2" } },
    douyu: "40",
    huya: "2",
    douyin: "1010092",
    douyinPid: "1",
  },
  {
    key: "hs",
    name: "炉石传说",
    aliases: ["炉石传说", "炉石"],
    douyu: "393",
    huya: "393",
    douyin: "1010397",
    douyinPid: "1",
  },
  {
    key: "tft",
    name: "云顶之弈",
    aliases: ["云顶之弈", "lol云顶之弈", "tft"],
    douyu: "917",
    huya: "5485",
    douyin: "1010005",
    douyinPid: "1",
  },
  {
    key: "sjz",
    name: "三角洲行动",
    aliases: ["三角洲行动", "三角洲"],
    sites: { bilibili: { cid: "878", pid: "2" } },
    douyu: "4133",
    huya: "9449",
    douyin: "1011032",
    douyinPid: "1",
  },
  {
    key: "jx3",
    name: "剑网3",
    aliases: ["剑网3", "剑网三"],
    sites: { bilibili: { cid: "82", pid: "2" } },
    douyu: "65",
    huya: "900",
    douyin: "1010249",
    douyinPid: "1",
  },
  {
    key: "yjwj",
    name: "永劫无间",
    aliases: ["永劫无间"],
    sites: { bilibili: { cid: "666", pid: "2" } },
    douyu: "1227",
    huya: "6219",
    douyin: "1010016",
    douyinPid: "1",
  },
  {
    key: "ys",
    name: "原神",
    aliases: ["原神"],
    sites: { bilibili: { cid: "321", pid: "3" } },
    douyu: "1223",
    huya: "5489",
    douyin: "1010039",
    douyinPid: "1",
  },
  {
    key: "bhxy",
    name: "崩坏：星穹铁道",
    aliases: ["崩坏：星穹铁道"],
    sites: { bilibili: { cid: "549", pid: "3" } },
    douyu: "3379",
    huya: "7349",
    douyin: "1010043",
    douyinPid: "1",
  },
  {
    key: "aqtw",
    name: "暗区突围",
    aliases: ["暗区突围"],
    sites: { bilibili: { cid: "502", pid: "3" } },
    douyu: "3133",
    huya: "7209",
    douyin: "1010018",
    douyinPid: "1",
  },
  {
    key: "dzpd",
    name: "蛋仔派对",
    aliases: ["蛋仔派对"],
    sites: { bilibili: { cid: "571", pid: "3" } },
    douyu: "3358",
    huya: "6909",
    douyin: "1010011",
    douyinPid: "1",
  },
  {
    key: "dwrg",
    name: "第五人格",
    aliases: ["第五人格"],
    sites: { bilibili: { cid: "163", pid: "3" } },
    douyu: "356",
    huya: "3115",
    douyin: "1010041",
    douyinPid: "1",
  },
  {
    key: "hmwk",
    name: "黑神话：悟空",
    aliases: ["黑神话：悟空"],
    sites: { bilibili: { cid: "804", pid: "6" } },
    douyu: "2075",
    huya: "6111",
    douyin: "1010358",
    douyinPid: "1",
  },
  {
    key: "jcc",
    name: "金铲铲之战",
    aliases: ["金铲铲之战"],
    sites: { bilibili: { cid: "514", pid: "3" } },
    douyu: "2556",
    huya: "7185",
    douyin: "1010055",
    douyinPid: "1",
  },
  {
    key: "jql",
    name: "绝区零",
    aliases: ["绝区零"],
    sites: { bilibili: { cid: "662", pid: "3" } },
    douyu: "3671",
    huya: "7711",
    douyin: "1010155",
    douyinPid: "1",
  },
  {
    key: "wudao",
    name: "舞蹈",
    aliases: ["舞蹈", "舞见", "才艺"],
    sites: { bilibili: { cid: "207", pid: "1" } },
    douyu: "175",
    huya: "3793",
    douyin: "105",
    douyinPid: "4",
  },
  {
    key: "huwai",
    name: "户外",
    aliases: ["户外", "运动", "生活", "旅游", "体育"],
    douyu: "124",
    huya: "2165",
    douyinPartitions: [
      { cid: "108", pid: "4" },
      { cid: "107", pid: "4" },
    ],
  },
  {
    key: "yanzhi",
    name: "颜值",
    aliases: ["颜值", "颜值（横屏）"],
    sites: { bilibili: { cid: "145", pid: "1" } },
    douyu: "201",
    huya: "2168",
  },
  {
    key: "xingxiu",
    name: "星秀",
    aliases: ["星秀"],
    douyu: "1008",
    huya: "1663",
  },
  {
    key: "host",
    name: "主机游戏",
    aliases: ["主机", "主机游戏", "switch", "ps5"],
    douyu: "19",
    huya: "100032",
  },
  {
    key: "yiqikan",
    name: "一起看",
    aliases: ["一起看"],
    douyu: "208",
    huya: "2135",
  },
];

/** 大类分组（网游 / 手游 / 单机 / 娱乐） */
const GROUP_MANUAL = [
  {
    key: "group-wangyou",
    kind: "group",
    name: "网游",
    aliases: ["网游", "网游竞技", "射击游戏", "竞技游戏"],
    douyuGroup: "1",
    huyaTabId: "1",
    huyaGroup: "100023",
    bilibiliParent: "2",
    douyinGroupIds: ["1", "2"],
  },
  {
    key: "group-shouyou",
    kind: "group",
    name: "手游",
    aliases: ["手游", "手游休闲", "角色扮演", "策略卡牌", "棋牌游戏"],
    douyuGroup: "9",
    huyaTabId: "3",
    huyaGroup: "100004",
    bilibiliParent: "3",
    douyinGroupIds: ["4", "6", "7"],
  },
  {
    key: "group-danji",
    kind: "group",
    name: "单机",
    aliases: ["单机", "单机热游", "单机游戏"],
    douyuGroup: "15",
    huyaTabId: "2",
    huyaGroup: "100002",
    bilibiliParent: "6",
    douyinGroupIds: ["3"],
  },
  {
    key: "group-yule",
    kind: "group",
    name: "娱乐",
    aliases: ["娱乐", "娱乐天地", "休闲益智", "吃喝玩乐"],
    douyuGroup: "2",
    huyaTabId: "8",
    huyaGroup: "100022",
    bilibiliParent: "1",
    douyinGroupIds: ["5"],
  },
];

function douyinPartKey(part) {
  return `${String(part.cid)}:${String(part.pid ?? "1")}`;
}

function collectDouyinKeys(entry) {
  const keys = [];
  if (entry.douyin) keys.push(`${String(entry.douyin)}:${String(entry.douyinPid ?? "1")}`);
  for (const part of entry.douyinPartitions || []) keys.push(douyinPartKey(part));
  return keys;
}

/** 为大类取样：跳过已被游戏占用的 cid，且跨大类不重复 */
function resolveDouyinPartitions(groupIds, douyinGroups, reserved, used, perGroup = 2, maxTotal = 6) {
  const partitions = [];
  for (const groupId of groupIds) {
    const group = douyinGroups.find((item) => String(item.id) === String(groupId));
    if (!group) continue;
    let taken = 0;
    for (const item of group.list || []) {
      if (taken >= perGroup || partitions.length >= maxTotal) break;
      const part = {
        cid: String(item.cid),
        pid: item.pid != null ? String(item.pid) : "1",
      };
      const key = douyinPartKey(part);
      if (reserved.has(key) || used.has(key)) continue;
      partitions.push(part);
      used.add(key);
      taken += 1;
    }
  }
  return partitions;
}

function filterEntryDouyinPartitions(entry, used) {
  if (!entry.douyinPartitions?.length) return entry;
  const kept = [];
  for (const part of entry.douyinPartitions) {
    const key = douyinPartKey(part);
    if (used.has(key)) continue;
    kept.push(part);
    used.add(key);
  }
  return { ...entry, douyinPartitions: kept.length ? kept : undefined };
}

function buildGroupEntries(douyinGroups, reservedDouyin, usedDouyinParts) {
  return GROUP_MANUAL.map((entry) => ({
    ...entry,
    douyinPartitions: resolveDouyinPartitions(
      entry.douyinGroupIds,
      douyinGroups,
      reservedDouyin,
      usedDouyinParts,
    ),
    ...(entry.bilibiliParent
      ? { sites: { bilibili: { groupId: String(entry.bilibiliParent) } } }
      : {}),
  }));
}

function validateUniqueSiteRefs(entries) {
  const issues = [];
  const gameSites = ["douyu", "huya", "douyin", "bilibili"];

  for (const site of gameSites) {
    const cidMap = new Map();
    for (const e of entries) {
      if (e.kind === "group") continue;
      let cid;
      let pid;
      if (site === "bilibili") {
        cid = e.sites?.bilibili?.cid;
        pid = e.sites?.bilibili?.pid;
      } else if (site === "douyu") cid = e.douyu;
      else if (site === "huya") cid = e.huya;
      else if (site === "douyin") {
        cid = e.douyin;
        pid = e.douyinPid ?? "1";
      }
      if (!cid) continue;
      const k =
        site === "bilibili"
          ? `${pid}:${cid}`
          : site === "douyin"
            ? `${cid}:${pid}`
            : String(cid);
      if (cidMap.has(k)) {
        issues.push({ type: "dup_game_cid", site, cid: k, keys: [cidMap.get(k), e.key] });
      } else cidMap.set(k, e.key);
    }
  }

  const dyUsed = new Map();
  for (const e of entries) {
    for (const part of e.douyinPartitions || []) {
      const k = douyinPartKey(part);
      if (dyUsed.has(k)) {
        issues.push({ type: "dup_douyin_part", cid: k, keys: [dyUsed.get(k), e.key] });
      } else dyUsed.set(k, e.key);
    }
    if (e.douyin) {
      const k = `${String(e.douyin)}:${String(e.douyinPid ?? "1")}`;
      if (dyUsed.has(k)) {
        issues.push({ type: "douyin_cid_vs_part", cid: k, keys: [dyUsed.get(k), e.key] });
      } else dyUsed.set(k, e.key);
    }
  }

  const aliasMap = new Map();
  for (const e of entries) {
    for (const a of e.aliases || []) {
      const n = String(a || "").trim().toLowerCase().replace(/\s+/g, "");
      if (!n) continue;
      if (aliasMap.has(n) && aliasMap.get(n) !== e.key) {
        issues.push({ type: "dup_alias", alias: a, keys: [aliasMap.get(n), e.key] });
      } else aliasMap.set(n, e.key);
    }
  }

  return issues;
}

function flatCategories(groups) {
  const map = new Map();
  for (const group of groups) {
    for (const item of group.list || []) {
      map.set(item.name, {
        cid: String(item.cid),
        pid: item.pid != null ? String(item.pid) : undefined,
      });
    }
  }
  return map;
}

function platformCount(entry) {
  return [entry.douyu, entry.huya, entry.douyin, entry.sites?.bilibili?.cid].filter(Boolean).length;
}

function manualCovered(name, douyu, huya, douyin, bilibili, manualEntries) {
  for (const entry of manualEntries) {
    if (entry.name === name) return true;
    if (douyu && entry.douyu === douyu) return true;
    if (huya && entry.huya === huya) return true;
    if (douyin && entry.douyin === douyin) return true;
    if (bilibili && entry.sites?.bilibili?.cid === bilibili) return true;
  }
  return false;
}

function makeKey(name, ids, used) {
  const compact = name.replace(/[^\w\u4e00-\u9fff]+/g, "").toLowerCase();
  const ascii = compact.replace(/[^\x00-\x7f]/g, "");
  const candidates = [
    ascii.slice(0, 24),
    `g${ids.filter(Boolean).join("_")}`,
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let i = 2;
  while (used.has(`${ascii}${i}`)) i += 1;
  const key = `${ascii || "cat"}${i}`;
  used.add(key);
  return key;
}

function escapeString(value) {
  return JSON.stringify(value);
}

function formatSitesBlock(entry) {
  const sites = entry.sites;
  if (!sites || !Object.keys(sites).length) return "";
  const parts = Object.entries(sites).map(([site, ref]) => {
    const fields = [];
    if (ref.cid) fields.push(`cid: ${escapeString(ref.cid)}`);
    if (ref.pid) fields.push(`pid: ${escapeString(ref.pid)}`);
    if (ref.groupId) fields.push(`groupId: ${escapeString(ref.groupId)}`);
    return `      ${site}: { ${fields.join(", ")} }`;
  });
  return `    sites: {\n${parts.join(",\n")}\n    },\n`;
}

function formatSiteFields(entry) {
  const lines = [];
  if (entry.kind) lines.push(`    kind: ${escapeString(entry.kind)},`);
  lines.push(formatSitesBlock(entry));
  if (entry.douyu) lines.push(`    douyu: ${escapeString(entry.douyu)},`);
  if (entry.huya) lines.push(`    huya: ${escapeString(entry.huya)},`);
  if (entry.douyin) lines.push(`    douyin: ${escapeString(entry.douyin)},`);
  if (entry.douyinPid && entry.douyin) lines.push(`    douyinPid: ${escapeString(entry.douyinPid)},`);
  if (entry.douyuGroup) lines.push(`    douyuGroup: ${escapeString(entry.douyuGroup)},`);
  if (entry.huyaTabId) lines.push(`    huyaTabId: ${escapeString(entry.huyaTabId)},`);
  if (entry.huyaGroup) lines.push(`    huyaGroup: ${escapeString(entry.huyaGroup)},`);
  if (entry.douyinGroupIds?.length) {
    lines.push(`    douyinGroupIds: [${entry.douyinGroupIds.map((id) => escapeString(id)).join(", ")}],`);
  }
  if (entry.douyinPartitions?.length) {
    lines.push(
      `    douyinPartitions: [${entry.douyinPartitions
        .map(
          (part) =>
            `{ cid: ${escapeString(part.cid)}${part.pid ? `, pid: ${escapeString(part.pid)}` : ""} }`,
        )
        .join(", ")}],`,
    );
  }
  return lines.join("\n");
}

function formatEntry(entry) {
  const aliases = entry.aliases?.length ? entry.aliases : [entry.name];
  return `  {
    key: ${escapeString(entry.key)},
    name: ${escapeString(entry.name)},
    aliases: [${aliases.map((a) => escapeString(a)).join(", ")}],
${formatSiteFields(entry)}
  }`;
}

function formatEntryJs(entry) {
  const aliases = entry.aliases?.length ? entry.aliases : [entry.name];
  const parts = [
    `key: ${escapeString(entry.key)}`,
    `name: ${escapeString(entry.name)}`,
    `aliases: [${aliases.map((a) => escapeString(a)).join(", ")}]`,
  ];
  if (entry.kind) parts.push(`kind: ${escapeString(entry.kind)}`);
  if (entry.sites && Object.keys(entry.sites).length) {
    const siteParts = Object.entries(entry.sites).map(([site, ref]) => {
      const fields = [];
      if (ref.cid) fields.push(`cid: ${escapeString(ref.cid)}`);
      if (ref.pid) fields.push(`pid: ${escapeString(ref.pid)}`);
      if (ref.groupId) fields.push(`groupId: ${escapeString(ref.groupId)}`);
      return `${site}: { ${fields.join(", ")} }`;
    });
    parts.push(`sites: { ${siteParts.join(", ")} }`);
  }
  if (entry.douyu) parts.push(`douyu: ${escapeString(entry.douyu)}`);
  if (entry.huya) parts.push(`huya: ${escapeString(entry.huya)}`);
  if (entry.douyin) parts.push(`douyin: ${escapeString(entry.douyin)}`);
  if (entry.douyinPid && entry.douyin) parts.push(`douyinPid: ${escapeString(entry.douyinPid)}`);
  if (entry.douyuGroup) parts.push(`douyuGroup: ${escapeString(entry.douyuGroup)}`);
  if (entry.huyaTabId) parts.push(`huyaTabId: ${escapeString(entry.huyaTabId)}`);
  if (entry.huyaGroup) parts.push(`huyaGroup: ${escapeString(entry.huyaGroup)}`);
  if (entry.douyinGroupIds?.length) {
    parts.push(`douyinGroupIds: [${entry.douyinGroupIds.map((id) => escapeString(id)).join(", ")}]`);
  }
  if (entry.douyinPartitions?.length) {
    parts.push(
      `douyinPartitions: [${entry.douyinPartitions
        .map(
          (part) =>
            `{ cid: ${escapeString(part.cid)}${part.pid ? `, pid: ${escapeString(part.pid)}` : ""} }`,
        )
        .join(", ")}]`,
    );
  }
  return `  { ${parts.join(", ")} }`;
}

function buildFallbackJs(entries) {
  return `import { apiUrl } from "../config/app.js";

/** 与 node-server cross-categories.data.ts 同步；运行 npm run sync:cross-map 更新 */
const FALLBACK_CATEGORIES = [
${entries.map(formatEntryJs).join(",\n")},
];

let categories = FALLBACK_CATEGORIES;
let loadPromise = null;

/** 历史/自动生成的冗长 key → 当前简短 key（兼容旧链接与本地缓存） */
const CROSS_KEY_ALIASES = {
  g4133_9449_1011032_878: "sjz",
  g4133_9449_1011032: "sjz",
  "3": "jx3",
  g1227_6219_1010016_666: "yjwj",
  g1227_6219_1010016: "yjwj",
  g1223_5489_1010039_321: "ys",
  g1223_5489_1010039: "ys",
  g3379_7349_1010043_549: "bhxy",
  g3379_7349_1010043: "bhxy",
  g3133_7209_1010018_502: "aqtw",
  g3133_7209_1010018: "aqtw",
  g3358_6909_1010011_571: "dzpd",
  g3358_6909_1010011: "dzpd",
  g356_3115_1010041_163: "dwrg",
  g356_3115_1010041: "dwrg",
  g2075_6111_1010358_804: "hmwk",
  g2075_6111_1010358: "hmwk",
  g2556_7185_1010055_514: "jcc",
  g2556_7185_1010055: "jcc",
  g3671_7711_1010155_662: "jql",
  g3671_7711_1010155: "jql",
  g201_2168_145: "yanzhi",
};

function resolveCrossCategoryKey(key) {
  const text = String(key || "").trim();
  if (!text) return "";
  return CROSS_KEY_ALIASES[text] || text;
}

export { resolveCrossCategoryKey };

export function crossCategoryKeysEqual(a, b) {
  const left = resolveCrossCategoryKey(a);
  const right = resolveCrossCategoryKey(b);
  return Boolean(left && right && left === right);
}

/** 各平台 cid 不同，跨平台 key 对应斗鱼 cid 需手工校正 */
const CROSS_DOUYU_CID_PATCH = {
  dnf: "40",
};

export function findCrossCategoryByKey(key) {
  const text = resolveCrossCategoryKey(key);
  if (!text) return null;
  const entry =
    categories.find((e) => e.key === text) ||
    FALLBACK_CATEGORIES.find((e) => e.key === text) ||
    null;
  if (!entry) return null;
  const patchDouyu = CROSS_DOUYU_CID_PATCH[text];
  if (patchDouyu && entry.douyu !== patchDouyu) {
    return { ...entry, douyu: patchDouyu };
  }
  return entry;
}

export function douyuCidForCrossKey(key, fallback) {
  const entry = findCrossCategoryByKey(key);
  if (entry?.douyu) return String(entry.douyu);
  return String(fallback || "");
}

export function huyaCidForCrossKey(key, fallback) {
  const entry = findCrossCategoryByKey(key);
  if (entry?.huya) return String(entry.huya);
  return String(fallback || "");
}

function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, "");
}

function gameCidForSite(entry, site) {
  const ref = entry.sites?.[site];
  if (ref?.cid) return ref.cid;
  if (site === "douyu") return entry.douyu;
  if (site === "huya") return entry.huya;
  if (site === "douyin") return entry.douyin;
  return undefined;
}

function groupCidForSite(entry, site) {
  const ref = entry.sites?.[site];
  if (ref?.groupId) return ref.groupId;
  if (site === "douyu") return entry.douyuGroup;
  if (site === "huya") return entry.huyaGroup;
  return undefined;
}

export function findCrossCategory(site, categoryName, cid) {
  const siteId = String(site || "").trim();
  const cidText = String(cid || "").trim();
  if (cidText && siteId) {
    for (const entry of categories) {
      if (entry.kind === "group") continue;
      const mapped = gameCidForSite(entry, siteId);
      if (mapped && mapped === cidText) return entry;
      if (siteId === "douyin" && entry.douyinPartitions?.some((part) => part.cid === cidText)) {
        return entry;
      }
    }
    for (const entry of categories) {
      if (entry.kind !== "group") continue;
      const groupCid = groupCidForSite(entry, siteId);
      if (groupCid && groupCid === cidText) return entry;
      if (siteId === "huya" && entry.huyaTabId && entry.huyaTabId === cidText) return entry;
      if (siteId === "douyin") {
        if (entry.douyinGroupIds?.some((id) => id === cidText)) return entry;
        if (entry.douyinPartitions?.some((part) => part.cid === cidText)) return entry;
      }
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

export function displayCategoryGroupName(site, categoryName, cid) {
  const raw = String(categoryName || "").trim();
  if (!raw) return "";
  if (site === "douyin" || site === "douyu" || site === "huya" || site === "bilibili") return raw;
  return displayCategoryName(site, raw, cid);
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
`;
}

function enrichWithBilibili(entry, bilibiliMap) {
  if (entry.sites?.bilibili?.cid || entry.sites?.bilibili?.groupId) return entry;
  const hit = bilibiliMap.get(entry.name);
  if (!hit?.cid) return entry;
  return {
    ...entry,
    sites: {
      ...(entry.sites || {}),
      bilibili: { cid: hit.cid, ...(hit.pid ? { pid: hit.pid } : {}) },
    },
  };
}

const [douyuGroups, huyaGroups, douyinGroups, bilibiliGroups] = await Promise.all([
  fetchDouyuCategories(),
  fetchHuyaCategories(),
  fetchDouyinGameCategories(),
  fetchBilibiliCategories(),
]);
const douyuMap = flatCategories(douyuGroups);
const huyaMap = flatCategories(huyaGroups);
const douyinMap = flatCategories(douyinGroups);
const bilibiliMap = flatCategories(bilibiliGroups);

const usedKeys = new Set([...MANUAL, ...GROUP_MANUAL].map((entry) => entry.key));
const gameEntries = MANUAL.map((entry) => ({ ...entry }));

const allNames = new Set([
  ...douyuMap.keys(),
  ...huyaMap.keys(),
  ...douyinMap.keys(),
  ...bilibiliMap.keys(),
]);
for (const name of allNames) {
  const douyu = douyuMap.get(name)?.cid;
  const huya = huyaMap.get(name)?.cid;
  const douyinInfo = douyinMap.get(name);
  const douyin = douyinInfo?.cid;
  const douyinPid = douyinInfo?.pid || "1";
  const bilibiliInfo = bilibiliMap.get(name);
  const bilibili = bilibiliInfo?.cid;
  const bilibiliPid = bilibiliInfo?.pid;

  if (platformCount({ douyu, huya, douyin, sites: bilibili ? { bilibili: { cid: bilibili } } : undefined }) < 2) {
    continue;
  }
  if (manualCovered(name, douyu, huya, douyin, bilibili, MANUAL)) continue;

  const sites = bilibili
    ? { bilibili: { cid: bilibili, ...(bilibiliPid ? { pid: bilibiliPid } : {}) } }
    : undefined;

  gameEntries.push({
    key: makeKey(name, [douyu, huya, douyin, bilibili], usedKeys),
    name,
    aliases: [name],
    ...(sites ? { sites } : {}),
    ...(douyu ? { douyu } : {}),
    ...(huya ? { huya } : {}),
    ...(douyin ? { douyin, douyinPid } : {}),
  });
}

for (let i = 0; i < gameEntries.length; i += 1) {
  gameEntries[i] = enrichWithBilibili(gameEntries[i], bilibiliMap);
}

const reservedDouyin = new Set();
for (const entry of gameEntries) {
  for (const key of collectDouyinKeys(entry)) reservedDouyin.add(key);
}

const usedDouyinParts = new Set(reservedDouyin);
for (let i = 0; i < gameEntries.length; i += 1) {
  gameEntries[i] = filterEntryDouyinPartitions(gameEntries[i], usedDouyinParts);
}

const groupEntries = buildGroupEntries(douyinGroups, reservedDouyin, usedDouyinParts);
const entries = [...gameEntries, ...groupEntries];

entries.sort((a, b) => a.name.localeCompare(b.name, "zh"));

const refIssues = validateUniqueSiteRefs(entries);
if (refIssues.length) {
  console.error("分区重复校验失败:");
  for (const issue of refIssues) console.error(JSON.stringify(issue));
  process.exit(1);
}

const withDouyin = entries.filter((e) => e.douyin || e.douyinPartitions?.length).length;
const withBilibili = entries.filter((e) => e.sites?.bilibili?.cid || e.sites?.bilibili?.groupId).length;
const withFour = entries.filter(
  (e) =>
    (e.douyu || e.douyuGroup) &&
    (e.huya || e.huyaGroup) &&
    (e.douyin || e.douyinPartitions?.length) &&
    (e.sites?.bilibili?.cid || e.sites?.bilibili?.groupId),
).length;
const groupCount = entries.filter((e) => e.kind === "group").length;

const tsBody = `/** 自动生成：npm run sync:cross-map */
import type { CrossCategoryEntry } from "./category-cross-map.js";

export const CROSS_CATEGORIES: CrossCategoryEntry[] = [
${entries.map(formatEntry).join(",\n")}
];
`;

fs.writeFileSync(OUT_TS, tsBody, "utf8");
fs.writeFileSync(OUT_FALLBACK_JS, buildFallbackJs(entries), "utf8");

console.log(`同步完成: ${entries.length} 条映射（大类 ${groupCount}，含抖音 ${withDouyin} 条，含 B 站 ${withBilibili} 条，四平台 ${withFour} 条）`);
console.log(`  -> ${OUT_TS}`);
console.log(`  -> ${OUT_FALLBACK_JS}`);
