import { abSign } from "../resolve/douyin/ab-sign.js";
import { formatPlainCount } from "../utils/format-online.js";
import { CROSS_CATEGORIES } from "./cross-categories.data.js";
import { DOUYIN_GAME_ICONS } from "./douyin-game-icons.data.js";
import { resolveGameIconFromWeb } from "./douyin-game-icon-resolver.js";
import type { CategoryGroup, CategoryItem, RoomItem, RoomsPayload } from "./douyu.js";
const PC_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  referer: "https://live.douyin.com/",
  "accept-language": "zh-CN,zh;q=0.9",
};

const PAGE_SIZE = 15;
/** 首页推荐默认分区：王者荣耀 */
const DEFAULT_GAME_PARTITION = "1010045";
const DEFAULT_PARTITION_TYPE = "1";

const FALLBACK_COOKIE =
  "ttwid=1%7CmDcInbJ7AJ-2PGtsgrG4xj7SOiNMzePqQBF1LMO2Qkg%7C1761107324%7Cbbf97c2cd9f8eae8e8c36db4ef50c323deaa4b161179170aaf659590867c162d";

const FALLBACK_GAME_GROUPS: CategoryGroup[] = [
  {
    id: "1",
    name: "射击游戏",
    list: [
      { cid: 1010032, name: "和平精英", pid: 1, pic: "" },
      { cid: 1010017, name: "无畏契约", pid: 1, pic: "" },
      { cid: 1010003, name: "CSGO", pid: 1, pic: "" },
      { cid: 1011032, name: "三角洲行动", pid: 1, pic: "" },
      { cid: 1010037, name: "穿越火线", pid: 1, pic: "" },
      { cid: 1010026, name: "绝地求生", pid: 1, pic: "" },
    ],
  },
  {
    id: "2",
    name: "竞技游戏",
    list: [
      { cid: 1010045, name: "王者荣耀", pid: 1, pic: "" },
      { cid: 1010014, name: "英雄联盟", pid: 1, pic: "" },
      { cid: 1010016, name: "永劫无间", pid: 1, pic: "" },
      { cid: 1010041, name: "第五人格", pid: 1, pic: "" },
      { cid: 1010055, name: "金铲铲之战", pid: 1, pic: "" },
    ],
  },
  {
    id: "3",
    name: "单机游戏",
    list: [
      { cid: 1010358, name: "黑神话：悟空", pid: 1, pic: "" },
      { cid: 1010250, name: "星际战甲", pid: 1, pic: "" },
    ],
  },
  {
    id: "4",
    name: "角色扮演",
    list: [
      { cid: 1010039, name: "原神", pid: 1, pic: "" },
      { cid: 1010053, name: "梦幻西游", pid: 1, pic: "" },
      { cid: 1010150, name: "魔兽世界", pid: 1, pic: "" },
    ],
  },
];

const SESSION_COOKIE_TTL_MS = 60_000;
const HUYA_GAME_PIC = "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg";
const HUYA_GAME_LIST_URL = "https://mp.huya.com/cache.php?m=Game&do=gameList&game_type=1";
const FUZZY_NAME_MIN_LEN = 4;

const GAME_TREE_MARKER = '\\"title\\":\\"游戏\\"},\\"sub_partition\\":';
const PARTITION_RE =
  /\{\\"partition\\":\{\\"id_str\\":\\"(\d+)\\",\\"type\\":(\d+),\\"title\\":\\"([^"\\]+)\\"\},\\"has_parent_node\\":true,\\"second_node\\":\{\\"id_str\\":\\"(\d+)\\",\\"type\\":(\d+),\\"title\\":\\"([^"\\]+)\\"\},\\"first_node\\":\{\\"id_str\\":\\"(\d+)\\",\\"type\\":(\d+),\\"title\\":\\"([^"\\]+)\\"\}/g;

interface SubPartitionNode {
  partition?: { id_str?: string; type?: number; title?: string };
  sub_partition?: SubPartitionNode[];
}

