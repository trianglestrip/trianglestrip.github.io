import { formatOnline } from "../utils/format-online.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DOUYU_HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/",
};

let cate2NameCache: Record<string, string> | null = null;

async function getJson<T>(url: string, params?: Record<string, string | number>): Promise<T> {
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u, { headers: DOUYU_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface CategoryItem {
  cid: number;
  name: string;
  pic: string;
  pid?: number | string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  list: CategoryItem[];
}

export interface RoomItem {
  roomId: string;
  siteId: string;
  status: boolean;
  title: string;
  nickname: string;
  cid: string;
  category: string;
  online: string;
  cover: string;
}

export interface RoomsPayload {
  list: RoomItem[];
  hasMore: boolean;
  page: number;
  cid?: string;
}

async function fetchDouyuCategories(): Promise<CategoryGroup[]> {
  const data = await getJson<{ data?: Record<string, unknown> }>("https://m.douyu.com/api/cate/list");
  const payload = (data.data || {}) as Record<string, unknown>;
  const cate1 = Object.fromEntries(
    ((payload.cate1Info as Array<Record<string, unknown>>) || []).map((item) => [
      item.cate1Id,
      item.cate1Name,
    ]),
  ) as Record<number, string>;
  const grouped = new Map<number, CategoryGroup>();
  for (const item of (payload.cate2Info as Array<Record<string, unknown>>) || []) {
    const cate1Id = Number(item.cate1Id);
    let group = grouped.get(cate1Id);
    if (!group) {
      group = {
        id: String(cate1Id),
        name: cate1[cate1Id] || "分类",
        list: [],
      };
      grouped.set(cate1Id, group);
    }
    group.list.push({
      cid: Number(item.cate2Id),
      name: String(item.cate2Name || ""),
      pic: String(item.pic || item.icon || ""),
    });
  }
  return [...grouped.values()].filter((g) => g.list.length > 0);
}

async function douyuCate2Names(): Promise<Record<string, string>> {
  if (!cate2NameCache) {
    const mapping: Record<string, string> = {};
    for (const group of await fetchDouyuCategories()) {
      for (const item of group.list) {
        mapping[String(item.cid)] = item.name;
      }
    }
    cate2NameCache = mapping;
  }
  return cate2NameCache;
}

function douyuOnline(item: Record<string, unknown>): string {
  const hn = item.hn;
  if (hn) {
    const text = String(hn).trim();
    if (text) {
      return text;
    }
  }
  return formatOnline((item.online ?? item.viewerCount) as number | string);
}

async function douyuCategory(item: Record<string, unknown>): Promise<string> {
  const name = item.cate2Name || item.gameName || item.cate3Name;
  if (name) {
    return String(name);
  }
  const cid = item.cate2Id ?? item.cate1Id;
  if (cid != null) {
    const names = await douyuCate2Names();
    return names[String(cid)] || "";
  }
  return "";
}

function normalizeDouyuRoom(item: Record<string, unknown>): RoomItem {
  return {
    roomId: String(item.rid || ""),
    siteId: "douyu",
    status: Boolean(item.isLive ?? item.showStatus ?? 1),
    title: String(item.roomName || ""),
    nickname: String(item.nickname || item.ownerName || ""),
    cid: String(item.cate2Id || item.cate1Id || ""),
    category: "",
    online: douyuOnline(item),
    cover: String(item.roomSrc || item.verticalSrc || ""),
  };
}

function normalizeDouyuMixRoom(item: Record<string, unknown>, targetCid?: string): RoomItem | null {
  const cid2 = String(item.cid2 ?? "");
  if (targetCid && cid2 && cid2 !== targetCid) return null;
  const roomId = String(item.rid || "");
  if (!roomId) return null;
  let cover = String(item.rs16 || item.rs1 || "");
  if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return {
    roomId,
    siteId: "douyu",
    status: true,
    title: String(item.rn || ""),
    nickname: String(item.nn || ""),
    cid: cid2,
    category: String(item.c2name || item.c2name_display || ""),
    online: formatOnline((item.ol ?? item.online) as number | string),
    cover,
  };
}

async function fetchDouyuCategoryMixList(
  cid: string | number,
  page: number,
  limit = 30,
): Promise<RoomsPayload> {
  const cidText = String(cid);
  const data = await getJson<{ code?: number; data?: Record<string, unknown> }>(
    `https://www.douyu.com/gapi/rkc/directory/mixList/2_${cidText}/${page}`,
  );
  const items = (data.data?.rl as Array<Record<string, unknown>>) || [];
  const list: RoomItem[] = [];
  for (const item of items) {
    const room = normalizeDouyuMixRoom(item, cidText);
    if (!room) continue;
    list.push(room);
    if (list.length >= limit) break;
  }
  return {
    list,
    hasMore: items.length > 0 && list.length >= limit,
    page,
  };
}

export async function fetchDouyuGroupRooms(
  cate1Id: string | number,
  page: number,
  limit = 30,
): Promise<RoomsPayload> {
  const cidText = String(cate1Id);
  const data = await getJson<{ code?: number; data?: Record<string, unknown> }>(
    `https://www.douyu.com/gapi/rkc/directory/mixList/1_${cidText}/${page}`,
  );
  const items = (data.data?.rl as Array<Record<string, unknown>>) || [];
  const list: RoomItem[] = [];
  for (const item of items) {
    const room = normalizeDouyuMixRoom(item);
    if (!room) continue;
    list.push(room);
    if (list.length >= limit) break;
  }
  return {
    list,
    hasMore: items.length > 0 && list.length >= limit,
    page,
  };
}

async function enrichDouyuRoom(item: Record<string, unknown>): Promise<RoomItem> {
  const room = normalizeDouyuRoom(item);
  room.category = await douyuCategory(item);
  return room;
}

export async function fetchDouyuRooms(cid: string | number | null, page: number, limit = 30): Promise<RoomsPayload> {
  if (cid != null && String(cid) !== "" && String(cid) !== "0") {
    return fetchDouyuCategoryMixList(cid, page, limit);
  }
  const params: Record<string, string | number> = { page, limit };
  const data = await getJson<{ data?: Record<string, unknown> }>("https://m.douyu.com/api/room/list", params);
  const payload = (data.data || {}) as Record<string, unknown>;
  const items = (payload.list as Array<Record<string, unknown>>) || [];
  const pageCount = Number(payload.pageCount || 1);
  const nowPage = Number(payload.nowPage || page);
  let hasMore = payload.hasMore;
  if (hasMore == null) {
    hasMore = nowPage < pageCount;
  }
  const list: RoomItem[] = [];
  for (const item of items) {
    const room = await enrichDouyuRoom(item);
    if (room.roomId) {
      list.push(room);
    }
  }
  return {
    list,
    hasMore: Boolean(hasMore),
    page: nowPage,
  };
}

export { fetchDouyuCategories };
