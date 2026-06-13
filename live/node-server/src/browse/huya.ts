import { formatOnline } from "../utils/format-online.js";
import type { CategoryGroup, RoomItem, RoomsPayload } from "./douyu.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.huya.com/",
};

const HUYA_GAME_PIC = "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg";

const HUYA_CATEGORY_GROUPS: Array<{ id: string; name: string; list: Array<{ cid: number; name: string }> }> = [
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
      { cid: 897, name: "星秀" },
      { cid: 1964, name: "一起看" },
    ],
  },
];

function huyaPic(cid: number | string): string {
  return HUYA_GAME_PIC.replace("{cid}", String(cid));
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
  const groups: CategoryGroup[] = [];
  for (const group of HUYA_CATEGORY_GROUPS) {
    const items = group.list.map((item) => ({
      cid: item.cid,
      name: item.name,
      pic: huyaPic(item.cid),
    }));
    groups.push({ id: group.id, name: group.name, list: items });
  }
  return groups;
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
