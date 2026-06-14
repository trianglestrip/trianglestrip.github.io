import { formatOnline } from "../utils/format-online.js";
import type { CategoryGroup, RoomItem, RoomsPayload } from "./douyu.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.huya.com/",
};

const HUYA_GAME_PIC = "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg";
const HUYA_GAME_LIST_URL = "https://mp.huya.com/cache.php?m=Game&do=gameList&game_type=1";

/** bussType → 与虎牙官网 / Lemon 分类 Tab 一致 */
const HUYA_BUSS_GROUPS = [
  { id: "1", name: "网游", bussType: 1 },
  { id: "3", name: "手游", bussType: 3 },
  { id: "8", name: "娱乐", bussType: 8 },
  { id: "2", name: "单机", bussType: 2 },
] as const;

/** HTML 兜底：虎牙官网分类页 */
const HUYA_CATEGORY_PAGES = HUYA_BUSS_GROUPS.map((group) => ({
  id: group.id,
  name: group.name,
  url: `https://www.huya.com/g_${group.id === "1" ? "ol" : group.id === "2" ? "pc" : group.id === "3" ? "sy" : "yl"}`,
}));

/** 拉取失败时的兜底热门分区 */
const HUYA_FALLBACK_GROUPS: Array<{ id: string; name: string; list: Array<{ cid: number; name: string }> }> = [
  {
    id: "1",
    name: "热门",
    list: [
      { cid: 1, name: "英雄联盟" },
      { cid: 862, name: "CS2" },
      { cid: 2336, name: "王者荣耀" },
      { cid: 3203, name: "和平精英" },
      { cid: 5937, name: "无畏契约" },
      { cid: 5485, name: "lol云顶之弈" },
      { cid: 4, name: "穿越火线" },
      { cid: 393, name: "炉石传说" },
      { cid: 7, name: "DOTA2" },
      { cid: 2, name: "地下城与勇士" },
      { cid: 802, name: "坦克世界" },
      { cid: 1663, name: "星秀" },
      { cid: 2135, name: "一起看" },
    ],
  },
];

interface HuyaGameRecord {
  gid: number;
  gameFullName: string;
  bussType: number;
  isHide?: number;
}

let categoryCache: CategoryGroup[] | null = null;

function huyaPic(cid: number | string): string {
  return HUYA_GAME_PIC.replace("{cid}", String(cid));
}

function buildGroups(
  source: Array<{ id: string; name: string; list: Array<{ cid: number; name: string }> }>,
): CategoryGroup[] {
  return source.map((group) => ({
    id: group.id,
    name: group.name,
    list: group.list.map((item) => ({
      cid: item.cid,
      name: item.name,
      pic: huyaPic(item.cid),
    })),
  }));
}

function groupGamesByBussType(games: HuyaGameRecord[]): CategoryGroup[] {
  const buckets = new Map<number, Array<{ cid: number; name: string }>>();
  for (const game of games) {
    if (game.isHide) continue;
    const cid = Number(game.gid);
    const name = String(game.gameFullName || "").trim();
    if (!cid || !name) continue;
    const list = buckets.get(game.bussType) ?? [];
    list.push({ cid, name });
    buckets.set(game.bussType, list);
  }

  return HUYA_BUSS_GROUPS.map((group) => ({
    id: group.id,
    name: group.name,
    list: (buckets.get(group.bussType) ?? []).map((item) => ({
      cid: item.cid,
      name: item.name,
      pic: huyaPic(item.cid),
    })),
  })).filter((group) => group.list.length > 0);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchHuyaCategoriesFromApi(): Promise<CategoryGroup[]> {
  const payload = await fetchJson<{ status?: number; data?: HuyaGameRecord[] }>(HUYA_GAME_LIST_URL);
  const games = payload.data ?? [];
  if (payload.status !== 200 || games.length === 0) {
    throw new Error("empty game list");
  }
  const groups = groupGamesByBussType(games);
  if (groups.length === 0) {
    throw new Error("no category groups");
  }
  return groups;
}

function parseHuyaGameList(html: string): Array<{ cid: number; name: string }> {
  const re = /data-gid="(\d+)" title=([^>]+)/g;
  const items: Array<{ cid: number; name: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    items.push({
      cid: Number(match[1]),
      name: match[2].trim().replace(/^"|"$/g, ""),
    });
  }
  return items;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchHuyaCategoriesFromHtml(): Promise<CategoryGroup[]> {
  const pages = await Promise.all(
    HUYA_CATEGORY_PAGES.map(async (page) => {
      const html = await fetchHtml(page.url);
      return { id: page.id, name: page.name, list: parseHuyaGameList(html) };
    }),
  );
  return buildGroups(pages.filter((page) => page.list.length > 0));
}

async function getJson<T>(url: string, params?: Record<string, string | number>): Promise<T> {
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function normalizeHuyaRoom(item: Record<string, unknown>): RoomItem {
  const roomId = item.lProfileRoom ?? item.lChannel ?? item.lUid;
  let cover = String(item.sScreenshot || item.sPreviewUrl || "");
  if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return {
    roomId: String(roomId || ""),
    siteId: "huya",
    status: true,
    title: String(item.sIntroduction || item.sRoomName || ""),
    nickname: String(item.sNick || ""),
    cid: String(item.iGid ?? item.iGameId ?? ""),
    category: String(item.sGameFullName || ""),
    online: formatOnline((item.lTotalCount ?? item.lUserCount) as number | string),
    cover,
  };
}

export async function fetchHuyaCategories(): Promise<CategoryGroup[]> {
  if (categoryCache) {
    return categoryCache;
  }

  try {
    const groups = await fetchHuyaCategoriesFromApi();
    categoryCache = groups;
    return groups;
  } catch {
    /* 官方 JSON 不可用时降级 */
  }

  try {
    const groups = await fetchHuyaCategoriesFromHtml();
    if (groups.length > 0) {
      categoryCache = groups;
      return groups;
    }
  } catch {
    /* 使用兜底列表 */
  }

  return buildGroups(HUYA_FALLBACK_GROUPS);
}

export async function fetchHuyaLiveList(gid: number | string, page: number, pageSize = 120): Promise<RoomsPayload> {
  const data = await getJson<Record<string, unknown>>("https://live.huya.com/liveHttpUI/getLiveList", {
    iGid: gid,
    iPageNo: page,
    iPageSize: pageSize,
  });
  const items = (data.vList as Array<Record<string, unknown>>) || [];
  const totalPage = Number(data.iTotalPage || 1);
  const list = items
    .map((item) => normalizeHuyaRoom(item))
    .filter((room) => room.roomId);
  return {
    list,
    hasMore: page < totalPage,
    page,
  };
}
