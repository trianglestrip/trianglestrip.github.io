import { formatOnline } from "../utils/format-online.js";
import type { CategoryGroup, RoomItem, RoomsPayload } from "./douyu.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://live.bilibili.com/",
};

/** B 站 parent_area_id：网游 2 / 手游 3 / 单机 6 / 娱乐 1 */
const BILIBILI_PARENT_GROUPS = [
  { id: "2", name: "网游" },
  { id: "3", name: "手游" },
  { id: "6", name: "单机" },
  { id: "1", name: "娱乐" },
] as const;

interface BilibiliAreaParent {
  id: number | string;
  name: string;
  list?: Array<{
    id: number | string;
    name: string;
    parent_id?: number | string;
    pic?: string;
  }>;
}

interface BilibiliRoomRecord {
  roomid?: number | string;
  title?: string;
  uname?: string;
  online?: number | string;
  live_status?: number;
  area_id?: number | string;
  area_name?: string;
  parent_area_name?: string;
  cover?: string;
  user_cover?: string;
  keyframe?: string;
}

let categoryCache: CategoryGroup[] | null = null;

export function clearBilibiliCategoryCache(): void {
  categoryCache = null;
}

async function fetchJson<T>(url: string, params?: Record<string, string | number>): Promise<T> {
  const u = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      u.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(u, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as { code?: number; message?: string; data?: T };
  if (Number(json.code ?? 0) !== 0) {
    throw new Error(json.message || `B 站 API 错误 ${json.code ?? "unknown"}`);
  }
  return json.data as T;
}

function normalizeCover(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("//")) return `https:${text}`;
  return text;
}

function normalizeRoom(item: BilibiliRoomRecord, defaultLive = false): RoomItem {
  const cover = normalizeCover(String(item.user_cover || item.cover || item.keyframe || ""));
  const live =
    item.live_status != null ? Number(item.live_status) === 1 : defaultLive;
  return {
    roomId: String(item.roomid || ""),
    siteId: "bilibili",
    status: live,
    title: String(item.title || ""),
    nickname: String(item.uname || ""),
    cid: String(item.area_id || ""),
    category: String(item.area_name || item.parent_area_name || ""),
    online: formatOnline(item.online as number | string),
    cover,
  };
}

function roomListFromPayload(data: unknown): BilibiliRoomRecord[] {
  if (Array.isArray(data)) return data as BilibiliRoomRecord[];
  const record = data as { list?: BilibiliRoomRecord[] };
  return record.list || [];
}

function buildCategoryGroups(parents: BilibiliAreaParent[]): CategoryGroup[] {
  const parentById = new Map(parents.map((item) => [String(item.id), item]));
  return BILIBILI_PARENT_GROUPS.map((group) => {
    const parent = parentById.get(group.id);
    const list = (parent?.list || []).map((item) => ({
      cid: Number(item.id),
      name: String(item.name || ""),
      pic: normalizeCover(String(item.pic || "")),
      pid: group.id,
    }));
    return { id: group.id, name: group.name, list };
  }).filter((group) => group.list.length > 0);
}

export async function fetchBilibiliCategories(): Promise<CategoryGroup[]> {
  if (categoryCache) return categoryCache;
  const parents = await fetchJson<BilibiliAreaParent[]>("https://api.live.bilibili.com/room/v1/Area/getList");
  categoryCache = buildCategoryGroups(parents);
  return categoryCache;
}

export async function fetchBilibiliCategoryRooms(
  cid: string,
  page: number,
  pid?: string,
  pageSize = 30,
): Promise<RoomsPayload> {
  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  if (pid) params.parent_area_id = pid;
  if (cid) params.area_id = cid;

  const data = await fetchJson<unknown>("https://api.live.bilibili.com/room/v1/Area/getRoomList", params);
  const items = roomListFromPayload(data);
  const list = items.map((item) => normalizeRoom(item, true)).filter((room) => room.roomId);
  return {
    list,
    hasMore: list.length >= pageSize,
    page,
    cid: String(cid),
  };
}

export async function fetchBilibiliRecommendRooms(page: number, pageSize = 30): Promise<RoomsPayload> {
  try {
    const data = await fetchJson<unknown>("https://api.live.bilibili.com/xlive/web-interface/v1/second/getList", {
      platform: "web",
      page,
      page_size: pageSize,
    });
    const items = roomListFromPayload(data);
    if (items.length) {
      const list = items.map((item) => normalizeRoom(item, true)).filter((room) => room.roomId);
      return { list, hasMore: list.length >= pageSize, page };
    }
  } catch {
    /* fallback */
  }

  const fallback = await fetchJson<{ list?: BilibiliRoomRecord[] }>(
    "https://api.live.bilibili.com/room/v1/Room/get_user_recommend",
    { page, page_size: pageSize },
  );
  const list = (fallback.list || []).map((item) => normalizeRoom(item, true)).filter((room) => room.roomId);
  return {
    list,
    hasMore: list.length >= pageSize,
    page,
  };
}

export async function fetchBilibiliGroupRooms(
  groupId: string,
  page: number,
  limit = 120,
): Promise<RoomsPayload> {
  const payload = await fetchBilibiliCategoryRooms("", page, groupId, Math.min(limit, 120));
  return {
    ...payload,
    list: payload.list.slice(0, limit),
    hasMore: payload.hasMore || payload.list.length >= limit,
  };
}
