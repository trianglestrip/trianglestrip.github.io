import { coverFromRoom, fetchBetard } from "../resolve/douyu/betard.js";

export type FollowState = "live" | "replay" | "offline";

export interface FollowSnapshot {
  site: string;
  id: string;
  state: FollowState;
  avatar: string;
  cover: string;
  title: string;
  anchor: string;
}

const STATUS_ORDER: Record<FollowState, number> = { live: 0, replay: 1, offline: 2 };

const HUYA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

function httpsUrl(text: string): string {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function avatarFromDouyu(room: Record<string, unknown>): string {
  const avatar = room.avatar;
  if (avatar && typeof avatar === "object") {
    const obj = avatar as Record<string, unknown>;
    return httpsUrl(String(obj.big || obj.middle || obj.small || ""));
  }
  return httpsUrl(String(avatar || ""));
}

function douyuState(room: Record<string, unknown>): FollowState {
  const showStatus = Number(room.show_status || 0);
  if (showStatus === 1) return "live";
  if (showStatus === 2) return "replay";
  return "offline";
}

function huyaState(data: Record<string, unknown>): FollowState {
  const statusRaw = String(data.liveStatus || data.realLiveStatus || "").toUpperCase();
  if (statusRaw === "ON") return "live";
  if (statusRaw === "REPLAY" || statusRaw === "VOD") return "replay";
  const liveData = (data.liveData || {}) as Record<string, unknown>;
  if (liveData.isReplay === 1 || liveData.isReplay === "1" || liveData.isReplay === true) {
    return "replay";
  }
  return "offline";
}

function avatarFromHuya(profile: Record<string, unknown>): string {
  return httpsUrl(String(profile.avatar180 || profile.avatar || ""));
}

async function fetchDouyuSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const room = await fetchBetard(rid);
  const raw = room as unknown as Record<string, unknown>;
  return {
    site: "douyu",
    id: rid,
    state: douyuState(raw),
    avatar: avatarFromDouyu(raw),
    cover: coverFromRoom(room),
    title: String(room.room_name || room.nickname || ""),
    anchor: String(room.nickname || ""),
  };
}

async function fetchHuyaSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const url = new URL("https://mp.huya.com/cache.php");
  url.searchParams.set("m", "Live");
  url.searchParams.set("do", "profileRoom");
  url.searchParams.set("roomid", rid);
  url.searchParams.set("showSecret", "1");
  const res = await fetch(url, { headers: HUYA_HEADERS, signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    throw new Error(`虎牙房间信息 HTTP ${res.status}`);
  }
  const payload = (await res.json()) as Record<string, unknown>;
  if (Number(payload.status || 0) !== 200) {
    throw new Error(String(payload.message || "虎牙房间信息获取失败"));
  }
  const data = (payload.data || {}) as Record<string, unknown>;
  const profile = (data.profileInfo || {}) as Record<string, unknown>;
  const liveData = (data.liveData || {}) as Record<string, unknown>;
  return {
    site: "huya",
    id: rid,
    state: huyaState(data),
    avatar: avatarFromHuya(profile),
    cover: httpsUrl(String(liveData.screenshot || liveData.cover || "")),
    title: String(liveData.introduction || liveData.gameHostName || profile.nick || ""),
    anchor: String(profile.nick || ""),
  };
}

function emptySnapshot(site: string, id: string): FollowSnapshot {
  return { site, id, state: "offline", avatar: "", cover: "", title: "", anchor: "" };
}

async function fetchOne(site: string, roomId: string): Promise<FollowSnapshot> {
  const normalizedSite = String(site || "").trim();
  const rid = String(roomId || "").trim();
  if (!normalizedSite || !rid) {
    return emptySnapshot(normalizedSite, rid);
  }
  try {
    if (normalizedSite === "douyu") return await fetchDouyuSnapshot(rid);
    if (normalizedSite === "huya") return await fetchHuyaSnapshot(rid);
  } catch {
    /* fall through */
  }
  return emptySnapshot(normalizedSite, rid);
}

export async function fetchFollowSnapshots(
  rooms: Array<{ site?: string; id?: string; roomId?: string }>,
): Promise<FollowSnapshot[]> {
  const tasks: Promise<FollowSnapshot>[] = [];
  const seen = new Set<string>();
  for (const item of rooms || []) {
    const site = String(item.site || "").trim();
    const id = String(item.id || item.roomId || "").trim();
    const key = `${site}:${id}`;
    if (!site || !id || seen.has(key)) continue;
    seen.add(key);
    tasks.push(fetchOne(site, id));
  }
  const results = await Promise.all(tasks);
  return results.sort((a, b) => {
    const byState = (STATUS_ORDER[a.state] ?? 9) - (STATUS_ORDER[b.state] ?? 9);
    if (byState !== 0) return byState;
    return a.site.localeCompare(b.site) || a.id.localeCompare(b.id);
  });
}
