import { coverFromRoom, fetchBetard } from "../resolve/douyu/betard.js";
import { formatOnline } from "../utils/format-online.js";

export type FollowState = "live" | "replay" | "offline";

export interface FollowSnapshot {
  site: string;
  id: string;
  state: FollowState;
  avatar: string;
  cover: string;
  title: string;
  anchor: string;
  category: string;
  fans: string;
  online: string;
}

const STATUS_ORDER: Record<FollowState, number> = { live: 0, replay: 1, offline: 2 };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HUYA_HEADERS = {
  "User-Agent": USER_AGENT,
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

const DOUYU_HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/",
  Origin: "https://www.douyu.com",
  "Client-Type": "web",
};

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

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
  const showStatus = Number(room.show_status ?? 0);
  if (showStatus !== 1) return "offline";
  const videoLoop = Number(room.videoLoop ?? 0);
  if (videoLoop === 1) return "replay";
  return "live";
}

function douyuOnlineText(state: FollowState, hn: string): string {
  if (state === "offline") return "";
  const text = String(hn || "").trim();
  if (!text || text === "0") return "";
  return text;
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

async function fetchDouyuRoomApi(rid: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://m.douyu.com/api/room/info?rid=${rid}`, {
    headers: DOUYU_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { code?: number; data?: { roomInfo?: Record<string, unknown> } };
  if (Number(payload.code ?? -1) !== 0) return null;
  return payload.data?.roomInfo || null;
}

async function fetchDouyuMobileRoom(rid: string): Promise<Record<string, unknown> | null> {
  const apiInfo = await fetchDouyuRoomApi(rid);
  if (apiInfo) return apiInfo;
  const res = await fetch(`https://m.douyu.com/${rid}`, {
    headers: DOUYU_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/id="vike_pageContext"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const ctx = JSON.parse(match[1]) as {
      pageProps?: { room?: { roomInfo?: Record<string, unknown> } };
    };
    const block = ctx.pageProps?.room?.roomInfo;
    if (!block) return null;
    const inner = block.roomInfo as Record<string, unknown> | undefined;
    return inner || block;
  } catch {
    return null;
  }
}

/** 斗鱼 lapi 粉丝接口已失效（60001），betard / m 端 room 信息亦无粉丝字段 */
async function fetchDouyuFans(rid: string, ownerUid?: number | string): Promise<string> {
  const uid = Number(ownerUid || 0);
  const urls = [
    `https://www.douyu.com/lapi/member/cp/getFansBadgeNum?room_id=${rid}${uid ? `&owner_uid=${uid}` : ""}`,
    `https://www.douyu.com/lapi/web/anchor/anchorprofile/getAnchorProfile?room_id=${rid}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: DOUYU_HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const payload = (await res.json()) as Record<string, unknown>;
      const data = (payload.data || payload) as Record<string, unknown>;
      const raw =
        data.fansNum ??
        data.fans_num ??
        data.fansCount ??
        data.followNum ??
        data.follow_num ??
        data.num;
      const text = formatOnline(raw as number | string);
      if (text) return text;
    } catch {
      /* try next */
    }
  }
  return "";
}

async function fetchDouyuSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const [room, mobile] = await Promise.all([fetchBetard(rid), fetchDouyuMobileRoom(rid)]);
  const raw = room as unknown as Record<string, unknown>;
  const mobileInfo = mobile || {};
  const state = douyuState(raw);
  const hn = String(mobileInfo.hn || "").trim();
  const ownerUid = mobileInfo.ownerId ?? raw.owner_uid;
  const fans = await fetchDouyuFans(rid, ownerUid as number | string);

  return {
    site: "douyu",
    id: rid,
    state,
    avatar: httpsUrl(String(mobileInfo.avatar || "")) || avatarFromDouyu(raw),
    cover: coverFromRoom(room),
    title: String(mobileInfo.roomName || raw.room_name || ""),
    anchor: String(mobileInfo.nickname || raw.nickname || ""),
    category: pickText(
      mobileInfo.gameName,
      mobileInfo.cate2Name,
      mobileInfo.cateName,
      raw.cate2_name,
      raw.game_name,
      raw.cate_name,
    ),
    fans,
    online: douyuOnlineText(state, hn),
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
  const fansRaw = profile.activityCount ?? liveData.activityCount;
  const onlineRaw = liveData.totalCount ?? liveData.userCount;

  return {
    site: "huya",
    id: rid,
    state: huyaState(data),
    avatar: avatarFromHuya(profile),
    cover: httpsUrl(String(liveData.screenshot || liveData.cover || "")),
    title: String(liveData.introduction || liveData.roomName || profile.nick || ""),
    anchor: String(profile.nick || ""),
    category: pickText(liveData.gameHostName, liveData.sGameFullName, profile.gameHostName),
    fans: formatOnline(fansRaw as number | string),
    online: formatOnline(onlineRaw as number | string),
  };
}

function emptySnapshot(site: string, id: string): FollowSnapshot {
  return {
    site,
    id,
    state: "offline",
    avatar: "",
    cover: "",
    title: "",
    anchor: "",
    category: "",
    fans: "",
    online: "",
  };
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
