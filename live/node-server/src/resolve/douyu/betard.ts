const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/",
};

export interface BetardRoom {
  room_id: number;
  nickname?: string;
  show_status?: number;
  room_name?: string;
  room_pic?: string;
  coverSrc?: string;
  room_src?: string;
  videoLoop?: number;
  avatar?: string | { big?: string; middle?: string; small?: string };
}

export async function getRoomId(url: string): Promise<string> {
  const ridMatch = url.match(/douyu\.com\/(\d+)/) || url.match(/rid=(\d+)/);
  if (ridMatch) {
    return ridMatch[1];
  }
  const path = url.split("douyu.com/")[1]?.split("?")[0]?.split("/")[0];
  if (!path) {
    throw new Error(`无效的斗鱼地址: ${url}`);
  }
  const res = await fetch(`https://m.douyu.com/${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const match = html.match(/"rid":(\d+)/);
  if (!match) {
    throw new Error(`无法解析房间号: ${url}`);
  }
  return match[1];
}

export async function fetchBetard(rid: string): Promise<BetardRoom> {
  const res = await fetch(`https://www.douyu.com/betard/${rid}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`betard HTTP ${res.status}`);
  }
  const data = (await res.json()) as { room: BetardRoom };
  return data.room;
}

import { httpsUrl } from "../../utils/https-url.js";

export function avatarFromRoom(room: BetardRoom): string {
  const raw = room as unknown as Record<string, unknown>;
  const avatar = raw.avatar;
  if (avatar && typeof avatar === "object") {
    const obj = avatar as Record<string, unknown>;
    return httpsUrl(String(obj.big || obj.middle || obj.small || ""));
  }
  return httpsUrl(String(avatar || ""));
}

export async function fetchDouyuRoomInfo(rid: string): Promise<Record<string, unknown> | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Referer: "https://www.douyu.com/",
    Origin: "https://www.douyu.com",
    "Client-Type": "web",
  };
  try {
    const res = await fetch(`https://m.douyu.com/api/room/info?rid=${rid}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { code?: number; data?: { roomInfo?: Record<string, unknown> } };
    if (Number(payload.code ?? -1) !== 0) return null;
    return payload.data?.roomInfo || null;
  } catch {
    return null;
  }
}

export async function resolveDouyuAvatar(rid: string, room: BetardRoom): Promise<string> {
  const fromRoom = avatarFromRoom(room);
  if (fromRoom) return fromRoom;
  const info = await fetchDouyuRoomInfo(rid);
  return httpsUrl(String(info?.avatar || ""));
}

export function coverFromRoom(room: BetardRoom): string {
  let cover = String(room.room_pic || room.coverSrc || "").trim();
  if (!cover) {
    const src = String(room.room_src || "").trim();
    if (src.startsWith("//")) {
      cover = `https:${src}`;
    } else if (src.startsWith("http")) {
      cover = src;
    } else if (src) {
      cover = `https://rpic.douyucdn.cn/${src.replace(/^\//, "")}`;
    }
  } else if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return cover;
}