function randomHex(len: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function bootstrapCookie(): Promise<string> {
  const acNonce = randomHex(21);
  const seed = `__ac_nonce=${acNonce}; odin_tt=${randomHex(160)}`;
  try {
    const res = await fetch("https://live.douyin.com/", {
      headers: { ...PC_HEADERS, cookie: seed },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const parts = [`__ac_nonce=${acNonce}`];
    for (const item of res.headers.getSetCookie?.() || []) {
      const nameValue = item.split(";")[0]?.trim();
      if (nameValue) parts.push(nameValue);
    }
    if (parts.length) return parts.join("; ");
  } catch {
    /* ignore */
  }
  return `${seed}; ${FALLBACK_COOKIE}`;
}

let sessionCookie: string | null = null;
let sessionCookieAt = 0;
let categoryCache: CategoryGroup[] | null = null;

interface CategoryPicSources {
  byDouyinId: Map<string, string>;
  byName: Map<string, string>;
}

let categoryPicSources: CategoryPicSources | null = null;
const webIconByDouyinId = new Map<string, string>();
const WEB_ICON_CONCURRENCY = 3;
const WEB_ICON_BUDGET_MS = 25_000;
async function getSessionCookie(): Promise<string> {
  if (sessionCookie && Date.now() - sessionCookieAt < SESSION_COOKIE_TTL_MS) {
    return sessionCookie;
  }
  sessionCookie = await bootstrapCookie();
  sessionCookieAt = Date.now();
  return sessionCookie;
}

async function signedGet(
  path: string,
  params: Record<string, string>,
  cookie = "",
): Promise<Record<string, unknown>> {
  const activeCookie = cookie || (await getSessionCookie());
  const query = new URLSearchParams(params).toString();
  const api = `https://live.douyin.com${path}?${query}&a_bogus=${encodeURIComponent(abSign(query, PC_HEADERS["user-agent"]))}`;
  const res = await fetch(api, {
    headers: { ...PC_HEADERS, cookie: activeCookie },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!text || text.startsWith("<!DOCTYPE")) {
    throw new Error("抖音列表接口触发风控");
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function normCategoryName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[：:!！?？·]/g, "")
    .replace(/[\s\u3000]+/g, "");
}

function nameLookupKeys(name: string): string[] {
  const keys = new Set<string>();
  const normalized = normCategoryName(name);
  if (normalized) keys.add(normalized);

  const head = name.split(/[：:]/)[0]?.trim();
  if (head) keys.add(normCategoryName(head));

  const stripped = normalized
    .replace(/(手游|端游|怀旧服|国际服|国服|官方竞速版|集结|归来|起源|不朽|无限|重制版|官方版)$/u, "");
  if (stripped) keys.add(stripped);

  return [...keys].filter(Boolean);
}

function lookupCategoryPic(name: string, sources: CategoryPicSources): string {
  for (const key of nameLookupKeys(name)) {
    const pic = sources.byName.get(key);
    if (pic) return pic;
  }

  const normalized = normCategoryName(name);
  if (!normalized) return "";

  let best = "";
  let bestLen = 0;
  for (const [key, pic] of sources.byName) {
    let matchLen = 0;
    if (key.length >= FUZZY_NAME_MIN_LEN && normalized.includes(key)) {
      matchLen = key.length;
    } else if (normalized.length >= FUZZY_NAME_MIN_LEN && key.includes(normalized)) {
      matchLen = normalized.length;
    }
    if (matchLen > bestLen) {
      bestLen = matchLen;
      best = pic;
    }
  }
  return best;
}

function huyaGamePic(gid: string | number): string {
  return HUYA_GAME_PIC.replace("{cid}", String(gid));
}

function rememberPic(
  sources: CategoryPicSources,
  douyinId: string,
  pic: string,
  names: string[],
): void {
  const url = String(pic || "").trim();
  if (!url) return;
  if (douyinId) sources.byDouyinId.set(douyinId, url);
  for (const name of names) {
    const key = normCategoryName(name);
    if (key && !sources.byName.has(key)) sources.byName.set(key, url);
  }
}

async function loadCategoryPicSources(): Promise<CategoryPicSources> {
  if (categoryPicSources) return categoryPicSources;

  const sources: CategoryPicSources = {
    byDouyinId: new Map(),
    byName: new Map(),
  };
  const douyuPicByCid = new Map<string, string>();

  try {
    const res = await fetch("https://m.douyu.com/api/cate/list", {
      headers: {
        "User-Agent": PC_HEADERS["user-agent"],
        Referer: "https://www.douyu.com/",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: { cate2Info?: Array<Record<string, unknown>> };
      };
      for (const item of data.data?.cate2Info || []) {
        const pic = String(item.pic || item.icon || "").trim();
        const cid = String(item.cate2Id || "").trim();
        const name = String(item.cate2Name || "").trim();
        if (!pic) continue;
        if (cid) douyuPicByCid.set(cid, pic);
        const key = normCategoryName(name);
        if (key && !sources.byName.has(key)) sources.byName.set(key, pic);
      }
    }
  } catch {
    /* 斗鱼图标不可用时仅依赖虎牙 */
  }

  try {
    const res = await fetch(HUYA_GAME_LIST_URL, {
      headers: {
        "User-Agent": PC_HEADERS["user-agent"],
        Referer: "https://www.huya.com/",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ gid?: number; gameFullName?: string; isHide?: number }>;
      };
      for (const game of data.data || []) {
        if (game.isHide) continue;
        const name = String(game.gameFullName || "").trim();
        const gid = Number(game.gid);
        if (!name || !gid) continue;
        const key = normCategoryName(name);
        if (key && !sources.byName.has(key)) {
          sources.byName.set(key, huyaGamePic(gid));
        }
      }
    }
  } catch {
    /* 虎牙列表不可用时跳过 */
  }

  for (const entry of CROSS_CATEGORIES) {
    if (!entry.douyin) continue;
    const douyinId = String(entry.douyin);
    let pic = entry.douyu ? douyuPicByCid.get(String(entry.douyu)) || "" : "";
    if (!pic && entry.huya) pic = huyaGamePic(entry.huya);
    rememberPic(sources, douyinId, pic, [entry.name, ...(entry.aliases || [])]);
  }

  for (const entry of DOUYIN_GAME_ICONS) {
    rememberPic(sources, entry.douyin, entry.pic, [entry.name]);
  }

  categoryPicSources = sources;
  return sources;
}

function enrichCategoryPics(groups: CategoryGroup[], sources: CategoryPicSources): CategoryGroup[] {
  for (const group of groups) {
    for (const item of group.list) {
      const id = String(item.cid);
      item.pic = sources.byDouyinId.get(id) || lookupCategoryPic(item.name, sources) || "";
    }
  }
  return groups;
}

async function enrichWebIcons(groups: CategoryGroup[]): Promise<CategoryGroup[]> {
  const pending = groups.flatMap((group) => group.list).filter((item) => {
    const id = String(item.cid);
    if (item.pic) return false;
    const cached = webIconByDouyinId.get(id);
    if (cached) {
      item.pic = cached;
      return false;
    }
    return true;
  });
  if (!pending.length) return groups;

  let index = 0;
  async function worker(): Promise<void> {
    while (true) {
      const current = index;
      index += 1;
      if (current >= pending.length) return;
      const item = pending[current];
      const id = String(item.cid);
      const hit = await resolveGameIconFromWeb(item.name, 120);
      if (hit?.pic) {
        webIconByDouyinId.set(id, hit.pic);
        item.pic = hit.pic;
      }
    }
  }

  const workers = Math.min(WEB_ICON_CONCURRENCY, pending.length);
  const task = Promise.all(Array.from({ length: workers }, () => worker()));
  const budget = new Promise<void>((resolve) => {
    setTimeout(resolve, WEB_ICON_BUDGET_MS);
  });
  await Promise.race([task, budget]);
  return groups;
}

function httpsUrl(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("http://")) return `https://${text.slice(7)}`;
  return text;
}

function extractBalancedArray(html: string, start: number): string {
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return "";
}

function unescapeEmbeddedJson(text: string): string {
  return text.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseGameTreeFromHtml(html: string): CategoryGroup[] {
  const idx = html.indexOf(GAME_TREE_MARKER);
  if (idx < 0) return [];

  const arrayStart = idx + GAME_TREE_MARKER.length;
  const rawArray = extractBalancedArray(html, arrayStart);
  if (!rawArray) return [];

  try {
    const tree = JSON.parse(unescapeEmbeddedJson(rawArray)) as SubPartitionNode[];
    const groups: CategoryGroup[] = [];
    for (const node of tree) {
      const groupPart = node.partition;
      if (!groupPart?.id_str) continue;
      const list: CategoryItem[] = [];
      const seen = new Set<string>();
      for (const child of node.sub_partition || []) {
        const part = child.partition;
        const id = String(part?.id_str || "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push({
          cid: Number(id),
          name: part?.title || "",
          pic: "",
          pid: Number(part?.type || 1),
        });
      }
      if (list.length) {
        groups.push({
          id: groupPart.id_str,
          name: groupPart.title || "游戏",
          list,
        });
      }
    }
    return groups;
  } catch {
    return [];
  }
}

function parseGameCategoriesLegacy(html: string): CategoryGroup[] {
  const seen = new Map<string, CategoryItem & { groupId: string; groupTitle: string }>();
  for (const match of html.matchAll(PARTITION_RE)) {
    const rootTitle = match[9];
    if (rootTitle !== "游戏") continue;
    const id = match[1];
    if (seen.has(id)) continue;
    seen.set(id, {
      cid: Number(id),
      name: match[3],
      pic: "",
      pid: Number(match[2]) || 1,
      groupId: match[4],
      groupTitle: match[6],
    });
  }

  if (!seen.size) return [];

  const grouped = new Map<string, CategoryGroup>();
  for (const item of seen.values()) {
    let group = grouped.get(item.groupId);
    if (!group) {
      group = { id: item.groupId, name: item.groupTitle, list: [] };
      grouped.set(item.groupId, group);
    }
    group.list.push({
      cid: item.cid,
      name: item.name,
      pic: item.pic,
      pid: item.pid,
    });
  }
  return [...grouped.values()];
}

function parseGameCategoriesFromHtml(html: string): CategoryGroup[] {
  const tree = parseGameTreeFromHtml(html);
  if (tree.length) return tree;
  return parseGameCategoriesLegacy(html);
}

export async function fetchDouyinGameCategories(): Promise<CategoryGroup[]> {
  if (categoryCache) return categoryCache;

  let groups: CategoryGroup[] = FALLBACK_GAME_GROUPS;
  try {
    const res = await fetch("https://live.douyin.com/", {
      headers: PC_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`抖音首页 HTTP ${res.status}`);
    const html = await res.text();
    const parsed = parseGameCategoriesFromHtml(html);
    if (parsed.length) groups = parsed;
  } catch {
    /* fallback */
  }

  const picSources = await loadCategoryPicSources();
  groups = enrichCategoryPics(groups, picSources);
  categoryCache = await enrichWebIcons(groups);
  return categoryCache;
}
interface PartitionRoomEntry {
  web_rid?: string;
  room?: {
    id_str?: string;
    title?: string;
    user_count?: number;
    cover?: { url_list?: string[] };
    owner?: { nickname?: string; avatar_thumb?: { url_list?: string[] } };
    stats?: { user_count_str?: string; total_user_str?: string };
  };
}

function normalizePartitionRoom(
  entry: PartitionRoomEntry,
  partitionId: string,
  partitionName: string,
): RoomItem | null {
  const webRid = String(entry.web_rid || entry.room?.id_str || "").trim();
  const room = entry.room;
  if (!webRid || !room) return null;
  const online =
    room.stats?.user_count_str ||
    room.stats?.total_user_str ||
    room.user_count ||
    "";
  return {
    roomId: webRid,
    siteId: "douyin",
    status: true,
    title: room.title || "",
    nickname: room.owner?.nickname || "",
    cid: partitionId,
    category: partitionName,
    online: formatPlainCount(online),
    cover: httpsUrl(room.cover?.url_list?.[0] || ""),
  };
}

export async function fetchDouyinGameRooms(
  partitionId: string,
  page: number,
  partitionType = DEFAULT_PARTITION_TYPE,
  partitionName = "",
): Promise<RoomsPayload> {
  const partition = String(partitionId || DEFAULT_GAME_PARTITION).trim();
  const type = String(partitionType || DEFAULT_PARTITION_TYPE).trim();
  const offset = Math.max(0, (Math.max(1, page) - 1) * PAGE_SIZE);

  const json = await signedGet("/webcast/web/partition/detail/room/v2/", {
    aid: "6383",
    app_name: "douyin_web",
    live_id: "1",
    device_platform: "web",
    language: "zh-CN",
    enter_from: "web_homepage_hot",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "141.0.0.0",
    count: String(PAGE_SIZE),
    offset: String(offset),
    partition,
    partition_type: type,
    req_from: "2",
    msToken: "",
  });

  if (Number(json.status_code || 0) !== 0) {
    throw new Error("抖音游戏直播列表获取失败");
  }

  const wrapper = (json.data || {}) as {
    data?: PartitionRoomEntry[];
    has_more?: boolean;
    offset?: number;
  };
  const entries = wrapper.data || [];
  const list = entries
    .map((entry) => normalizePartitionRoom(entry, partition, partitionName))
    .filter((item): item is RoomItem => Boolean(item));

  const hasMore = Boolean(wrapper.has_more) || entries.length >= PAGE_SIZE;
  return {
    list,
    hasMore,
    page,
    cid: partition,
  };
}

export async function fetchDouyinRecommendRooms(page: number): Promise<RoomsPayload> {
  return fetchDouyinGameRooms(DEFAULT_GAME_PARTITION, page, DEFAULT_PARTITION_TYPE, "王者荣耀");
}
